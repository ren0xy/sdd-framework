/**
 * Property-Based Tests for Backward Compatibility
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 19: Backward Compatibility
 * 
 * Validates: Requirements 8.1, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as nodePath from 'path';
import * as os from 'os';
import { RunTaskCommand } from '../../src/commands/run-task-command';
import type { RunTaskFileSystem } from '../../src/commands/run-task-command';
import { CreateSpecCommand } from '../../src/commands/create-spec-command';
import type { CreateSpecFileSystem } from '../../src/commands/create-spec-command';
import { TaskTracker } from '../../src/tasks/task-tracker';
import type { TaskStatus } from '../../src/types';

// --- Generators ---

const arbitraryTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'not_started', 'in_progress', 'completed', 'failed'
);

const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')),
  { minLength: 3, maxLength: 30 }
).filter(s => s.trim().length > 0);

const arbitraryCheckboxChar = fc.constantFrom(' ', 'x', '-', '!');

// --- Tests ---

describe('Property 19: Backward Compatibility', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'backward-compat-'));
  });

  afterEach(async () => {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('CLI works with manually created spec folders (no .config.kiro)', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        async (taskText, originalChar, newStatus) => {
          const specName = 'manual-spec';
          const taskId = '1.1';

          // Create a manually-structured spec (no .config.kiro, just tasks.md)
          const specDir = nodePath.join(tempDir, '.kiro', 'specs', specName);
          await fs.mkdir(specDir, { recursive: true });

          const content = [
            '# Tasks',
            '',
            `- [${originalChar}] ${taskId} ${taskText}`,
          ].join('\n');
          const tasksPath = nodePath.join(specDir, 'tasks.md');
          await fs.writeFile(tasksPath, content, 'utf-8');

          const realFs: RunTaskFileSystem = {
            exists: async (p: string) => {
              try { await fs.access(p); return true; } catch { return false; }
            },
            readFile: async (p: string) => fs.readFile(p, 'utf-8'),
          };

          const tracker = new TaskTracker();
          const command = new RunTaskCommand(realFs, tracker);
          const result = await command.execute({
            spec: specName,
            taskId,
            status: newStatus,
            workspaceRoot: tempDir,
          });

          expect(result.success).toBe(true);
          expect(result.data!.newStatus).toBe(newStatus);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('CLI works with various tasks.md formats (extra whitespace, headers)', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskText,
        arbitraryTaskStatus,
        fc.constantFrom(
          // Different header styles
          '# Implementation Plan\n\n## Overview\n\nSome overview text.\n\n## Tasks\n\n',
          '# Tasks\n\n',
          '## Tasks\n\n',
          '# My Feature Tasks\n\n## Implementation\n\n',
        ),
        async (taskText, newStatus, header) => {
          const specName = 'format-spec';
          const taskId = '1.1';

          const specDir = nodePath.join(tempDir, '.kiro', 'specs', specName);
          await fs.mkdir(specDir, { recursive: true });

          const content = `${header}- [ ] ${taskId} ${taskText}\n`;
          const tasksPath = nodePath.join(specDir, 'tasks.md');
          await fs.writeFile(tasksPath, content, 'utf-8');

          const realFs: RunTaskFileSystem = {
            exists: async (p: string) => {
              try { await fs.access(p); return true; } catch { return false; }
            },
            readFile: async (p: string) => fs.readFile(p, 'utf-8'),
          };

          const tracker = new TaskTracker();
          const command = new RunTaskCommand(realFs, tracker);
          const result = await command.execute({
            spec: specName,
            taskId,
            status: newStatus,
            workspaceRoot: tempDir,
          });

          expect(result.success).toBe(true);

          // Verify the header content is preserved
          const updatedContent = await fs.readFile(tasksPath, 'utf-8');
          expect(updatedContent).toContain(header.trim());
        }
      ),
      { numRuns: 30 }
    );
  });

  it('CLI works with tasks.md containing optional marker (*) after checkbox', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        async (taskText, originalChar, newStatus) => {
          const specName = 'marker-spec';
          const taskId = '1.2';

          const specDir = nodePath.join(tempDir, '.kiro', 'specs', specName);
          await fs.mkdir(specDir, { recursive: true });

          // Use the optional marker (*) format like in the actual tasks.md
          const content = [
            '# Tasks',
            '',
            `- [${originalChar}]* ${taskId} ${taskText}`,
          ].join('\n');
          const tasksPath = nodePath.join(specDir, 'tasks.md');
          await fs.writeFile(tasksPath, content, 'utf-8');

          const realFs: RunTaskFileSystem = {
            exists: async (p: string) => {
              try { await fs.access(p); return true; } catch { return false; }
            },
            readFile: async (p: string) => fs.readFile(p, 'utf-8'),
          };

          const tracker = new TaskTracker();
          const command = new RunTaskCommand(realFs, tracker);
          const result = await command.execute({
            spec: specName,
            taskId,
            status: newStatus,
            workspaceRoot: tempDir,
          });

          expect(result.success).toBe(true);
          expect(result.data!.newStatus).toBe(newStatus);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('CreateSpecCommand does not require existing workspace structure', async () => {
    let runIndex = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(
          fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
          { minLength: 3, maxLength: 15 }
        ),
        async (name) => {
          // Use a unique directory per iteration to avoid spec-already-exists conflicts
          const freshDir = nodePath.join(tempDir, `fresh-${runIndex++}`);
          await fs.mkdir(freshDir, { recursive: true });

          const realFs: CreateSpecFileSystem = {
            exists: async (p: string) => {
              try { await fs.access(p); return true; } catch { return false; }
            },
            mkdir: async (p: string) => { await fs.mkdir(p, { recursive: true }); },
            writeFile: async (p: string, content: string) => { await fs.writeFile(p, content, 'utf-8'); },
          };

          const command = new CreateSpecCommand(realFs);
          const result = await command.execute({ name, workspaceRoot: freshDir });

          expect(result.success).toBe(true);

          // Verify files actually exist
          const specDir = nodePath.join(freshDir, '.kiro', 'specs', name);
          const stat = await fs.stat(specDir);
          expect(stat.isDirectory()).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });
});
