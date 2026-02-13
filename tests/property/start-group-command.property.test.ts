/**
 * Property-Based Tests for start-task-group instruction template and StartGroupCommand
 *
 * Feature: 007-task-execution-skill
 * Property 5: Instruction template produces valid output
 * Unit tests: StartGroupCommand validation
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { composeSkillInstruction } from '../../src/instructions/instruction-composer';
import { StartGroupCommand } from '../../src/commands/start-group-command';

// ── Generators ──────────────────────────────────────────────────────────────

const arbitraryKebabCase = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 20 }
).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

const arbitraryGroupId = fc.integer({ min: 1, max: 99 }).map(n => String(n));

// ── Property 5: Instruction template produces valid output ──────────────────

describe('Property 5: Instruction template produces valid output', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any non-empty specName and numeric groupId,
   * composeSkillInstruction('start-task-group', ...) produces a single-line
   * string containing both values.
   */
  it('instruction contains specName and groupId, is single-line', () => {
    fc.assert(
      fc.property(arbitraryKebabCase, arbitraryGroupId, (specName, groupId) => {
        const result = composeSkillInstruction('start-task-group', { specName, groupId });

        expect(result).toContain(specName);
        expect(result).toContain(groupId);
        expect(result).not.toContain('\n');
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

// ── Unit tests: StartGroupCommand ───────────────────────────────────────────

describe('StartGroupCommand', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   */
  it('returns success with instruction for valid inputs', async () => {
    const cmd = new StartGroupCommand();
    const result = await cmd.execute({ spec: 'my-feature', group: '1' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.instruction).toContain('my-feature');
    expect(result.data!.instruction).toContain('1');
  });

  /**
   * **Validates: Requirements 6.3**
   */
  it('returns error when --spec is missing', async () => {
    const cmd = new StartGroupCommand();
    const result = await cmd.execute({ spec: '', group: '1' });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('MISSING_ARGUMENT');
  });

  /**
   * **Validates: Requirements 6.4**
   */
  it('returns error when --group is missing', async () => {
    const cmd = new StartGroupCommand();
    const result = await cmd.execute({ spec: 'my-feature', group: '' });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('MISSING_ARGUMENT');
  });

  /**
   * **Validates: Requirements 6.4**
   */
  it('returns error for non-numeric group ID', async () => {
    const cmd = new StartGroupCommand();
    const result = await cmd.execute({ spec: 'my-feature', group: 'abc' });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('MISSING_ARGUMENT');
  });

  /**
   * **Validates: Requirements 6.5**
   */
  it('returns error for invalid spec name', async () => {
    const cmd = new StartGroupCommand();
    const result = await cmd.execute({ spec: 'INVALID NAME', group: '1' });

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('INVALID_SPEC_NAME');
  });
});
