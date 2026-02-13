/**
 * Property-Based Tests for RunTaskCommand
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 8: Task Status Update Correctness
 * Property 9: Task Update Status Round-Trip
 * Property 10: Non-Existent Task Preservation
 * 
 * Validates: Requirements 3.1, 3.3, 3.4, 3.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as nodePath from 'path';
import * as os from 'os';
import { RunTaskCommand } from '../../src/commands/run-task-command';
import type { RunTaskFileSystem } from '../../src/commands/run-task-command';
import { TaskTracker } from '../../src/tasks/task-tracker';
import type { TaskStatus } from '../../src/types';

// --- Generators ---

const arbitraryTaskId = fc.tuple(
  fc.integer({ min: 1, max: 99 }),
  fc.integer({ min: 1, max: 99 })
).map(([major, minor]) => `${major}.${minor}`);

const arbitraryTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'not_started', 'in_progress', 'completed', 'failed'
);

const arbitraryCheckboxChar = fc.constantFrom(' ', 'x', '-', '!');

const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')),
  { minLength: 3, maxLength: 30 }
).filter(s => s.trim().length > 0);

const arbitraryKebabCase = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 20 }
).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

// --- Helpers ---

function createTaskLine(taskId: string, text: string, statusChar: string): string {
  return `- [${statusChar}] ${taskId} ${text}`;
}

function createTasksContent(tasks: Array<{ id: string; text: string; statusChar: string }>): string {
  return [
    '# Implementation Plan',
    '',
    '## Tasks',
    '',
    ...tasks.map(t => createTaskLine(t.id, t.text, t.statusChar))
  ].join('\n');
}

// --- Tests using real filesystem (for atomic write testing) ---

describe('Property 8: Task Status Update Correctness (via RunTaskCommand)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'run-task-cmd-'));
  });

  afterEach(async () => {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('updates task status and returns previous + new status', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryKebabCase,
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        async (specName, taskText, originalChar, newStatus) => {
          const taskId = '1.1';
          const content = createTasksContent([{ id: taskId, text: taskText, statusChar: originalChar }]);

          // Set up real file
          const specDir = nodePath.join(tempDir, '.kiro', 'specs', specName);
          await fs.mkdir(specDir, { recursive: true });
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
          expect(result.data).toBeDefined();
          expect(result.data!.newStatus).toBe(newStatus);
          expect(result.data!.taskId).toBe(taskId);

          // Verify file was actually updated
          const updatedContent = await fs.readFile(tasksPath, 'utf-8');
          const parsedStatus = tracker.parseTaskStatus(updatedContent, taskId);
          expect(parsedStatus).toBe(newStatus);
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Property 9: Task Update Status Round-Trip (via RunTaskCommand)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'run-task-rt-'));
  });

  afterEach(async () => {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('status round-trips through update and re-read', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskStatus,
        arbitraryTaskStatus,
        async (firstStatus, secondStatus) => {
          const specName = 'roundtrip-spec';
          const taskId = '1.1';
          const content = createTasksContent([{ id: taskId, text: 'test task', statusChar: ' ' }]);

          const specDir = nodePath.join(tempDir, '.kiro', 'specs', specName);
          await fs.mkdir(specDir, { recursive: true });
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

          // First update
          const r1 = await command.execute({ spec: specName, taskId, status: firstStatus, workspaceRoot: tempDir });
          expect(r1.success).toBe(true);

          // Second update
          const r2 = await command.execute({ spec: specName, taskId, status: secondStatus, workspaceRoot: tempDir });
          expect(r2.success).toBe(true);
          expect(r2.data!.previousStatus).toBe(firstStatus);
          expect(r2.data!.newStatus).toBe(secondStatus);
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Property 10: Non-Existent Task Preservation (via RunTaskCommand)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'run-task-ne-'));
  });

  afterEach(async () => {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('returns error for non-existent task without modifying file', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskText,
        arbitraryTaskStatus,
        async (taskText, status) => {
          const specName = 'nomod-spec';
          const existingTaskId = '1.1';
          const nonExistentTaskId = '99.99';
          const content = createTasksContent([{ id: existingTaskId, text: taskText, statusChar: ' ' }]);

          const specDir = nodePath.join(tempDir, '.kiro', 'specs', specName);
          await fs.mkdir(specDir, { recursive: true });
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
            taskId: nonExistentTaskId,
            status,
            workspaceRoot: tempDir,
          });

          expect(result.success).toBe(false);
          expect(result.error!.code).toBe('TASK_NOT_FOUND');

          // File should be unchanged
          const afterContent = await fs.readFile(tasksPath, 'utf-8');
          expect(afterContent).toBe(content);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('returns error when spec does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, arbitraryTaskStatus, async (specName, status) => {
        const mockFs: RunTaskFileSystem = {
          exists: async () => false,
          readFile: async () => { throw new Error('not found'); },
        };

        const command = new RunTaskCommand(mockFs);
        const result = await command.execute({
          spec: specName,
          taskId: '1.1',
          status,
          workspaceRoot: '/workspace',
        });

        expect(result.success).toBe(false);
        expect(result.error!.code).toBe('SPEC_NOT_FOUND');
      }),
      { numRuns: 100 }
    );
  });
});
