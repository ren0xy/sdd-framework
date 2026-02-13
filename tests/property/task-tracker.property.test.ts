/**
 * Property-Based Tests for Task Tracker
 * 
 * Feature: 000-sdd-framework-init
 * Property 8: Task Status Updates Correctly
 * Property 9: Task Text Preserved During Status Update
 * Property 10: Sequential Task Execution Updates All Statuses
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskTracker } from '../../src/tasks/task-tracker';
import type { TaskStatus } from '../../src/types';

/**
 * Generator for valid task IDs (e.g., "1.1", "2.3", "10.5")
 */
const arbitraryTaskId = fc.tuple(
  fc.integer({ min: 1, max: 99 }),
  fc.integer({ min: 1, max: 99 })
).map(([major, minor]) => `${major}.${minor}`);

/**
 * Generator for task text (description)
 */
const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'.split('')),
  { minLength: 5, maxLength: 50 }
).filter(s => s.trim().length > 0);

/**
 * Generator for valid task statuses
 */
const arbitraryTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'not_started', 'in_progress', 'completed', 'failed'
);

/**
 * Generator for checkbox characters
 */
const arbitraryCheckboxChar = fc.constantFrom(' ', 'x', '-', '!');

/**
 * Create a task line with given status character
 */
function createTaskLine(taskId: string, text: string, statusChar: string): string {
  return `- [${statusChar}] ${taskId} ${text}`;
}

/**
 * Create a tasks.md content with multiple tasks
 */
function createTasksContent(tasks: Array<{ id: string; text: string; statusChar: string }>): string {
  const lines = [
    '# Tasks',
    '',
    '## Implementation',
    ''
  ];
  for (const task of tasks) {
    lines.push(createTaskLine(task.id, task.text, task.statusChar));
  }
  return lines.join('\n');
}

describe('Property 8: Task Status Updates Correctly', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.5**
   * 
   * Property: For any valid task identifier and status transition, updating the task
   * SHALL change only the checkbox character to the correct status indicator.
   */
  it('parseTaskStatus correctly identifies status from checkbox character', () => {
    fc.assert(
      fc.property(
        arbitraryTaskId,
        arbitraryTaskText,
        arbitraryCheckboxChar,
        (taskId, taskText, statusChar) => {
          const tracker = new TaskTracker();
          const content = createTaskLine(taskId, taskText, statusChar);
          
          const status = tracker.parseTaskStatus(content, taskId);
          
          // Verify correct status mapping
          switch (statusChar) {
            case ' ':
              expect(status).toBe('not_started');
              break;
            case 'x':
              expect(status).toBe('completed');
              break;
            case '-':
              expect(status).toBe('in_progress');
              break;
            case '!':
              expect(status).toBe('failed');
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: statusToChar produces correct checkbox character for each status
   */
  it('statusToChar produces correct checkbox character for each status', () => {
    fc.assert(
      fc.property(arbitraryTaskStatus, (status) => {
        const tracker = new TaskTracker();
        const char = tracker.statusToChar(status);
        
        switch (status) {
          case 'not_started':
            expect(char).toBe(' ');
            break;
          case 'in_progress':
            expect(char).toBe('-');
            break;
          case 'completed':
            expect(char).toBe('x');
            break;
          case 'failed':
            expect(char).toBe('!');
            break;
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: replaceTaskStatus changes only the checkbox character
   */
  it('replaceTaskStatus changes only the checkbox character to correct indicator', () => {
    fc.assert(
      fc.property(
        arbitraryTaskId,
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        (taskId, taskText, originalChar, newStatus) => {
          const tracker = new TaskTracker();
          const originalContent = createTaskLine(taskId, taskText, originalChar);
          
          const updatedContent = tracker.replaceTaskStatus(originalContent, taskId, newStatus);
          
          // Verify the new status character is correct
          const expectedChar = tracker.statusToChar(newStatus);
          const expectedLine = createTaskLine(taskId, taskText, expectedChar);
          
          expect(updatedContent).toBe(expectedLine);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Round-trip status update preserves status
   */
  it('round-trip: parse -> replace -> parse returns the new status', () => {
    fc.assert(
      fc.property(
        arbitraryTaskId,
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        (taskId, taskText, originalChar, newStatus) => {
          const tracker = new TaskTracker();
          const originalContent = createTaskLine(taskId, taskText, originalChar);
          
          // Replace status
          const updatedContent = tracker.replaceTaskStatus(originalContent, taskId, newStatus);
          
          // Parse the updated content
          const parsedStatus = tracker.parseTaskStatus(updatedContent, taskId);
          
          // Should match the new status
          expect(parsedStatus).toBe(newStatus);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 9: Task Text Preserved During Status Update', () => {
  /**
   * **Validates: Requirements 5.4**
   * 
   * Property: For any task status update operation, the task description text
   * SHALL remain identical before and after the update.
   */
  it('task text remains unchanged after status update', () => {
    fc.assert(
      fc.property(
        arbitraryTaskId,
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        (taskId, taskText, originalChar, newStatus) => {
          const tracker = new TaskTracker();
          const originalContent = createTaskLine(taskId, taskText, originalChar);
          
          const updatedContent = tracker.replaceTaskStatus(originalContent, taskId, newStatus);
          
          // Extract task text from both versions (everything after the checkbox and task ID)
          const originalTextMatch = originalContent.match(/- \[.\] \d+\.\d+ (.+)$/);
          const updatedTextMatch = updatedContent.match(/- \[.\] \d+\.\d+ (.+)$/);
          
          expect(originalTextMatch).not.toBeNull();
          expect(updatedTextMatch).not.toBeNull();
          expect(updatedTextMatch![1]).toBe(originalTextMatch![1]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Task ID remains unchanged after status update
   */
  it('task ID remains unchanged after status update', () => {
    fc.assert(
      fc.property(
        arbitraryTaskId,
        arbitraryTaskText,
        arbitraryCheckboxChar,
        arbitraryTaskStatus,
        (taskId, taskText, originalChar, newStatus) => {
          const tracker = new TaskTracker();
          const originalContent = createTaskLine(taskId, taskText, originalChar);
          
          const updatedContent = tracker.replaceTaskStatus(originalContent, taskId, newStatus);
          
          // Extract task ID from both versions
          const originalIdMatch = originalContent.match(/- \[.\] (\d+\.\d+)/);
          const updatedIdMatch = updatedContent.match(/- \[.\] (\d+\.\d+)/);
          
          expect(originalIdMatch).not.toBeNull();
          expect(updatedIdMatch).not.toBeNull();
          expect(updatedIdMatch![1]).toBe(originalIdMatch![1]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multi-task document preserves all other tasks when updating one
   */
  it('updating one task preserves all other tasks in document', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(arbitraryTaskId, arbitraryTaskText, arbitraryCheckboxChar),
          { minLength: 2, maxLength: 5 }
        ).map(tasks => {
          // Ensure unique task IDs
          return tasks.map(([id, text, char], i) => ({
            id: `${i + 1}.1`,
            text,
            statusChar: char
          }));
        }),
        fc.integer({ min: 0, max: 4 }),
        arbitraryTaskStatus,
        (tasks, targetIndex, newStatus) => {
          // Ensure targetIndex is within bounds
          const safeIndex = targetIndex % tasks.length;
          const targetTask = tasks[safeIndex];
          
          const tracker = new TaskTracker();
          const originalContent = createTasksContent(tasks);
          
          const updatedContent = tracker.replaceTaskStatus(
            originalContent, 
            targetTask.id, 
            newStatus
          );
          
          // Verify all other tasks are unchanged
          for (let i = 0; i < tasks.length; i++) {
            if (i === safeIndex) continue;
            
            const task = tasks[i];
            const expectedLine = createTaskLine(task.id, task.text, task.statusChar);
            expect(updatedContent).toContain(expectedLine);
          }
          
          // Verify target task has new status
          const expectedChar = tracker.statusToChar(newStatus);
          const expectedTargetLine = createTaskLine(targetTask.id, targetTask.text, expectedChar);
          expect(updatedContent).toContain(expectedTargetLine);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 10: Sequential Task Execution Updates All Statuses', () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-tracker-test-'));
    tempFile = path.join(tempDir, 'tasks.md');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * **Validates: Requirements 5.3**
   * 
   * Property: For any list of task identifiers, running tasks sequentially SHALL
   * update each task's status in order, with final statuses reflecting execution results.
   */
  it('runTasks updates all task statuses sequentially', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(arbitraryTaskText),
          { minLength: 2, maxLength: 4 }
        ).map(tasks => {
          return tasks.map(([ text], i) => ({
            id: `${i + 1}.1`,
            text,
            statusChar: ' ' // All start as not_started
          }));
        }),
        async (tasks) => {
          const tracker = new TaskTracker();
          const content = createTasksContent(tasks);
          await fs.writeFile(tempFile, content, 'utf-8');
          
          const taskIds = tasks.map(t => t.id);
          const executors = new Map<string, () => Promise<void>>();
          
          // All executors succeed
          for (const taskId of taskIds) {
            executors.set(taskId, async () => {
              // Simulate some work
              await new Promise(resolve => setTimeout(resolve, 1));
            });
          }
          
          const results = await tracker.runTasks(tempFile, taskIds, executors);
          
          // Verify all tasks completed
          expect(results.length).toBe(taskIds.length);
          for (const result of results) {
            expect(result.newStatus).toBe('completed');
          }
          
          // Verify file content reflects completed status
          const finalContent = await fs.readFile(tempFile, 'utf-8');
          for (const taskId of taskIds) {
            const status = tracker.parseTaskStatus(finalContent, taskId);
            expect(status).toBe('completed');
          }
        }
      ),
      { numRuns: 20 } // Fewer runs due to async file operations
    );
  });

  /**
   * Property: Failed tasks are marked as failed with error message
   */
  it('failed tasks are marked as failed', { timeout: 15000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskText,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (taskText, errorMessage) => {
          const tracker = new TaskTracker();
          const tasks = [{ id: '1.1', text: taskText, statusChar: ' ' }];
          const content = createTasksContent(tasks);
          await fs.writeFile(tempFile, content, 'utf-8');
          
          const executors = new Map<string, () => Promise<void>>();
          executors.set('1.1', async () => {
            throw new Error(errorMessage);
          });
          
          const results = await tracker.runTasks(tempFile, ['1.1'], executors);
          
          expect(results.length).toBe(1);
          expect(results[0].newStatus).toBe('failed');
          expect(results[0].error).toBe(errorMessage);
          
          // Verify file content reflects failed status
          const finalContent = await fs.readFile(tempFile, 'utf-8');
          const status = tracker.parseTaskStatus(finalContent, '1.1');
          expect(status).toBe('failed');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Tasks without executors are marked as failed
   */
  it('tasks without executors are marked as failed', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTaskText,
        async (taskText) => {
          const tracker = new TaskTracker();
          const tasks = [{ id: '1.1', text: taskText, statusChar: ' ' }];
          const content = createTasksContent(tasks);
          await fs.writeFile(tempFile, content, 'utf-8');
          
          // Empty executors map
          const executors = new Map<string, () => Promise<void>>();
          
          const results = await tracker.runTasks(tempFile, ['1.1'], executors);
          
          expect(results.length).toBe(1);
          expect(results[0].newStatus).toBe('failed');
          expect(results[0].error).toBe('No executor found');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Mixed success/failure results are correctly tracked
   */
  it('mixed success and failure results are correctly tracked', { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryTaskText, { minLength: 3, maxLength: 3 }),
        fc.integer({ min: 0, max: 2 }),
        async (taskTexts, failIndex) => {
          const tracker = new TaskTracker();
          const tasks = taskTexts.map((text, i) => ({
            id: `${i + 1}.1`,
            text,
            statusChar: ' '
          }));
          const content = createTasksContent(tasks);
          await fs.writeFile(tempFile, content, 'utf-8');
          
          const taskIds = tasks.map(t => t.id);
          const executors = new Map<string, () => Promise<void>>();
          
          for (let i = 0; i < taskIds.length; i++) {
            const taskId = taskIds[i];
            if (i === failIndex) {
              executors.set(taskId, async () => {
                throw new Error('Task failed');
              });
            } else {
              executors.set(taskId, async () => {
                await new Promise(resolve => setTimeout(resolve, 1));
              });
            }
          }
          
          const results = await tracker.runTasks(tempFile, taskIds, executors);
          
          expect(results.length).toBe(taskIds.length);
          
          for (let i = 0; i < results.length; i++) {
            if (i === failIndex) {
              expect(results[i].newStatus).toBe('failed');
            } else {
              expect(results[i].newStatus).toBe('completed');
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
