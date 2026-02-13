/**
 * Property-Based Tests for End-to-End Platform Switching
 *
 * Feature: 004-e2e-platform-switching-tests
 *
 * Validates cross-platform round-trip workflows using the existing
 * library API with an in-memory file system.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { PlatformId } from '../../src/types';
import { InMemoryFS, createAdapters, createSkillRegistry, runRoundTrip } from './e2e-harness';
import { WorkspaceInitCommand } from '../../src/commands/workspace-init-command';
import { CreateSpecCommand } from '../../src/commands/create-spec-command';
import { InstallSkillsCommand } from '../../src/commands/install-skills-command';

// --- Generators ---

const arbPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'
);

const arbPlatformPair: fc.Arbitrary<[PlatformId, PlatformId]> = fc.tuple(
  arbPlatformId,
  arbPlatformId
);

const arbSpecName: fc.Arbitrary<string> = fc
  .stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
    { minLength: 3, maxLength: 20 }
  )
  .filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

// --- Property Tests ---

// Feature: 004-e2e-platform-switching-tests, Property 1: Round-trip success across all platform pairs
describe('Property 1: Round-trip success across all platform pairs', () => {
  /**
   * Validates: Requirements 2.4, 3.1
   */
  it('all five commands return success for any platform pair and valid spec name', async () => {
    await fc.assert(
      fc.asyncProperty(arbPlatformPair, arbSpecName, async ([source, target], specName) => {
        const result = await runRoundTrip(source, target, specName);

        expect(result.sourceInit.success).toBe(true);
        expect(result.specCreation.success).toBe(true);
        expect(result.targetInit.success).toBe(true);
        expect(result.skillInstall.success).toBe(true);
        expect(result.verification.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: 004-e2e-platform-switching-tests, Property 2: Spec content preservation after platform switch
describe('Property 2: Spec content preservation after platform switch', () => {
  /**
   * Validates: Requirements 2.3, 2.1
   */
  it('spec files are byte-identical after platform switch', async () => {
    await fc.assert(
      fc.asyncProperty(arbPlatformPair, arbSpecName, async ([source, target], specName) => {
        const fs = new InMemoryFS();
        const adapters = createAdapters();
        const root = '/workspace';

        // Step 1: init source
        await new WorkspaceInitCommand(fs, adapters).execute({ platform: source, workspaceRoot: root });

        // Step 2: create spec
        await new CreateSpecCommand(fs).execute({ name: specName, workspaceRoot: root });

        // Snapshot spec files after create-spec
        const specBase = `${root}/.kiro/specs/${specName}`;
        const files = ['requirements.md', 'design.md', 'tasks.md'] as const;
        const snapshots = new Map<string, string>();
        for (const file of files) {
          snapshots.set(file, fs.getFile(`${specBase}/${file}`)!);
        }

        // Step 3: re-init for target platform
        await new WorkspaceInitCommand(fs, adapters).execute({ platform: target, workspaceRoot: root });

        // Assert byte-identical content
        for (const file of files) {
          expect(fs.getFile(`${specBase}/${file}`)).toBe(snapshots.get(file));
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: 004-e2e-platform-switching-tests, Property 3: Full verification pipeline passes after round trip
describe('Property 3: Full verification pipeline passes after round trip', () => {
  /**
   * Validates: Requirements 5.2, 5.1, 2.2, 3.2
   */
  it('VerifyCommand reports passed: true and summary.failed === 0', async () => {
    await fc.assert(
      fc.asyncProperty(arbPlatformPair, arbSpecName, async ([source, target], specName) => {
        const result = await runRoundTrip(source, target, specName);

        expect(result.verification.success).toBe(true);
        expect(result.verification.data).toBeDefined();
        expect(result.verification.data!.passed).toBe(true);
        expect(result.verification.data!.summary.failed).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: 004-e2e-platform-switching-tests, Property 4: Instructions file references created specs
describe('Property 4: Instructions file references created specs', () => {
  /**
   * Validates: Requirements 4.3, 4.1, 4.2
   */
  it('instructions file contains spec name for non-Kiro targets', async () => {
    const instructionsFiles: Record<string, string | null> = {
      kiro: null,
      'claude-code': 'CLAUDE.md',
      codex: 'AGENTS.md',
      antigravity: '.agent/rules/specs.md',
      amazonq: null,
    };

    await fc.assert(
      fc.asyncProperty(arbPlatformPair, arbSpecName, async ([source, target], specName) => {
        const result = await runRoundTrip(source, target, specName);
        const instrFile = instructionsFiles[target];

        if (instrFile === null) {
          // Kiro has no instructions file — skip assertion
          return;
        }

        const content = result.fs.getFile(`/workspace/${instrFile}`);
        expect(content).toBeDefined();
        expect(content!).toContain(specName);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: 004-e2e-platform-switching-tests, Property 5: InMemoryFS write-read round trip
describe('Property 5: InMemoryFS write-read round trip', () => {
  /**
   * Validates: Requirements 1.4
   */
  it('write then read returns identical content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `/workspace/${s.replace(/[\\:*?"<>|]/g, 'x')}`),
        fc.string(),
        async (filePath, content) => {
          const fs = new InMemoryFS();
          await fs.writeFile(filePath, content);
          const read = await fs.readFile(filePath);
          expect(read).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mkdir then exists returns true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).map(s => `/workspace/${s.replace(/[\\:*?"<>|]/g, 'x')}`),
        async (dirPath) => {
          const fs = new InMemoryFS();
          await fs.mkdir(dirPath, { recursive: true });
          const exists = await fs.exists(dirPath);
          expect(exists).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: 004-e2e-platform-switching-tests, Property 7: Invalid platform rejection
describe('Property 7: Invalid platform rejection', () => {
  /**
   * Validates: Requirements 7.1, 7.4
   */
  it('WorkspaceInitCommand and InstallSkillsCommand reject invalid platforms with no files written', async () => {
    const arbInvalidPlatform = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => !['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'].includes(s));

    await fc.assert(
      fc.asyncProperty(arbInvalidPlatform, async (invalidPlatform) => {
        const fs = new InMemoryFS();
        const adapters = createAdapters();
        const registry = createSkillRegistry();
        const root = '/workspace';

        const initResult = await new WorkspaceInitCommand(fs, adapters)
          .execute({ platform: invalidPlatform as PlatformId, workspaceRoot: root });

        expect(initResult.success).toBe(false);
        expect(initResult.error!.code).toBe('INVALID_PLATFORM');

        const installResult = await new InstallSkillsCommand(registry, adapters, fs)
          .execute({ platform: invalidPlatform as PlatformId, workspaceRoot: root });

        expect(installResult.success).toBe(false);
        expect(installResult.error!.code).toBe('INVALID_PLATFORM');

        // No files should have been written
        expect(fs.getAllFiles().size).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: 004-e2e-platform-switching-tests, Property 8: Duplicate spec rejection
describe('Property 8: Duplicate spec rejection', () => {
  /**
   * Validates: Requirements 7.2
   */
  it('second create-spec call fails with SPEC_EXISTS and original files unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(arbPlatformId, arbSpecName, async (platform, specName) => {
        const fs = new InMemoryFS();
        const adapters = createAdapters();
        const root = '/workspace';

        // Init workspace
        await new WorkspaceInitCommand(fs, adapters).execute({ platform, workspaceRoot: root });

        // First create-spec succeeds
        const first = await new CreateSpecCommand(fs).execute({ name: specName, workspaceRoot: root });
        expect(first.success).toBe(true);

        // Snapshot original files
        const specBase = `${root}/.kiro/specs/${specName}`;
        const origFiles = new Map<string, string>();
        for (const file of ['requirements.md', 'design.md', 'tasks.md', '.config.kiro']) {
          origFiles.set(file, fs.getFile(`${specBase}/${file}`)!);
        }

        // Second create-spec fails
        const second = await new CreateSpecCommand(fs).execute({ name: specName, workspaceRoot: root });
        expect(second.success).toBe(false);
        expect(second.error!.code).toBe('SPEC_EXISTS');

        // Original files unchanged
        for (const [file, content] of origFiles) {
          expect(fs.getFile(`${specBase}/${file}`)).toBe(content);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: 004-e2e-platform-switching-tests, Property 9: Write failure resilience
describe('Property 9: Write failure resilience', () => {
  /**
   * Validates: Requirements 7.3
   */
  it('write failure returns failure and pre-existing files remain intact', async () => {
    await fc.assert(
      fc.asyncProperty(arbPlatformId, arbSpecName, async (platform, specName) => {
        const fs = new InMemoryFS();
        const adapters = createAdapters();
        const root = '/workspace';

        // Set up a valid workspace with a spec
        await new WorkspaceInitCommand(fs, adapters).execute({ platform, workspaceRoot: root });
        const createResult = await new CreateSpecCommand(fs).execute({ name: specName, workspaceRoot: root });
        expect(createResult.success).toBe(true);

        // Snapshot pre-existing files
        const preFiles = new Map(fs.getAllFiles());

        // Configure write failure, then try install-skills
        fs.failOnNextWrite();
        const registry = createSkillRegistry();
        const installResult = await new InstallSkillsCommand(registry, adapters, fs)
          .execute({ platform, force: true, workspaceRoot: root });

        expect(installResult.success).toBe(false);

        // All pre-existing files should still be intact and readable
        for (const [path, content] of preFiles) {
          expect(fs.getFile(path)).toBe(content);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: 004-e2e-platform-switching-tests, Property 6: Platform matrix coverage
describe('Property 6: Platform matrix coverage verification', () => {
  /**
   * Validates: Requirements 6.1, 6.2, 6.3, 6.4
   */
  it('all 16 platform pair combinations appear in 100+ generated runs', () => {
    const allPlatforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
    const seen = new Set<string>();

    fc.assert(
      fc.property(arbPlatformPair, ([source, target]) => {
        seen.add(`${source}->${target}`);
      }),
      { numRuns: 400 }
    );

    // All 25 combinations must have appeared
    for (const source of allPlatforms) {
      for (const target of allPlatforms) {
        expect(seen.has(`${source}->${target}`)).toBe(true);
      }
    }
    expect(seen.size).toBe(25);
  });
});

// Feature: 004-e2e-platform-switching-tests, Edge case: Codex directory skill structure
describe('Edge case: Codex directory skill structure after switching from single-file platforms', () => {
  /**
   * Validates: Requirements 3.3, 3.4
   */
  it('Codex skills use {name}/SKILL.md directory format after switching from a single-file platform', async () => {
    const singleFilePlatforms: PlatformId[] = ['kiro', 'claude-code', 'antigravity'];

    for (const source of singleFilePlatforms) {
      const result = await runRoundTrip(source, 'codex', 'test-spec');
      expect(result.skillInstall.success).toBe(true);

      // Verify each skill uses directory-based structure
      const allFiles = result.fs.getAllFiles();
      const codexSkillsPrefix = '/workspace/.codex/skills/';
      const skillFiles = [...allFiles.keys()].filter(p => p.startsWith(codexSkillsPrefix));

      // Every skill file should be inside a {name}/SKILL.md path
      for (const filePath of skillFiles) {
        const relative = filePath.slice(codexSkillsPrefix.length);
        expect(relative).toMatch(/^[^/]+\/SKILL\.md$/);
      }

      // At least one skill should be installed
      expect(skillFiles.length).toBeGreaterThan(0);
    }
  });

  it('single-file platforms have flat skill files after switching from Codex', async () => {
    const singleFileTargets: Array<{ platform: PlatformId; skillsPrefix: string }> = [
      { platform: 'kiro', skillsPrefix: '/workspace/.kiro/skills/' },
      { platform: 'claude-code', skillsPrefix: '/workspace/.claude/skills/' },
    ];

    for (const { platform, skillsPrefix } of singleFileTargets) {
      const result = await runRoundTrip('codex', platform, 'test-spec');
      expect(result.skillInstall.success).toBe(true);

      const allFiles = result.fs.getAllFiles();
      const skillFiles = [...allFiles.keys()].filter(p => p.startsWith(skillsPrefix));

      // Every skill file should be a flat {name}.md (no subdirectory)
      for (const filePath of skillFiles) {
        const relative = filePath.slice(skillsPrefix.length);
        expect(relative).toMatch(/^[^/]+\.md$/);
      }

      expect(skillFiles.length).toBeGreaterThan(0);
    }
  });
});

// Feature: 004-e2e-platform-switching-tests, Edge case: Kiro no-instructions-file
describe('Edge case: Kiro target has no instructions file but .kiro/specs/ exists', () => {
  /**
   * Validates: Requirements 4.4
   */
  it('Kiro target has .kiro/specs/ directory but no Kiro-specific instructions file', async () => {
    // Kiro uses steering files, not a single instructions file.
    // Verify that workspace-init for Kiro creates .kiro/specs/ and
    // that verification passes without an instructions file.
    const sourcePlatforms: PlatformId[] = ['claude-code', 'codex', 'antigravity'];

    for (const source of sourcePlatforms) {
      const result = await runRoundTrip(source, 'kiro', 'test-spec');

      // .kiro/specs/ should exist
      expect(result.fs.hasDir('/workspace/.kiro/specs')).toBe(true);

      // Kiro adapter has instructionsFile = null, so it doesn't generate one.
      // Source platform files may still exist (shared FS), but Kiro doesn't
      // need or create its own instructions file for verification to pass.
      expect(result.verification.success).toBe(true);
      expect(result.verification.data!.passed).toBe(true);
    }
  });
});
