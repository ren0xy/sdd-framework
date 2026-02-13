/**
 * Property-Based Tests for JSON Output
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 1: JSON Output Validity
 * 
 * Validates: Requirements 1.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { JSONFormatter, TextFormatter } from '../../src/commands/output-formatter';
import { successResult, errorResult, ErrorCode } from '../../src/commands/command-result';
import type { CommandResult } from '../../src/commands/command-result';

// --- Generators ---

const arbitraryCommandName = fc.constantFrom(
  'create-spec', 'run-task', 'workspace-init', 'install-skills', 'help', 'version'
);

const arbitraryErrorCode = fc.constantFrom(
  ...Object.values(ErrorCode)
);

const arbitraryData = fc.oneof(
  fc.record({
    path: fc.string(),
    files: fc.array(fc.string(), { maxLength: 5 }),
  }),
  fc.record({
    platform: fc.constantFrom('kiro', 'claude-code', 'codex', 'antigravity'),
    installed: fc.array(fc.string(), { maxLength: 5 }),
    skipped: fc.array(fc.string(), { maxLength: 5 }),
  }),
  fc.record({
    taskId: fc.string(),
    previousStatus: fc.constantFrom('not_started', 'in_progress', 'completed', 'failed'),
    newStatus: fc.constantFrom('not_started', 'in_progress', 'completed', 'failed'),
  }),
  fc.constant({ help: 'some help text' }),
  fc.constant({ version: '1.0.0' })
);

const arbitrarySuccessResult: fc.Arbitrary<CommandResult> = fc.tuple(
  arbitraryCommandName,
  arbitraryData,
  fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }), { nil: undefined })
).map(([command, data, warnings]) => successResult(command, data, warnings));

const arbitraryErrorResult: fc.Arbitrary<CommandResult> = fc.tuple(
  arbitraryCommandName,
  arbitraryErrorCode,
  fc.string({ minLength: 1, maxLength: 100 }),
  fc.option(
    fc.dictionary(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.array(fc.string(), { maxLength: 3 }))
    ),
    { nil: undefined }
  )
).map(([command, code, message, details]) => errorResult(command, code, message, details ?? undefined));

const arbitraryCommandResult: fc.Arbitrary<CommandResult> = fc.oneof(
  arbitrarySuccessResult,
  arbitraryErrorResult
);

// --- Tests ---

describe('Property 1: JSON Output Validity', () => {
  const jsonFormatter = new JSONFormatter();

  it('JSON formatter always produces valid parseable JSON', () => {
    fc.assert(
      fc.property(arbitraryCommandResult, (result) => {
        const output = jsonFormatter.format(result);
        expect(() => JSON.parse(output)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('parsed JSON preserves the success field', () => {
    fc.assert(
      fc.property(arbitraryCommandResult, (result) => {
        const output = jsonFormatter.format(result);
        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(result.success);
      }),
      { numRuns: 100 }
    );
  });

  it('parsed JSON preserves the command field', () => {
    fc.assert(
      fc.property(arbitraryCommandResult, (result) => {
        const output = jsonFormatter.format(result);
        const parsed = JSON.parse(output);
        expect(parsed.command).toBe(result.command);
      }),
      { numRuns: 100 }
    );
  });

  it('error results always have error object in JSON output', () => {
    fc.assert(
      fc.property(arbitraryErrorResult, (result) => {
        const output = jsonFormatter.format(result);
        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(false);
        expect(parsed.error).toBeDefined();
        expect(parsed.error.code).toBeDefined();
        expect(parsed.error.message).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('success results have data in JSON output when provided', () => {
    fc.assert(
      fc.property(arbitrarySuccessResult, (result) => {
        const output = jsonFormatter.format(result);
        const parsed = JSON.parse(output);
        expect(parsed.success).toBe(true);
        if (result.data !== undefined) {
          expect(parsed.data).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('text formatter produces non-empty output for any result', () => {
    const textFormatter = new TextFormatter();
    fc.assert(
      fc.property(arbitraryCommandResult, (result) => {
        const output = textFormatter.format(result);
        expect(output.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
