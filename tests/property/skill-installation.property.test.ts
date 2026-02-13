/**
 * Property-Based Tests for Skill Installation
 * 
 * Feature: 000-sdd-framework-init
 * Property 15: Skill Installation to Platform-Appropriate Directory
 * Property 16: Skills Directory Created If Missing
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SkillRegistry, FileSystem } from '../../src/registry/skill-registry';
import { KiroAdapter } from '../../src/adapters/kiro-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { CodexAdapter } from '../../src/adapters/codex-adapter';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import type { CanonicalSkill, PlatformId } from '../../src/types';

/**
 * Generator for valid kebab-case skill names
 */
const arbitrarySkillName = fc.stringMatching(/^[a-z]{3,20}$/);

/**
 * Generator for non-empty strings
 */
const arbitraryNonEmptyString = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for valid platform IDs
 */
const arbitraryPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

/**
 * Generator for valid canonical skill definitions supporting all platforms
 */
const arbitraryCanonicalSkill: fc.Arbitrary<CanonicalSkill> = fc.record({
  name: arbitrarySkillName,
  title: arbitraryNonEmptyString,
  description: arbitraryNonEmptyString,
  version: fc.constant('1.0.0'),
  supportedPlatforms: fc.constant(['kiro', 'claude-code', 'codex', 'antigravity'] as PlatformId[]),
  instructions: arbitraryNonEmptyString,
  parameters: fc.constant([]),
});

/**
 * Mock file system for testing
 */
class MockFileSystem implements FileSystem {
  public files: Map<string, string> = new Map();
  public directories: Set<string> = new Set();
  public existingDirs: Set<string> = new Set();

  constructor(existingDirs: string[] = []) {
    for (const dir of existingDirs) {
      this.existingDirs.add(dir);
      this.directories.add(dir);
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.existingDirs.has(path) || this.directories.has(path) || this.files.has(path);
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    this.directories.add(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

/**
 * Get adapter for a platform ID
 */
function getAdapter(platformId: PlatformId): PlatformAdapter {
  switch (platformId) {
    case 'kiro':
      return new KiroAdapter();
    case 'claude-code':
      return new ClaudeCodeAdapter();
    case 'codex':
      return new CodexAdapter();
    case 'antigravity':
      return new AntigravityAdapter();
  }
}

describe('Property 15: Skill Installation to Platform-Appropriate Directory', () => {
  /**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
   * 
   * Property: For any platform, installing skills SHALL copy files to that
   * platform's configured skillsPath directory.
   */
  it('installs skills to platform-appropriate directory', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryCanonicalSkill,
        arbitraryPlatformId,
        async (skill, platformId) => {
          const registry = new SkillRegistry();
          registry.register(skill);

          const adapter = getAdapter(platformId);
          const fs = new MockFileSystem([adapter.getSkillsDirectory()]);

          const result = await registry.install(skill.name, adapter, fs);

          expect(result.success).toBe(true);
          expect(result.skillName).toBe(skill.name);
          expect(result.targetPath).toContain(adapter.skillsPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   * 
   * Property: Installing on Kiro places skills in .kiro/skills/
   */
  it('installs to .kiro/skills/ for Kiro platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCanonicalSkill, async (skill) => {
        const registry = new SkillRegistry();
        registry.register(skill);

        const adapter = new KiroAdapter();
        const fs = new MockFileSystem([adapter.getSkillsDirectory()]);

        const result = await registry.install(skill.name, adapter, fs);

        expect(result.success).toBe(true);
        expect(result.targetPath).toContain('.kiro/skills/');
        expect(fs.files.has(`.kiro/skills/${skill.name}.md`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.3**
   * 
   * Property: Installing on Codex places skills in .codex/skills/ with SKILL.md
   */
  it('installs to .codex/skills/ with SKILL.md for Codex platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCanonicalSkill, async (skill) => {
        const registry = new SkillRegistry();
        registry.register(skill);

        const adapter = new CodexAdapter();
        const fs = new MockFileSystem([adapter.getSkillsDirectory()]);

        const result = await registry.install(skill.name, adapter, fs);

        expect(result.success).toBe(true);
        expect(result.targetPath).toContain('.codex/skills/');
        expect(fs.files.has(`.codex/skills/${skill.name}/SKILL.md`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   * 
   * Property: Installing on Claude Code places skills in .claude/skills/
   */
  it('installs to .claude/skills/ for Claude Code platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCanonicalSkill, async (skill) => {
        const registry = new SkillRegistry();
        registry.register(skill);

        const adapter = new ClaudeCodeAdapter();
        const fs = new MockFileSystem([adapter.getSkillsDirectory()]);

        const result = await registry.install(skill.name, adapter, fs);

        expect(result.success).toBe(true);
        expect(result.targetPath).toContain('.claude/skills/');
        expect(fs.files.has(`.claude/skills/${skill.name}.md`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.5**
   * 
   * Property: Installing on Antigravity places skills in .agent/skills/
   */
  it('installs to .agent/skills/ for Antigravity platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCanonicalSkill, async (skill) => {
        const registry = new SkillRegistry();
        registry.register(skill);

        const adapter = new AntigravityAdapter();
        const fs = new MockFileSystem([adapter.getSkillsDirectory()]);

        const result = await registry.install(skill.name, adapter, fs);

        expect(result.success).toBe(true);
        expect(result.targetPath).toContain('.agent/skills/');
        expect(fs.files.has(`.agent/skills/${skill.name}/SKILL.md`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Installation fails for non-existent skills
   */
  it('returns error for non-existent skills', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitrarySkillName,
        arbitraryPlatformId,
        async (skillName, platformId) => {
          const registry = new SkillRegistry();
          const adapter = getAdapter(platformId);
          const fs = new MockFileSystem();

          const result = await registry.install(skillName, adapter, fs);

          expect(result.success).toBe(false);
          expect(result.error).toContain('not found');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Installation fails for unsupported platforms
   */
  it('returns error when skill does not support platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitrarySkillName, arbitraryNonEmptyString, async (name, instructions) => {
        const registry = new SkillRegistry();
        
        // Register skill that only supports Kiro
        const skill: CanonicalSkill = {
          name,
          title: 'Test Skill',
          description: 'Test Description',
          version: '1.0.0',
          supportedPlatforms: ['kiro'],
          instructions,
          parameters: []
        };
        registry.register(skill);

        // Try to install on Claude Code (unsupported)
        const adapter = new ClaudeCodeAdapter();
        const fs = new MockFileSystem();

        const result = await registry.install(name, adapter, fs);

        expect(result.success).toBe(false);
        expect(result.error).toContain('does not support');
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 16: Skills Directory Created If Missing', () => {
  /**
   * **Validates: Requirements 8.7**
   * 
   * Property: For any skill installation where the target directory does not exist,
   * the installation SHALL create the directory before copying files.
   */
  it('creates skills directory if it does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryCanonicalSkill,
        arbitraryPlatformId,
        async (skill, platformId) => {
          const registry = new SkillRegistry();
          registry.register(skill);

          const adapter = getAdapter(platformId);
          // Start with empty file system - no directories exist
          const fs = new MockFileSystem();

          const result = await registry.install(skill.name, adapter, fs);

          expect(result.success).toBe(true);
          expect(result.directoryCreated).toBe(true);
          expect(fs.directories.has(adapter.getSkillsDirectory())).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Does not report directory creation when directory already exists
   */
  it('does not report directory creation when directory exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryCanonicalSkill,
        arbitraryPlatformId,
        async (skill, platformId) => {
          const registry = new SkillRegistry();
          registry.register(skill);

          const adapter = getAdapter(platformId);
          // Pre-create the skills directory
          const fs = new MockFileSystem([adapter.getSkillsDirectory()]);

          const result = await registry.install(skill.name, adapter, fs);

          expect(result.success).toBe(true);
          // For single-file skills, directoryCreated should be false
          // For directory skills (Codex, Antigravity), it may be true for the skill subdirectory
          if (platformId !== 'codex' && platformId !== 'antigravity') {
            expect(result.directoryCreated).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Creates nested directories for Codex skills
   */
  it('creates skill subdirectory for Codex platform', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCanonicalSkill, async (skill) => {
        const registry = new SkillRegistry();
        registry.register(skill);

        const adapter = new CodexAdapter();
        const fs = new MockFileSystem();

        const result = await registry.install(skill.name, adapter, fs);

        expect(result.success).toBe(true);
        // Both the skills directory and skill subdirectory should be created
        expect(fs.directories.has('.codex/skills/')).toBe(true);
        expect(fs.directories.has(`.codex/skills/${skill.name}/`)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Skill content is written correctly after directory creation
   */
  it('writes skill content after creating directory', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryCanonicalSkill,
        arbitraryPlatformId,
        async (skill, platformId) => {
          const registry = new SkillRegistry();
          registry.register(skill);

          const adapter = getAdapter(platformId);
          const fs = new MockFileSystem();

          const result = await registry.install(skill.name, adapter, fs);

          expect(result.success).toBe(true);
          
          // Verify file was written
          if (platformId === 'codex') {
            const content = fs.files.get(`.codex/skills/${skill.name}/SKILL.md`);
            expect(content).toBeDefined();
            expect(content).toContain(skill.title);
            expect(content).toContain(skill.instructions);
          } else if (platformId === 'antigravity') {
            const content = fs.files.get(`.agent/skills/${skill.name}/SKILL.md`);
            expect(content).toBeDefined();
            expect(content).toContain(skill.title);
            expect(content).toContain(skill.instructions);
          } else {
            const expectedPath = `${adapter.skillsPath}${skill.name}.md`;
            const content = fs.files.get(expectedPath);
            expect(content).toBeDefined();
            expect(content).toContain(skill.title);
            expect(content).toContain(skill.instructions);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
