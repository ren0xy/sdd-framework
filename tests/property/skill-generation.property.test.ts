/**
 * Property-Based Tests for Platform-Specific Skill Format Generation
 * 
 * Feature: 000-sdd-framework-init
 * Property 14: Platform-Specific Skill Format Generation
 * 
 * Validates: Requirements 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { KiroAdapter } from '../../src/adapters/kiro-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { CodexAdapter } from '../../src/adapters/codex-adapter';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import { AmazonQAdapter } from '../../src/adapters/amazonq-adapter';
import type { CanonicalSkill, PlatformId } from '../../src/types';
import { isDirectorySkill, isSingleFileSkill } from '../../src/types';

/**
 * Generator for valid kebab-case skill names
 */
const arbitrarySkillName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 3, maxLength: 20 }
).map(s => s.toLowerCase());

/**
 * Generator for non-empty strings (for title, description, instructions)
 */
const arbitraryNonEmptyString = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generator for valid canonical skill definitions
 */
const arbitraryCanonicalSkill: fc.Arbitrary<CanonicalSkill> = fc.record({
  name: arbitrarySkillName,
  title: arbitraryNonEmptyString,
  description: arbitraryNonEmptyString,
  version: fc.constant('1.0.0'),
  supportedPlatforms: fc.constant(['kiro', 'claude-code', 'codex', 'antigravity'] as PlatformId[]),
  instructions: arbitraryNonEmptyString,
  parameters: fc.constant([]),
});

describe('Property 14: Platform-Specific Skill Format Generation', () => {
  /**
   * **Validates: Requirements 7.2**
   * 
   * Property: Kiro adapter produces markdown with `inclusion: auto` front-matter
   */
  it('Kiro adapter produces markdown with inclusion: auto front-matter', () => {
    const adapter = new KiroAdapter();

    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        // Should be a single file skill
        expect(isSingleFileSkill(result)).toBe(true);

        if (isSingleFileSkill(result)) {
          // Filename should be skill name with .md extension
          expect(result.filename).toBe(`${skill.name}.md`);

          // Content should have front-matter with inclusion: auto
          expect(result.content).toContain('---');
          expect(result.content).toContain('inclusion: auto');

          // Content should contain the skill title
          expect(result.content).toContain(`# ${skill.title}`);

          // Content should contain the description
          expect(result.content).toContain(skill.description);

          // Content should contain instructions section
          expect(result.content).toContain('## Instructions');
          expect(result.content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property: Codex adapter produces directory with SKILL.md file
   */
  it('Codex adapter produces directory with SKILL.md file', () => {
    const adapter = new CodexAdapter();

    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        // Should be a directory skill
        expect(isDirectorySkill(result)).toBe(true);

        if (isDirectorySkill(result)) {
          // Directory should be named after the skill
          expect(result.directory).toBe(skill.name);

          // Should have exactly one file
          expect(result.files.length).toBe(1);

          // File should be named SKILL.md
          expect(result.files[0].filename).toBe('SKILL.md');

          // Content should contain the skill title
          expect(result.files[0].content).toContain(`# ${skill.title}`);

          // Content should contain the description
          expect(result.files[0].content).toContain(skill.description);

          // Content should contain instructions section
          expect(result.files[0].content).toContain('## Instructions');
          expect(result.files[0].content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.4**
   * 
   * Property: Claude Code adapter produces markdown file in correct format
   */
  it('Claude Code adapter produces markdown file with Usage section', () => {
    const adapter = new ClaudeCodeAdapter();

    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        // Should be a single file skill
        expect(isSingleFileSkill(result)).toBe(true);

        if (isSingleFileSkill(result)) {
          // Filename should be skill name with .md extension
          expect(result.filename).toBe(`${skill.name}.md`);

          // Content should NOT have front-matter (unlike Kiro)
          const frontMatterMatch = result.content.match(/^---\n/);
          expect(frontMatterMatch).toBeNull();

          // Content should contain the skill title
          expect(result.content).toContain(`# ${skill.title}`);

          // Content should contain the description
          expect(result.content).toContain(skill.description);

          // Content should contain Usage section (Claude Code specific)
          expect(result.content).toContain('## Usage');
          expect(result.content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.5**
   * 
   * Property: Antigravity adapter produces markdown file in .agent/skills/ format
   */
  it('Antigravity adapter produces directory with SKILL.md file', () => {
    const adapter = new AntigravityAdapter();

    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        const result = adapter.formatSkill(skill);

        // Should be a directory skill
        expect(isDirectorySkill(result)).toBe(true);

        if (isDirectorySkill(result)) {
          // Directory should be named after the skill
          expect(result.directory).toBe(skill.name);

          // Should have exactly one file
          expect(result.files.length).toBe(1);

          // File should be named SKILL.md
          expect(result.files[0].filename).toBe('SKILL.md');

          // Content should NOT have front-matter
          const frontMatterMatch = result.files[0].content.match(/^---\n/);
          expect(frontMatterMatch).toBeNull();

          // Content should contain the skill title
          expect(result.files[0].content).toContain(`# ${skill.title}`);

          // Content should contain the description
          expect(result.files[0].content).toContain(skill.description);

          // Content should contain instructions (without explicit section header)
          expect(result.files[0].content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: All adapters preserve skill content
   * 
   * For any canonical skill, transforming to any platform should preserve
   * the essential content (title, description, instructions).
   */
  it('All adapters preserve essential skill content', () => {
    const adapters = [
      new KiroAdapter(),
      new ClaudeCodeAdapter(),
      new CodexAdapter(),
      new AntigravityAdapter(),
      new AmazonQAdapter(),
    ];

    fc.assert(
      fc.property(arbitraryCanonicalSkill, (skill) => {
        for (const adapter of adapters) {
          const result = adapter.formatSkill(skill);

          // Get the content string regardless of skill type
          let content: string;
          if (isDirectorySkill(result)) {
            content = result.files[0].content;
          } else {
            content = result.content;
          }

          // All essential content should be preserved
          expect(content).toContain(skill.title);
          expect(content).toContain(skill.description);
          expect(content).toContain(skill.instructions);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Platform paths are correctly configured
   */
  it('Platform adapters have correct path configurations', () => {
    const kiro = new KiroAdapter();
    const claudeCode = new ClaudeCodeAdapter();
    const codex = new CodexAdapter();
    const antigravity = new AntigravityAdapter();

    // Kiro paths
    expect(kiro.specsPath).toBe('.kiro/specs/');
    expect(kiro.skillsPath).toBe('.kiro/skills/');
    expect(kiro.instructionsFile).toBeNull();

    // Claude Code paths
    expect(claudeCode.specsPath).toBe('.kiro/specs/');
    expect(claudeCode.skillsPath).toBe('.claude/skills/');
    expect(claudeCode.instructionsFile).toBe('CLAUDE.md');

    // Codex paths
    expect(codex.specsPath).toBe('.kiro/specs/');
    expect(codex.skillsPath).toBe('.codex/skills/');
    expect(codex.instructionsFile).toBe('AGENTS.md');

    // Antigravity paths
    expect(antigravity.specsPath).toBe('.kiro/specs/');
    expect(antigravity.skillsPath).toBe('.agent/skills/');
    expect(antigravity.instructionsFile).toBe('.agent/rules/specs.md');

    // Amazon Q paths
    const amazonq = new AmazonQAdapter();
    expect(amazonq.specsPath).toBe('.kiro/specs/');
    expect(amazonq.skillsPath).toBe('.amazonq/rules/');
    expect(amazonq.instructionsFile).toBeNull();
  });
});
