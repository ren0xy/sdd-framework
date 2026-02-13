/**
 * Property-Based Tests for InstallSkillsCommand
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 13: Skill Installation Location
 * Property 14: Skill Skip Without Force
 * Property 15: Selective Skill Installation
 * 
 * Validates: Requirements 5.1, 5.2, 5.7, 5.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { InstallSkillsCommand } from '../../src/commands/install-skills-command';
import type { InstallSkillsFileSystem } from '../../src/commands/install-skills-command';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { allSkills } from '../../src/skills/index';
import type { PlatformId } from '../../src/types';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import {
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
} from '../../src/adapters/index';

// --- Generators ---

const arbitraryPlatform: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

// --- Helpers ---

function createAdapters(): Map<PlatformId, PlatformAdapter> {
  const adapters = new Map<PlatformId, PlatformAdapter>();
  adapters.set('kiro', new KiroAdapter());
  adapters.set('claude-code', new ClaudeCodeAdapter());
  adapters.set('codex', new CodexAdapter());
  adapters.set('antigravity', new AntigravityAdapter());
  return adapters;
}

function createRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  allSkills.forEach(skill => registry.register(skill));
  return registry;
}

function createMockFs(existingPaths: Set<string> = new Set()): InstallSkillsFileSystem & {
  written: Map<string, string>;
  createdDirs: string[];
} {
  const written = new Map<string, string>();
  const createdDirs: string[] = [];
  return {
    written,
    createdDirs,
    exists: async (p: string) => existingPaths.has(p),
    mkdir: async (p: string) => { createdDirs.push(p); },
    writeFile: async (p: string, content: string) => { written.set(p, content); },
  };
}

// --- Tests ---

describe('Property 13: Skill Installation Location', () => {
  it('installs skills to the correct platform-specific directory', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        const mockFs = createMockFs();
        const registry = createRegistry();
        const adapters = createAdapters();
        const command = new InstallSkillsCommand(registry, adapters, mockFs);

        const result = await command.execute({ platform, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.platform).toBe(platform);
        expect(result.data!.installed.length).toBeGreaterThan(0);

        // All written files should be under the target path
        const targetPath = result.data!.targetPath;
        for (const [filePath] of mockFs.written) {
          expect(filePath.startsWith(targetPath)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('writes non-empty content for every installed skill', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        const mockFs = createMockFs();
        const registry = createRegistry();
        const adapters = createAdapters();
        const command = new InstallSkillsCommand(registry, adapters, mockFs);

        await command.execute({ platform, workspaceRoot: '/workspace' });

        for (const [, content] of mockFs.written) {
          expect(content.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Skill Skip Without Force', () => {
  it('skips existing skills when force is false', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        // First install to discover paths
        const mockFs1 = createMockFs();
        const registry = createRegistry();
        const adapters = createAdapters();
        const cmd1 = new InstallSkillsCommand(registry, adapters, mockFs1);
        const r1 = await cmd1.execute({ platform, workspaceRoot: '/workspace' });
        expect(r1.success).toBe(true);

        // Second install with all paths "existing"
        const existingPaths = new Set(mockFs1.written.keys());
        // Also add directory paths for codex-style skills
        for (const dir of mockFs1.createdDirs) {
          existingPaths.add(dir);
        }
        const mockFs2 = createMockFs(existingPaths);
        // Make exists return true for any path that starts with the target
        mockFs2.exists = async (p: string) => {
          // Check exact match or prefix match for directories
          for (const existing of existingPaths) {
            if (p === existing || existing.startsWith(p)) return true;
          }
          return existingPaths.has(p);
        };

        const cmd2 = new InstallSkillsCommand(createRegistry(), createAdapters(), mockFs2);
        const r2 = await cmd2.execute({ platform, force: false, workspaceRoot: '/workspace' });

        expect(r2.success).toBe(true);
        // All skills should be skipped
        expect(r2.data!.skipped.length).toBe(r1.data!.installed.length);
        expect(r2.data!.installed).toHaveLength(0);
        // No new files written
        expect(mockFs2.written.size).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('overwrites existing skills when force is true', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        const existingPaths = new Set<string>();
        const mockFs = createMockFs(existingPaths);
        // Make everything "exist"
        mockFs.exists = async () => true;

        const registry = createRegistry();
        const adapters = createAdapters();
        const command = new InstallSkillsCommand(registry, adapters, mockFs);

        const result = await command.execute({ platform, force: true, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        // With force, all skills should be installed (not skipped)
        expect(result.data!.installed.length).toBeGreaterThan(0);
        expect(result.data!.skipped).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 15: Selective Skill Installation', () => {
  it('installs only the specified skills', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPlatform,
        fc.subarray(allSkills.map(s => s.name), { minLength: 1 }),
        async (platform, selectedSkills) => {
          // Filter to skills that support this platform
          const registry = createRegistry();
          const validSkills = selectedSkills.filter(name => {
            const skill = registry.get(name);
            return skill && skill.supportedPlatforms.includes(platform);
          });

          if (validSkills.length === 0) return; // skip if no valid skills for platform

          const mockFs = createMockFs();
          const adapters = createAdapters();
          const command = new InstallSkillsCommand(registry, adapters, mockFs);

          const result = await command.execute({
            platform,
            skills: validSkills,
            workspaceRoot: '/workspace',
          });

          expect(result.success).toBe(true);
          // Only the requested skills should be installed
          expect(result.data!.installed.sort()).toEqual([...new Set(validSkills)].sort());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns error for non-existent skill names', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        const mockFs = createMockFs();
        const registry = createRegistry();
        const adapters = createAdapters();
        const command = new InstallSkillsCommand(registry, adapters, mockFs);

        const result = await command.execute({
          platform,
          skills: ['nonexistent-skill-xyz'],
          workspaceRoot: '/workspace',
        });

        expect(result.success).toBe(false);
        expect(result.error!.code).toBe('SKILL_NOT_FOUND');
        expect(mockFs.written.size).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});
