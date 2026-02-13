/**
 * Property-Based Tests for Antigravity DirectorySkill output
 *
 * Feature: 013-antigravity-directory-skills
 *
 * Properties:
 *   1: formatSkill returns DirectorySkill (not SingleFileSkill)
 *   2: SKILL.md content contains skill title and instructions
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import type { CanonicalSkill, PlatformId } from '../../src/types';
import { isDirectorySkill, isSingleFileSkill } from '../../src/types';

const adapter = new AntigravityAdapter();

// --- Generators ---

const arbitrarySkillName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 20 }
);

const arbitraryNonEmptyText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 ,.'.split('')),
  { minLength: 1, maxLength: 80 }
).filter(s => s.trim().length > 0);

const arbitraryCanonicalSkill: fc.Arbitrary<CanonicalSkill> = fc.record({
  name: arbitrarySkillName,
  title: arbitraryNonEmptyText,
  description: arbitraryNonEmptyText,
  version: fc.constant('1.0.0'),
  supportedPlatforms: fc.constant(['antigravity'] as PlatformId[]),
  instructions: arbitraryNonEmptyText,
  parameters: fc.constant([]),
});

// --- Property Tests ---

describe('Property 1: formatSkill returns DirectorySkill', () => {
  /**
   * **Validates: Requirements 1**
   *
   * For any canonical skill, AntigravityAdapter.formatSkill() returns a DirectorySkill
   * with directory set to skill.name and files containing one SKILL.md entry.
   * isDirectorySkill() returns true and isSingleFileSkill() returns false.
   */
  it('formatSkill produces DirectorySkill with correct structure', () => {
    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        expect(isDirectorySkill(result)).toBe(true);
        expect(isSingleFileSkill(result)).toBe(false);

        if (isDirectorySkill(result)) {
          expect(result.directory).toBe(skill.name);
          expect(result.files).toHaveLength(1);
          expect(result.files[0].filename).toBe('SKILL.md');
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: SKILL.md content contains title and instructions', () => {
  /**
   * **Validates: Requirements 2**
   *
   * For any canonical skill, the SKILL.md content within the DirectorySkill output
   * contains the skill title as an H1 heading, the description, and the instructions.
   */
  it('SKILL.md content preserves title, description, and instructions', () => {
    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        if (isDirectorySkill(result)) {
          const content = result.files[0].content;
          expect(content).toContain(`# ${skill.title}`);
          expect(content).toContain(skill.description);
          expect(content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });
});
