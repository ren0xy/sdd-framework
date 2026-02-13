/**
 * Property-Based Tests for Tasks Document Generator
 * 
 * Feature: 000-sdd-framework-init
 * Property 7: Tasks Document Contains Checkbox Syntax
 * 
 * Validates: Requirements 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TasksGenerator, TaskInput } from '../../src/documents/tasks-generator';
import type { TaskStatus } from '../../src/types';

/**
 * Generator for valid task IDs (e.g., "1", "1.1", "2.3.1")
 */
const arbitraryTaskId = fc.oneof(
  fc.integer({ min: 1, max: 99 }).map(n => `${n}`),
  fc.tuple(
    fc.integer({ min: 1, max: 99 }),
    fc.integer({ min: 1, max: 99 })
  ).map(([major, minor]) => `${major}.${minor}`)
);

/**
 * Generator for task text (description)
 */
const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'.split('')),
  { minLength: 3, maxLength: 40 }
).filter(s => s.trim().length > 0);

/**
 * Generator for valid task statuses
 */
const arbitraryTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'not_started', 'in_progress', 'completed', 'failed'
);

/**
 * Generator for a simple task input (no subtasks)
 */
const arbitrarySimpleTaskInput: fc.Arbitrary<TaskInput> = fc.record({
  id: arbitraryTaskId,
  text: arbitraryTaskText,
  status: fc.option(arbitraryTaskStatus, { nil: undefined })
});

/**
 * Generator for task input with optional subtasks (1 level deep)
 */
const arbitraryTaskInput: fc.Arbitrary<TaskInput> = fc.record({
  id: arbitraryTaskId,
  text: arbitraryTaskText,
  status: fc.option(arbitraryTaskStatus, { nil: undefined }),
  subtasks: fc.option(
    fc.array(arbitrarySimpleTaskInput, { minLength: 0, maxLength: 3 }),
    { nil: undefined }
  ),
  requirements: fc.option(
    fc.array(fc.stringOf(fc.constantFrom(...'0123456789.'.split('')), { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  )
});

/**
 * Valid checkbox pattern: - [ ], - [x], - [-], or - [!]
 */
const VALID_CHECKBOX_PATTERN = /- \[[ x\-!]\]/;

/**
 * Extract all task lines from generated content
 */
function extractTaskLines(content: string): string[] {
  return content.split('\n').filter(line => line.trim().match(/^- \[.\]/));
}

describe('Property 7: Tasks Document Contains Checkbox Syntax', () => {
  /**
   * **Validates: Requirements 4.3**
   * 
   * Property: For any generated tasks.md file, all task items SHALL contain
   * valid checkbox syntax matching the pattern `- [ ]` or `- [x]` or `- [-]` or `- [!]`.
   */
  it('all generated task lines contain valid checkbox syntax', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTaskInput, { minLength: 1, maxLength: 10 }),
        (tasks) => {
          const generator = new TasksGenerator();
          const content = generator.generate(tasks);
          
          const taskLines = extractTaskLines(content);
          
          // Every task line must have valid checkbox syntax
          for (const line of taskLines) {
            expect(line).toMatch(VALID_CHECKBOX_PATTERN);
          }
          
          // Must have at least as many task lines as input tasks
          expect(taskLines.length).toBeGreaterThanOrEqual(tasks.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Single task line generation produces valid checkbox
   */
  it('generateTaskLine produces valid checkbox syntax for any status', () => {
    fc.assert(
      fc.property(
        arbitraryTaskInput,
        (task) => {
          const generator = new TasksGenerator();
          const line = generator.generateTaskLine(task);
          
          expect(line).toMatch(VALID_CHECKBOX_PATTERN);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Status mapping produces correct checkbox character
   */
  it('statusToCheckboxChar produces only valid checkbox characters', () => {
    fc.assert(
      fc.property(
        arbitraryTaskStatus,
        (status) => {
          const generator = new TasksGenerator();
          const char = generator.statusToCheckboxChar(status);
          
          // Must be one of the valid checkbox characters
          expect([' ', 'x', '-', '!']).toContain(char);
          
          // Verify correct mapping
          switch (status) {
            case 'not_started':
              expect(char).toBe(' ');
              break;
            case 'completed':
              expect(char).toBe('x');
              break;
            case 'in_progress':
              expect(char).toBe('-');
              break;
            case 'failed':
              expect(char).toBe('!');
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Generated document with subtasks has valid checkboxes for all levels
   */
  it('subtasks also have valid checkbox syntax', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryTaskInput, { minLength: 1, maxLength: 5 }),
        (tasks) => {
          const generator = new TasksGenerator();
          const content = generator.generate(tasks);
          
          const taskLines = extractTaskLines(content);
          
          // Count expected task lines (including subtasks)
          let expectedCount = 0;
          for (const task of tasks) {
            expectedCount += 1;
            if (task.subtasks) {
              expectedCount += task.subtasks.length;
            }
          }
          
          // All task lines must have valid checkbox
          for (const line of taskLines) {
            expect(line).toMatch(VALID_CHECKBOX_PATTERN);
          }
          
          expect(taskLines.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Checkbox character is exactly one character
   */
  it('checkbox contains exactly one status character', () => {
    fc.assert(
      fc.property(
        arbitraryTaskInput,
        (task) => {
          const generator = new TasksGenerator();
          const line = generator.generateTaskLine(task);
          
          // Extract the checkbox portion
          const checkboxMatch = line.match(/- \[(.)\]/);
          expect(checkboxMatch).not.toBeNull();
          expect(checkboxMatch![1].length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Task ID and text are preserved in generated line
   */
  it('task ID and text appear in generated line', () => {
    fc.assert(
      fc.property(
        arbitraryTaskInput,
        (task) => {
          const generator = new TasksGenerator();
          const line = generator.generateTaskLine(task);
          
          expect(line).toContain(task.id);
          expect(line).toContain(task.text);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default status is not_started (space checkbox)
   */
  it('tasks without explicit status default to not_started checkbox', () => {
    fc.assert(
      fc.property(
        arbitraryTaskId,
        arbitraryTaskText,
        (id, text) => {
          const generator = new TasksGenerator();
          const task: TaskInput = { id, text }; // No status specified
          const line = generator.generateTaskLine(task);
          
          // Should have space (not_started) checkbox
          expect(line).toMatch(/- \[ \]/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
