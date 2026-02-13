/**
 * Property-Based Tests for Validator
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 5: Kebab-Case Validation
 * Property 17: Input Validation Correctness
 * Property 18: Path Traversal Prevention
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'path';
import { Validator } from '../../src/validation/validator';

// --- Generators ---

/** Valid kebab-case names */
const arbitraryKebabCase = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 50 }
).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

/** Invalid spec names */
const arbitraryInvalidSpecName = fc.oneof(
  fc.constant(''),
  fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 10 }),
  fc.constant('-invalid'),
  fc.constant('invalid-'),
  fc.constant('invalid--name'),
  fc.constant('has space'),
  fc.constant('has_underscore'),
  fc.constant('has.dot'),
  fc.constant('123starts-with-number')
);

/** Valid platforms */
const arbitraryPlatform = fc.constantFrom('kiro', 'claude-code', 'codex', 'antigravity');

/** Invalid platforms */
const arbitraryInvalidPlatform = fc.oneof(
  fc.constant(''),
  fc.constant('vscode'),
  fc.constant('KIRO'),
  fc.constant('claude'),
  fc.constant('codex-gpt'),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 })
    .filter(s => !['kiro', 'codex', 'antigravity'].includes(s) && s !== 'claude-code')
);

/** Valid task statuses */
const arbitraryTaskStatus = fc.constantFrom('not_started', 'in_progress', 'completed', 'failed');

/** Invalid task statuses */
const arbitraryInvalidTaskStatus = fc.oneof(
  fc.constant(''),
  fc.constant('done'),
  fc.constant('pending'),
  fc.constant('NOT_STARTED'),
  fc.constant('in-progress'),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 })
    .filter(s => !['not_started', 'in_progress', 'completed', 'failed'].includes(s))
);

/** Valid task IDs */
const arbitraryTaskId = fc.tuple(
  fc.integer({ min: 1, max: 99 }),
  fc.integer({ min: 1, max: 99 })
).map(([major, minor]) => `${major}.${minor}`);

/** Invalid task IDs */
const arbitraryInvalidTaskId = fc.oneof(
  fc.constant(''),
  fc.constant('abc'),
  fc.constant('1'),
  fc.constant('1.'),
  fc.constant('.1'),
  fc.constant('1.2.3'),
  fc.constant('a.b')
);

/** Path traversal attempts */
const arbitraryPathTraversal = fc.oneof(
  fc.constant('../secret'),
  fc.constant('../../etc/passwd'),
  fc.constant('../../../root'),
  fc.constant('foo/../../outside')
);

// --- Tests ---

describe('Property 5: Kebab-Case Validation', () => {
  it('accepts all valid kebab-case strings', () => {
    fc.assert(
      fc.property(arbitraryKebabCase, (name) => {
        expect(Validator.isKebabCase(name)).toBe(true);
        const result = Validator.validateSpecName(name);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects all invalid spec names', () => {
    fc.assert(
      fc.property(arbitraryInvalidSpecName, (name) => {
        expect(Validator.isKebabCase(name)).toBe(false);
        const result = Validator.validateSpecName(name);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].code).toBe('INVALID_SPEC_NAME');
      }),
      { numRuns: 100 }
    );
  });

  it('kebab-case must start with a lowercase letter', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...'0123456789-'.split('')),
        arbitraryKebabCase,
        (prefix, rest) => {
          expect(Validator.isKebabCase(prefix + rest)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('kebab-case cannot contain consecutive hyphens', () => {
    fc.assert(
      fc.property(arbitraryKebabCase, arbitraryKebabCase, (a, b) => {
        const withDoubleHyphen = `${a}--${b}`;
        expect(Validator.isKebabCase(withDoubleHyphen)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 17: Input Validation Correctness', () => {
  it('correctly classifies valid platforms', () => {
    fc.assert(
      fc.property(arbitraryPlatform, (platform) => {
        expect(Validator.isValidPlatform(platform)).toBe(true);
        const result = Validator.validatePlatform(platform);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it('correctly rejects invalid platforms', () => {
    fc.assert(
      fc.property(arbitraryInvalidPlatform, (platform) => {
        expect(Validator.isValidPlatform(platform)).toBe(false);
        const result = Validator.validatePlatform(platform);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('correctly classifies valid task statuses', () => {
    fc.assert(
      fc.property(arbitraryTaskStatus, (status) => {
        expect(Validator.isValidTaskStatus(status)).toBe(true);
        const result = Validator.validateTaskStatus(status);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it('correctly rejects invalid task statuses', () => {
    fc.assert(
      fc.property(arbitraryInvalidTaskStatus, (status) => {
        expect(Validator.isValidTaskStatus(status)).toBe(false);
        const result = Validator.validateTaskStatus(status);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('correctly classifies valid task IDs', () => {
    fc.assert(
      fc.property(arbitraryTaskId, (taskId) => {
        expect(Validator.isValidTaskId(taskId)).toBe(true);
        const result = Validator.validateTaskId(taskId);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  it('correctly rejects invalid task IDs', () => {
    fc.assert(
      fc.property(arbitraryInvalidTaskId, (taskId) => {
        expect(Validator.isValidTaskId(taskId)).toBe(false);
        const result = Validator.validateTaskId(taskId);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 18: Path Traversal Prevention', () => {
  const workspaceRoot = process.platform === 'win32' ? 'C:\\workspace' : '/workspace';

  it('rejects path traversal attempts', () => {
    fc.assert(
      fc.property(arbitraryPathTraversal, (traversalPath) => {
        expect(Validator.isPathSafe(traversalPath, workspaceRoot)).toBe(false);
        const result = Validator.validatePath(traversalPath, workspaceRoot);
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('PATH_ESCAPE');
      }),
      { numRuns: 100 }
    );
  });

  it('accepts safe relative paths within workspace', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 10 }),
          { minLength: 1, maxLength: 3 }
        ),
        (segments) => {
          const safePath = segments.join(path.sep);
          expect(Validator.isPathSafe(safePath, workspaceRoot)).toBe(true);
          const result = Validator.validatePath(safePath, workspaceRoot);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects empty and null-ish paths', () => {
    expect(Validator.isPathSafe('', workspaceRoot)).toBe(false);
    expect(Validator.isPathSafe(null as unknown as string, workspaceRoot)).toBe(false);
    expect(Validator.isPathSafe(undefined as unknown as string, workspaceRoot)).toBe(false);
  });
});
