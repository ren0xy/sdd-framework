/**
 * Property-Based Tests for WorkspaceInitCommand
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 11: Workspace Init Structure
 * Property 12: Workspace Init Idempotence
 * 
 * Validates: Requirements 4.1, 4.2, 4.6, 4.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkspaceInitCommand } from '../../src/commands/workspace-init-command';
import type { WorkspaceInitFileSystem } from '../../src/commands/workspace-init-command';
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

function createMockFs(existingDirs: Set<string> = new Set()): WorkspaceInitFileSystem & {
  written: Map<string, string>;
  createdDirs: string[];
} {
  const written = new Map<string, string>();
  const createdDirs: string[] = [];
  return {
    written,
    createdDirs,
    exists: async (p: string) => existingDirs.has(p),
    mkdir: async (p: string) => { createdDirs.push(p); },
    writeFile: async (p: string, content: string) => { written.set(p, content); },
    readFile: async () => '',
    readdir: async () => [],
    isDirectory: async () => false,
  };
}

// --- Tests ---

describe('Property 11: Workspace Init Structure', () => {
  it('creates .kiro/specs directory for any valid platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        const mockFs = createMockFs();
        const adapters = createAdapters();
        const command = new WorkspaceInitCommand(mockFs, adapters);

        const result = await command.execute({ platform, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.platform).toBe(platform);

        // Should have attempted to create specs dir
        const specsDir = mockFs.createdDirs.find(d => d.includes('specs'));
        expect(specsDir).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('creates platform-specific instructions file for non-kiro platforms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<PlatformId>('claude-code', 'codex', 'antigravity'),
        async (platform) => {
          const mockFs = createMockFs();
          const adapters = createAdapters();
          const command = new WorkspaceInitCommand(mockFs, adapters);

          const result = await command.execute({ platform, workspaceRoot: '/workspace' });

          expect(result.success).toBe(true);
          // Non-kiro platforms should write an instructions file
          expect(mockFs.written.size).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('preserves existing specs (reports specsFound count)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryPlatform,
        fc.array(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 3, maxLength: 10 }),
          { minLength: 0, maxLength: 5 }
        ),
        async (platform, specNames) => {
          const existingDirs = new Set<string>();
          const specsBasePath = '/workspace/.kiro/specs';

          // Mark specs dir as existing
          existingDirs.add(specsBasePath.replace(/\//g, '\\'));
          existingDirs.add(specsBasePath);

          const mockFs = createMockFs(existingDirs);

          // Override readdir to return spec names
          mockFs.readdir = async () => specNames;
          mockFs.isDirectory = async () => true;

          const adapters = createAdapters();
          const command = new WorkspaceInitCommand(mockFs, adapters);

          const result = await command.execute({ platform, workspaceRoot: '/workspace' });

          expect(result.success).toBe(true);
          expect(result.data!.specsFound).toBe(specNames.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 12: Workspace Init Idempotence', () => {
  it('running init twice produces same result structure', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryPlatform, async (platform) => {
        const adapters = createAdapters();

        // First run
        const mockFs1 = createMockFs();
        const cmd1 = new WorkspaceInitCommand(mockFs1, adapters);
        const result1 = await cmd1.execute({ platform, workspaceRoot: '/workspace' });

        // Second run (specs dir now "exists")
        const existingDirs = new Set<string>();
        for (const d of mockFs1.createdDirs) {
          existingDirs.add(d);
        }
        const mockFs2 = createMockFs(existingDirs);
        const cmd2 = new WorkspaceInitCommand(mockFs2, adapters);
        const result2 = await cmd2.execute({ platform, workspaceRoot: '/workspace' });

        // Both should succeed
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);

        // Same platform and structure
        expect(result1.data!.platform).toBe(result2.data!.platform);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects invalid platforms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('invalid', 'vscode', 'KIRO', ''), async (platform) => {
          const mockFs = createMockFs();
          const adapters = createAdapters();
          const command = new WorkspaceInitCommand(mockFs, adapters);

          const result = await command.execute({ platform: platform as PlatformId, workspaceRoot: '/workspace' });

          expect(result.success).toBe(false);
          expect(result.error!.code).toBe('INVALID_PLATFORM');
          expect(mockFs.written.size).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
