/**
 * Property-Based Tests for Skill CLI Integration
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 16: CLI Invocation in Transformed Skills
 * Property 20: Skill Backward Compatibility
 * 
 * Validates: Requirements 6.1, 6.3, 6.4, 8.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SkillCLIGenerator } from '../../src/transformer/skill-cli-generator';
import { SkillTransformer } from '../../src/transformer/skill-transformer';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { allSkills } from '../../src/skills/index';
import { isDirectorySkill, isSingleFileSkill } from '../../src/types';
import type { PlatformId } from '../../src/types';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import {
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
} from '../../src/adapters/index';

// --- Generators ---

const arbitraryPlatform: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

const arbitraryCLISkillName = fc.constantFrom(
  'create-spec', 'run-task', 'workspace-init', 'install-skills'
);

// --- Helpers ---

function createAdapters(): Map<PlatformId, PlatformAdapter> {
  const adapters = new Map<PlatformId, PlatformAdapter>();
  adapters.set('kiro', new KiroAdapter());
  adapters.set('claude-code', new ClaudeCodeAdapter());
  adapters.set('codex', new CodexAdapter());
  adapters.set('antigravity', new AntigravityAdapter());
  return adapters;
}

function createRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  allSkills.forEach(skill => registry.register(skill));
  return registry;
}

function getSkillContent(skill: ReturnType<PlatformAdapter['formatSkill']>): string {
  if (isSingleFileSkill(skill)) {
    return skill.content;
  }
  if (isDirectorySkill(skill)) {
    return skill.files.map(f => f.content).join('\n');
  }
  return '';
}

// --- Tests ---

describe('Property 16: CLI Invocation in Transformed Skills', () => {
  it('transformed skills for CLI-mapped operations contain npx sdd invocations', () => {
    fc.assert(
      fc.property(arbitraryCLISkillName, arbitraryPlatform, (skillName, platform) => {
        const registry = createRegistry();
        const skill = registry.get(skillName);
        if (!skill || !skill.supportedPlatforms.includes(platform)) return;

        const adapters = createAdapters();
        const transformer = new SkillTransformer(registry, adapters);
        const platformSkill = transformer.transformForPlatform(skillName, platform);

        const content = getSkillContent(platformSkill);

        // Must contain npx sdd prefix (Requirement 6.4)
        expect(content).toContain('npx sdd');

        // Must contain CLI Invocation section
        expect(content).toContain('CLI Invocation');
      }),
      { numRuns: 100 }
    );
  });

  it('CLI generator produces invocations for all four skill commands', () => {
    fc.assert(
      fc.property(arbitraryCLISkillName, (skillName) => {
        const generator = new SkillCLIGenerator();
        const invocations = generator.generateInvocations(skillName);

        expect(invocations.length).toBeGreaterThan(0);
        for (const inv of invocations) {
          expect(inv.command).toContain('npx sdd');
          expect(inv.description.length).toBeGreaterThan(0);
          expect(inv.example).toContain('npx sdd');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('CLI section formatted for platform contains bash code blocks', () => {
    fc.assert(
      fc.property(arbitraryCLISkillName, arbitraryPlatform, (skillName, platform) => {
        const generator = new SkillCLIGenerator();
        const section = generator.generateCLISection(skillName, platform);

        expect(section).toContain('```bash');
        expect(section).toContain('```');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 20: Skill Backward Compatibility', () => {
  it('transformed skills preserve original instruction content alongside CLI instructions', () => {
    fc.assert(
      fc.property(arbitraryCLISkillName, arbitraryPlatform, (skillName, platform) => {
        const registry = createRegistry();
        const skill = registry.get(skillName);
        if (!skill || !skill.supportedPlatforms.includes(platform)) return;

        const adapters = createAdapters();

        // Get skill without CLI injection (raw adapter output)
        const adapter = adapters.get(platform)!;
        const rawSkill = adapter.formatSkill(skill);
        const rawContent = getSkillContent(rawSkill);

        // Get skill with CLI injection (via transformer)
        const transformer = new SkillTransformer(registry, adapters);
        const transformedSkill = transformer.transformForPlatform(skillName, platform);
        const transformedContent = getSkillContent(transformedSkill);

        // Transformed content should contain all of the raw content (backward compat)
        // The raw content should be a prefix of the transformed content
        expect(transformedContent).toContain(rawContent.trim());

        // And also contain the CLI additions
        expect(transformedContent).toContain('npx sdd');
        expect(transformedContent.length).toBeGreaterThan(rawContent.length);
      }),
      { numRuns: 100 }
    );
  });

  it('skills without CLI mappings are returned unchanged', () => {
    const generator = new SkillCLIGenerator();
    const invocations = generator.generateInvocations('nonexistent-skill');
    expect(invocations).toHaveLength(0);

    const section = generator.generateCLISection('nonexistent-skill', 'kiro');
    expect(section).toBe('');
  });
});
