/**
 * Property-Based Tests for CLI Validation
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 2: Non-Zero Exit on Failure
 * Property 3: Validation Before File Operations
 * 
 * Validates: Requirements 1.5, 1.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CreateSpecCommand } from '../../src/commands/create-spec-command';
import { RunTaskCommand } from '../../src/commands/run-task-command';
import { WorkspaceInitCommand } from '../../src/commands/workspace-init-command';
import { InstallSkillsCommand } from '../../src/commands/install-skills-command';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { allSkills } from '../../src/skills/index';
import type { CreateSpecFileSystem } from '../../src/commands/create-spec-command';
import type { RunTaskFileSystem } from '../../src/commands/run-task-command';
import type { WorkspaceInitFileSystem } from '../../src/commands/workspace-init-command';
import type { InstallSkillsFileSystem } from '../../src/commands/install-skills-command';
import type { PlatformId } from '../../src/types';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import {
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
} from '../../src/adapters/index';

// --- Generators ---

const arbitraryInvalidSpecName = fc.oneof(
  fc.constant(''),
  fc.constant('UPPERCASE'),
  fc.constant('-leading'),
  fc.constant('trailing-'),
  fc.constant('double--hyphen'),
  fc.constant('has space')
);

const arbitraryInvalidPlatform = fc.oneof(
  fc.constant(''),
  fc.constant('vscode'),
  fc.constant('KIRO'),
  fc.constant('invalid-platform')
);

const arbitraryInvalidTaskId = fc.oneof(
  fc.constant(''),
  fc.constant('abc'),
  fc.constant('1'),
  fc.constant('a.b')
);

const arbitraryInvalidTaskStatus = fc.oneof(
  fc.constant(''),
  fc.constant('done'),
  fc.constant('pending')
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

/** Mock FS that tracks all calls to detect if file operations occurred */
function createTrackingFs() {
  let fileOpsOccurred = false;
  return {
    fileOpsOccurred: () => fileOpsOccurred,
    specFs: {
      exists: async () => { fileOpsOccurred = true; return false; },
      mkdir: async () => { fileOpsOccurred = true; },
      writeFile: async () => { fileOpsOccurred = true; },
    } as CreateSpecFileSystem,
    runTaskFs: {
      exists: async () => { fileOpsOccurred = true; return false; },
      readFile: async () => { fileOpsOccurred = true; return ''; },
    } as RunTaskFileSystem,
    workspaceInitFs: {
      exists: async () => { fileOpsOccurred = true; return false; },
      mkdir: async () => { fileOpsOccurred = true; },
      writeFile: async () => { fileOpsOccurred = true; },
      readFile: async () => { fileOpsOccurred = true; return ''; },
      readdir: async () => { fileOpsOccurred = true; return []; },
      isDirectory: async () => { fileOpsOccurred = true; return false; },
    } as WorkspaceInitFileSystem,
    installSkillsFs: {
      exists: async () => { fileOpsOccurred = true; return false; },
      mkdir: async () => { fileOpsOccurred = true; },
      writeFile: async () => { fileOpsOccurred = true; },
    } as InstallSkillsFileSystem,
  };
}

// --- Tests ---

describe('Property 2: Non-Zero Exit on Failure (command-level)', () => {
  it('create-spec with invalid name returns failure result', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidSpecName, async (name) => {
        const mockFs: CreateSpecFileSystem = {
          exists: async () => false,
          mkdir: async () => {},
          writeFile: async () => {},
        };
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('workspace-init with invalid platform returns failure result', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidPlatform, async (platform) => {
        const mockFs: WorkspaceInitFileSystem = {
          exists: async () => false,
          mkdir: async () => {},
          writeFile: async () => {},
          readFile: async () => '',
          readdir: async () => [],
          isDirectory: async () => false,
        };
        const adapters = createAdapters();
        const command = new WorkspaceInitCommand(mockFs, adapters);
        const result = await command.execute({ platform: platform as PlatformId, workspaceRoot: '/workspace' });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('install-skills with invalid platform returns failure result', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidPlatform, async (platform) => {
        const mockFs: InstallSkillsFileSystem = {
          exists: async () => false,
          mkdir: async () => {},
          writeFile: async () => {},
        };
        const registry = new SkillRegistry();
        allSkills.forEach(s => registry.register(s));
        const adapters = createAdapters();
        const command = new InstallSkillsCommand(registry, adapters, mockFs);
        const result = await command.execute({ platform: platform as PlatformId, workspaceRoot: '/workspace' });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('run-task with invalid task ID returns failure result', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidTaskId, async (taskId) => {
        const mockFs: RunTaskFileSystem = {
          exists: async () => true,
          readFile: async () => '- [ ] 1.1 some task',
        };
        const command = new RunTaskCommand(mockFs);
        const result = await command.execute({
          spec: 'valid-spec',
          taskId,
          status: 'completed',
          workspaceRoot: '/workspace',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: Validation Before File Operations', () => {
  it('create-spec with invalid name does not touch filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidSpecName, async (name) => {
        const tracking = createTrackingFs();
        const command = new CreateSpecCommand(tracking.specFs);
        await command.execute({ name, workspaceRoot: '/workspace' });

        expect(tracking.fileOpsOccurred()).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('workspace-init with invalid platform does not touch filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidPlatform, async (platform) => {
        const tracking = createTrackingFs();
        const adapters = createAdapters();
        const command = new WorkspaceInitCommand(tracking.workspaceInitFs, adapters);
        await command.execute({ platform: platform as PlatformId, workspaceRoot: '/workspace' });

        expect(tracking.fileOpsOccurred()).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('install-skills with invalid platform does not touch filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidPlatform, async (platform) => {
        const tracking = createTrackingFs();
        const registry = new SkillRegistry();
        allSkills.forEach(s => registry.register(s));
        const adapters = createAdapters();
        const command = new InstallSkillsCommand(registry, adapters, tracking.installSkillsFs);
        await command.execute({ platform: platform as PlatformId, workspaceRoot: '/workspace' });

        expect(tracking.fileOpsOccurred()).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('run-task with invalid spec name does not touch filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidSpecName, async (specName) => {
        const tracking = createTrackingFs();
        const command = new RunTaskCommand(tracking.runTaskFs);
        await command.execute({
          spec: specName,
          taskId: '1.1',
          status: 'completed',
          workspaceRoot: '/workspace',
        });

        expect(tracking.fileOpsOccurred()).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('run-task with invalid task ID does not touch filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidTaskId, async (taskId) => {
        const tracking = createTrackingFs();
        const command = new RunTaskCommand(tracking.runTaskFs);
        await command.execute({
          spec: 'valid-spec',
          taskId,
          status: 'completed',
          workspaceRoot: '/workspace',
        });

        expect(tracking.fileOpsOccurred()).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
