/**
 * Property-Based Tests for run-task instruction template
 *
 * Feature: 012-run-task-instruction-template
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { composeSkillInstruction } from '../../src/instructions/instruction-composer';

// ── Generators ──────────────────────────────────────────────────────────────

const arbitraryKebabCase = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 20 }
).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

const arbitraryTaskId = fc.tuple(
  fc.integer({ min: 1, max: 9 }),
  fc.integer({ min: 1, max: 9 }),
  fc.integer({ min: 1, max: 9 })
).map(([a, b, c]) => `${a}.${b}.${c}`);

// ── Property 1: run-task template resolves taskId and specName placeholders ─

describe('Property 1: run-task template resolves taskId and specName placeholders', () => {
  /**
   * **Validates: Requirements 1.2, 2.2**
   *
   * For any valid specName and taskId,
   * composeSkillInstruction('run-task', { taskId, specName }) produces
   * a string containing both values.
   */
  it('output contains both taskId and specName', () => {
    fc.assert(
      fc.property(arbitraryKebabCase, arbitraryTaskId, (specName, taskId) => {
        const result = composeSkillInstruction('run-task', { taskId, specName });

        expect(result).toContain(taskId);
        expect(result).toContain(specName);
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 2: output is single-line plain text with no control characters ─

describe('Property 2: output is single-line plain text with no control characters', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any valid specName and taskId,
   * the composed instruction is single-line and contains no control characters.
   */
  it('output is single-line with no control characters', () => {
    fc.assert(
      fc.property(arbitraryKebabCase, arbitraryTaskId, (specName, taskId) => {
        const result = composeSkillInstruction('run-task', { taskId, specName });

        expect(result).not.toContain('\n');
        expect(result).not.toContain('\r');
        // eslint-disable-next-line no-control-regex
        expect(result).not.toMatch(/[\x00-\x1f\x7f]/);
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
