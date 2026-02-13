/**
 * Property-Based Tests for Skill Registry
 * 
 * Feature: 000-sdd-framework-init
 * Property 3: Platform Filtering Returns Correct Skills
 * Property 4: Skill Validation Rejects Invalid Skills
 * 
 * Validates: Requirements 2.2, 2.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SkillRegistry } from '../../src/registry/skill-registry';
import type { CanonicalSkill, PlatformId } from '../../src/types';

/**
 * Generator for valid kebab-case skill names
 */
const arbitrarySkillName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 20 }
).map(s => s.toLowerCase());

/**
 * Generator for non-empty strings
 */
const arbitraryNonEmptyString = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for valid platform IDs
 */
const arbitraryPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

/**
 * Generator for non-empty subsets of platforms
 */
const arbitraryPlatformSubset: fc.Arbitrary<PlatformId[]> = fc.subarray(
  ['kiro', 'claude-code', 'codex', 'antigravity'] as PlatformId[],
  { minLength: 1 }
);

/**
 * Generator for valid canonical skill definitions
 */
const arbitraryCanonicalSkill = (platforms?: PlatformId[]): fc.Arbitrary<CanonicalSkill> => fc.record({
  name: arbitrarySkillName,
  title: arbitraryNonEmptyString,
  description: arbitraryNonEmptyString,
  version: fc.constant('1.0.0'),
  supportedPlatforms: platforms ? fc.constant(platforms) : arbitraryPlatformSubset,
  instructions: arbitraryNonEmptyString,
  parameters: fc.constant([]),
});

/**
 * Generator for unique skill names
 */
const arbitraryUniqueSkillNames = (count: number): fc.Arbitrary<string[]> => 
  fc.array(arbitrarySkillName, { minLength: count, maxLength: count })
    .map(names => {
      // Ensure uniqueness by appending index
      return names.map((name, i) => `${name}${i}`);
    });

describe('Property 3: Platform Filtering Returns Correct Skills', () => {
  /**
   * **Validates: Requirements 2.2**
   * 
   * Property: For any set of registered skills with various platform support
   * configurations, filtering by a platform SHALL return exactly those skills
   * that include that platform in their supportedPlatforms array.
   */
  it('listForPlatform returns exactly skills that support the queried platform', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(arbitrarySkillName, arbitraryPlatformSubset),
          { minLength: 1, maxLength: 10 }
        ).map(pairs => {
          // Ensure unique names by appending index
          return pairs.map(([name, platforms], i) => ({
            name: `${name}${i}`,
            platforms
          }));
        }),
        arbitraryPlatformId,
        (skillConfigs, queryPlatform) => {
          const registry = new SkillRegistry();

          // Register all skills
          for (const config of skillConfigs) {
            const skill: CanonicalSkill = {
              name: config.name,
              title: `Title for ${config.name}`,
              description: `Description for ${config.name}`,
              version: '1.0.0',
              supportedPlatforms: config.platforms,
              instructions: `Instructions for ${config.name}`,
              parameters: []
            };
            registry.register(skill);
          }

          // Query for the platform
          const result = registry.listForPlatform(queryPlatform);

          // Calculate expected skills
          const expectedSkillNames = skillConfigs
            .filter(c => c.platforms.includes(queryPlatform))
            .map(c => c.name);

          // Verify count matches
          expect(result.length).toBe(expectedSkillNames.length);

          // Verify all returned skills support the platform
          for (const metadata of result) {
            expect(metadata.supportedPlatforms).toContain(queryPlatform);
          }

          // Verify all expected skills are returned
          const resultNames = result.map(m => m.name);
          for (const expectedName of expectedSkillNames) {
            expect(resultNames).toContain(expectedName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Skills not supporting a platform are never returned for that platform
   */
  it('skills not supporting a platform are excluded from results', () => {
    fc.assert(
      fc.property(
        arbitraryCanonicalSkill(['kiro']),
        (skill) => {
          const registry = new SkillRegistry();
          registry.register(skill);

          // Query for platforms the skill doesn't support
          const claudeResults = registry.listForPlatform('claude-code');
          const codexResults = registry.listForPlatform('codex');
          const antigravityResults = registry.listForPlatform('antigravity');

          // Skill should not appear in any of these results
          expect(claudeResults.find(s => s.name === skill.name)).toBeUndefined();
          expect(codexResults.find(s => s.name === skill.name)).toBeUndefined();
          expect(antigravityResults.find(s => s.name === skill.name)).toBeUndefined();

          // But should appear for kiro
          const kiroResults = registry.listForPlatform('kiro');
          expect(kiroResults.find(s => s.name === skill.name)).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty registry returns empty results for any platform
   */
  it('empty registry returns empty results for any platform', () => {
    fc.assert(
      fc.property(arbitraryPlatformId, (platform) => {
        const registry = new SkillRegistry();
        const result = registry.listForPlatform(platform);
        expect(result).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 4: Skill Validation Rejects Invalid Skills', () => {
  /**
   * **Validates: Requirements 2.3**
   * 
   * Property: For any skill definition missing required fields (name, instructions,
   * or supportedPlatforms), registration SHALL fail with a validation error.
   */
  it('rejects skills with missing or empty name', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant(null as unknown as string),
          fc.constant(undefined as unknown as string)
        ),
        arbitraryNonEmptyString,
        arbitraryPlatformSubset,
        (invalidName, instructions, platforms) => {
          const registry = new SkillRegistry();
          const skill = {
            name: invalidName,
            title: 'Test Title',
            description: 'Test Description',
            version: '1.0.0',
            supportedPlatforms: platforms,
            instructions,
            parameters: []
          } as CanonicalSkill;

          expect(() => registry.register(skill)).toThrow(/name/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rejects skills with missing or empty instructions
   */
  it('rejects skills with missing or empty instructions', () => {
    fc.assert(
      fc.property(
        arbitrarySkillName,
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant(null as unknown as string),
          fc.constant(undefined as unknown as string)
        ),
        arbitraryPlatformSubset,
        (name, invalidInstructions, platforms) => {
          const registry = new SkillRegistry();
          const skill = {
            name,
            title: 'Test Title',
            description: 'Test Description',
            version: '1.0.0',
            supportedPlatforms: platforms,
            instructions: invalidInstructions,
            parameters: []
          } as CanonicalSkill;

          expect(() => registry.register(skill)).toThrow(/instructions/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rejects skills with empty supportedPlatforms array
   */
  it('rejects skills with empty supportedPlatforms array', () => {
    fc.assert(
      fc.property(
        arbitrarySkillName,
        arbitraryNonEmptyString,
        (name, instructions) => {
          const registry = new SkillRegistry();
          const skill: CanonicalSkill = {
            name,
            title: 'Test Title',
            description: 'Test Description',
            version: '1.0.0',
            supportedPlatforms: [],
            instructions,
            parameters: []
          };

          expect(() => registry.register(skill)).toThrow(/platform/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rejects skills with missing supportedPlatforms
   */
  it('rejects skills with missing supportedPlatforms', () => {
    fc.assert(
      fc.property(
        arbitrarySkillName,
        arbitraryNonEmptyString,
        fc.oneof(
          fc.constant(null as unknown as PlatformId[]),
          fc.constant(undefined as unknown as PlatformId[])
        ),
        (name, instructions, invalidPlatforms) => {
          const registry = new SkillRegistry();
          const skill = {
            name,
            title: 'Test Title',
            description: 'Test Description',
            version: '1.0.0',
            supportedPlatforms: invalidPlatforms,
            instructions,
            parameters: []
          } as CanonicalSkill;

          expect(() => registry.register(skill)).toThrow(/platform/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Valid skills are accepted
   */
  it('accepts valid skills with all required fields', () => {
    fc.assert(
      fc.property(
        arbitraryCanonicalSkill(),
        (skill) => {
          const registry = new SkillRegistry();
          
          // Should not throw
          expect(() => registry.register(skill)).not.toThrow();
          
          // Should be retrievable
          const retrieved = registry.get(skill.name);
          expect(retrieved).toBeDefined();
          expect(retrieved?.name).toBe(skill.name);
          expect(retrieved?.instructions).toBe(skill.instructions);
        }
      ),
      { numRuns: 100 }
    );
  });
});
