/**
 * Property-Based Tests for AmazonQAdapter
 * 
 * Feature: 006-amazonq-platform-integration
 * 
 * Properties:
 *   1: formatSkill content preservation
 *   2: formatSkill applies platform overrides
 *   3: parseSkill heuristic extraction
 *   4: formatSkill/parseSkill round trip
 *   5: generateInstructionsContent spec listing
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AmazonQAdapter } from '../../src/adapters/amazonq-adapter';
import type { CanonicalSkill, PlatformId, SpecMetadata } from '../../src/types';
import { isSingleFileSkill } from '../../src/types';

const adapter = new AmazonQAdapter();

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
  supportedPlatforms: fc.constant(['amazonq'] as PlatformId[]),
  instructions: arbitraryNonEmptyText,
  parameters: fc.constant([]),
});

const arbitrarySpecMetadata: fc.Arbitrary<SpecMetadata> = fc.record({
  name: arbitrarySkillName,
  description: arbitraryNonEmptyText,
  path: fc.constant('.kiro/specs/test-spec'),
});


// --- Property Tests ---

describe('Property 1: formatSkill content preservation', () => {
  /**
   * **Validates: Requirements 2.6, 4.1, 4.2, 4.3, 4.5**
   * 
   * For any canonical skill with non-empty title, description, and instructions,
   * formatSkill() produces a SingleFileSkill where filename equals {skill.name}.md
   * and content contains the title as H1, description, and instructions.
   */
  it('formatSkill preserves title, description, instructions, and filename', () => {
    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        expect(isSingleFileSkill(result)).toBe(true);
        if (isSingleFileSkill(result)) {
          expect(result.filename).toBe(`${skill.name}.md`);
          expect(result.content).toContain(`# ${skill.title}`);
          expect(result.content).toContain(skill.description);
          expect(result.content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: formatSkill applies platform overrides', () => {
  /**
   * **Validates: Requirements 4.4, 6.1**
   * 
   * For any canonical skill with platformOverrides for 'amazonq' with replacement
   * instructions, formatSkill() uses the overridden instructions. If additionalContent
   * is provided, it appears in the output.
   */
  it('formatSkill uses overridden instructions when amazonq overrides are present', () => {
    const arbitrarySkillWithOverrides = arbitraryCanonicalSkill.chain(skill =>
      fc.record({
        overrideInstructions: arbitraryNonEmptyText,
        additionalContent: arbitraryNonEmptyText,
      }).map(({ overrideInstructions, additionalContent }) => ({
        ...skill,
        platformOverrides: {
          amazonq: {
            instructions: overrideInstructions,
            additionalContent,
          },
        },
        _overrideInstructions: overrideInstructions,
        _additionalContent: additionalContent,
      }))
    );

    fc.assert(
      fc.property(arbitrarySkillWithOverrides, (skillWithMeta) => {
        const { _overrideInstructions, _additionalContent, ...skill } = skillWithMeta;
        const result = adapter.formatSkill(skill);

        if (isSingleFileSkill(result)) {
          expect(result.content).toContain(_overrideInstructions);
          expect(result.content).toContain(_additionalContent);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 3: parseSkill heuristic extraction', () => {
  /**
   * **Validates: Requirements 2.7**
   * 
   * For any markdown string containing an # H1 heading followed by body paragraphs,
   * parseSkill() extracts the title from the first heading, the description from the
   * first paragraph, and instructions from the remaining body content.
   */
  it('parseSkill extracts title, description, and instructions from markdown', () => {
    // Use trimmed text to match parseSkill's trim behavior
    const trimmedText = arbitraryNonEmptyText.map(s => s.trim()).filter(s => s.length > 0);

    fc.assert(
      fc.property(
        trimmedText,
        trimmedText,
        trimmedText,
        (title, description, instructions) => {
          const markdown = `# ${title}\n\n${description}\n\n${instructions}`;
          const result = adapter.parseSkill(markdown);

          expect(result.title).toBe(title);
          expect(result.description).toBe(description);
          expect(result.instructions).toBe(instructions);
          expect(result.name).toBe(title.toLowerCase().replace(/\s+/g, '-'));
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 4: formatSkill/parseSkill round trip', () => {
  /**
   * **Validates: Requirements 2.6, 2.7**
   * 
   * For any canonical skill with non-empty title, description, and instructions
   * (containing no markdown heading characters), formatting then parsing produces
   * a CanonicalSkill with equivalent title, description, and instructions.
   */
  it('format then parse preserves title, description, and instructions', () => {
    // Use a generator that avoids heading chars (#) and double newlines
    const safeText = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 ,.'.split('')),
      { minLength: 1, maxLength: 60 }
    ).filter(s => s.trim().length > 0).map(s => s.trim());

    const arbitraryRoundTripSkill: fc.Arbitrary<CanonicalSkill> = fc.record({
      name: arbitrarySkillName,
      title: safeText,
      description: safeText,
      version: fc.constant('1.0.0'),
      supportedPlatforms: fc.constant(['amazonq'] as PlatformId[]),
      instructions: safeText,
      parameters: fc.constant([]),
    });

    fc.assert(
      fc.property(arbitraryRoundTripSkill, (skill) => {
        const formatted = adapter.formatSkill(skill);
        if (!isSingleFileSkill(formatted)) return;

        const parsed = adapter.parseSkill(formatted.content);

        expect(parsed.title).toBe(skill.title);
        expect(parsed.description).toBe(skill.description);
        expect(parsed.instructions).toBe(skill.instructions);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: generateInstructionsContent spec listing', () => {
  /**
   * **Validates: Requirements 2.8**
   * 
   * For any array of SpecMetadata objects, generateInstructionsContent() produces
   * a string that contains every spec's name and description.
   */
  it('generateInstructionsContent includes all spec names and descriptions', () => {
    fc.assert(
      fc.property(
        fc.array(arbitrarySpecMetadata, { minLength: 1, maxLength: 10 }),
        (specs) => {
          const result = adapter.generateInstructionsContent(specs);

          for (const spec of specs) {
            expect(result).toContain(spec.name);
            expect(result).toContain(spec.description);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
