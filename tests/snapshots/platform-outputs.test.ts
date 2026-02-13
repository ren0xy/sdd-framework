/**
 * Snapshot Tests for Platform Outputs
 * 
 * Captures the exact markdown output each adapter produces for skills.
 * If an adapter's output format changes unexpectedly, these tests fail
 * and show the diff.
 */

import { describe, it, expect } from 'vitest';
import { KiroAdapter } from '../../src/adapters/kiro-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { CodexAdapter } from '../../src/adapters/codex-adapter';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import { AmazonQAdapter } from '../../src/adapters/amazonq-adapter';
import {
  createSpecSkill,
  workspaceInitSkill,
  runTaskSkill,
  installSkillsSkill,
} from '../../src/skills';
import type { CanonicalSkill } from '../../src/types';

// All canonical skills to test
const allSkills: CanonicalSkill[] = [
  createSpecSkill,
  workspaceInitSkill,
  runTaskSkill,
  installSkillsSkill,
];

describe('Kiro Adapter Skill Output', () => {
  const adapter = new KiroAdapter();

  it.each(allSkills.map(s => [s.name, s]))(
    'formats %s skill correctly',
    (name, skill) => {
      const output = adapter.formatSkill(skill);
      expect(output).toMatchSnapshot();
    }
  );

  it('generates empty instructions content (uses steering files)', () => {
    const specs = [
      { name: 'user-auth', description: 'User authentication feature', path: '.kiro/specs/user-auth/' },
      { name: 'payments', description: 'Payment processing', path: '.kiro/specs/payments/' },
    ];
    const output = adapter.generateInstructionsContent(specs);
    expect(output).toMatchSnapshot();
  });
});

describe('Claude Code Adapter Skill Output', () => {
  const adapter = new ClaudeCodeAdapter();

  it.each(allSkills.map(s => [s.name, s]))(
    'formats %s skill correctly',
    (name, skill) => {
      const output = adapter.formatSkill(skill);
      expect(output).toMatchSnapshot();
    }
  );

  it('generates CLAUDE.md instructions content', () => {
    const specs = [
      { name: 'user-auth', description: 'User authentication feature', path: '.kiro/specs/user-auth/' },
      { name: 'payments', description: 'Payment processing', path: '.kiro/specs/payments/' },
    ];
    const output = adapter.generateInstructionsContent(specs);
    expect(output).toMatchSnapshot();
  });

  it('generates CLAUDE.md with no specs', () => {
    const output = adapter.generateInstructionsContent([]);
    expect(output).toMatchSnapshot();
  });
});

describe('Codex Adapter Skill Output', () => {
  const adapter = new CodexAdapter();

  it.each(allSkills.map(s => [s.name, s]))(
    'formats %s skill correctly',
    (name, skill) => {
      const output = adapter.formatSkill(skill);
      expect(output).toMatchSnapshot();
    }
  );

  it('generates AGENTS.md instructions content', () => {
    const specs = [
      { name: 'user-auth', description: 'User authentication feature', path: '.kiro/specs/user-auth/' },
      { name: 'payments', description: 'Payment processing', path: '.kiro/specs/payments/' },
    ];
    const output = adapter.generateInstructionsContent(specs);
    expect(output).toMatchSnapshot();
  });

  it('generates AGENTS.md with no specs', () => {
    const output = adapter.generateInstructionsContent([]);
    expect(output).toMatchSnapshot();
  });
});

describe('Antigravity Adapter Skill Output', () => {
  const adapter = new AntigravityAdapter();

  it.each(allSkills.map(s => [s.name, s]))(
    'formats %s skill correctly',
    (name, skill) => {
      const output = adapter.formatSkill(skill);
      expect(output).toMatchSnapshot();
    }
  );

  it('generates .agent/rules/specs.md instructions content', () => {
    const specs = [
      { name: 'user-auth', description: 'User authentication feature', path: '.kiro/specs/user-auth/' },
      { name: 'payments', description: 'Payment processing', path: '.kiro/specs/payments/' },
    ];
    const output = adapter.generateInstructionsContent(specs);
    expect(output).toMatchSnapshot();
  });

  it('generates specs.md with no specs', () => {
    const output = adapter.generateInstructionsContent([]);
    expect(output).toMatchSnapshot();
  });
});

describe('Amazon Q Adapter Skill Output', () => {
  const adapter = new AmazonQAdapter();

  it.each(allSkills.map(s => [s.name, s]))(
    'formats %s skill correctly',
    (name, skill) => {
      const output = adapter.formatSkill(skill);
      expect(output).toMatchSnapshot();
    }
  );

  it('generates instructions content with specs', () => {
    const specs = [
      { name: 'user-auth', description: 'User authentication feature', path: '.kiro/specs/user-auth/' },
      { name: 'payments', description: 'Payment processing', path: '.kiro/specs/payments/' },
    ];
    const output = adapter.generateInstructionsContent(specs);
    expect(output).toMatchSnapshot();
  });

  it('generates instructions content with no specs', () => {
    const output = adapter.generateInstructionsContent([]);
    expect(output).toMatchSnapshot();
  });
});

describe('Cross-Platform Output Consistency', () => {
  const adapters = [
    { name: 'kiro', adapter: new KiroAdapter() },
    { name: 'claude-code', adapter: new ClaudeCodeAdapter() },
    { name: 'codex', adapter: new CodexAdapter() },
    { name: 'antigravity', adapter: new AntigravityAdapter() },
    { name: 'amazonq', adapter: new AmazonQAdapter() },
  ];

  it('all adapters produce output for all skills', () => {
    for (const { name, adapter } of adapters) {
      for (const skill of allSkills) {
        const output = adapter.formatSkill(skill);
        expect(output, `${name} should format ${skill.name}`).toBeDefined();
      }
    }
  });

  it('all adapters include skill title in output', () => {
    for (const { name, adapter } of adapters) {
      for (const skill of allSkills) {
        const output = adapter.formatSkill(skill);
        
        if ('content' in output) {
          expect(output.content, `${name}/${skill.name} should include title`).toContain(skill.title);
        } else if ('files' in output) {
          const mainFile = output.files.find(f => f.filename === 'SKILL.md');
          expect(mainFile?.content, `${name}/${skill.name} should include title`).toContain(skill.title);
        }
      }
    }
  });

  it('all adapters include skill description in output', () => {
    for (const { name, adapter } of adapters) {
      for (const skill of allSkills) {
        const output = adapter.formatSkill(skill);
        
        if ('content' in output) {
          expect(output.content, `${name}/${skill.name} should include description`).toContain(skill.description);
        } else if ('files' in output) {
          const mainFile = output.files.find(f => f.filename === 'SKILL.md');
          expect(mainFile?.content, `${name}/${skill.name} should include description`).toContain(skill.description);
        }
      }
    }
  });
});
