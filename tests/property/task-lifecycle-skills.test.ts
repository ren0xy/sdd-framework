/**
 * Unit Tests for Skills — Task Lifecycle & Status Management
 *
 * Feature: 008-task-lifecycle-status-management
 * Tasks: 2.3.1, 2.3.2, 2.3.3, 2.3.4
 *
 * Validates: Requirements 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2
 */

import { describe, it, expect } from 'vitest';
import { getSkillByName } from '../../src/skills/index';
import type { PlatformId } from '../../src/types';

// ── 2.3.1 Verify analyze-task-failure skill registration ────────────────────

describe('analyze-task-failure skill registration', () => {
  /**
   * **Validates: Requirements 5.1, 5.5, 5.6**
   */
  it('getSkillByName returns skill with correct parameters and all platforms', () => {
    const skill = getSkillByName('analyze-task-failure');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe('analyze-task-failure');

    // Parameters
    const paramNames = skill!.parameters.map(p => p.name);
    expect(paramNames).toContain('specName');
    expect(paramNames).toContain('groupId');
    expect(paramNames).toContain('failedTaskId');
    expect(skill!.parameters.every(p => p.required)).toBe(true);

    // All platforms
    const expectedPlatforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
    for (const platform of expectedPlatforms) {
      expect(skill!.supportedPlatforms).toContain(platform);
    }
  });
});

// ── 2.3.2 Verify analyze-task-failure instructions ──────────────────────────

describe('analyze-task-failure skill instructions', () => {
  /**
   * **Validates: Requirements 5.2, 5.3, 5.4**
   */
  it('instructions contain directives for reading docs, analyzing failure, suggesting resolution tasks', () => {
    const skill = getSkillByName('analyze-task-failure');
    expect(skill).toBeDefined();
    const instr = skill!.instructions;

    // Should direct agent to read spec documents
    expect(instr).toContain('tasks.md');
    expect(instr).toContain('requirements.md');
    expect(instr).toContain('design.md');

    // Should direct agent to analyze the failed task
    expect(instr).toMatch(/failed.*task|analyze/i);

    // Should direct agent to suggest resolution tasks
    expect(instr).toMatch(/resolution.*task|suggest/i);

    // Should mention checkbox format
    expect(instr).toMatch(/checkbox/i);
  });
});

// ── 2.3.3 Verify start-task-group instructions mention queuing and failure ──

describe('start-task-group skill instructions', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 4.1, 4.2**
   */
  it('instructions mention [~] queuing and failure cascade', () => {
    const skill = getSkillByName('start-task-group');
    expect(skill).toBeDefined();
    const instr = skill!.instructions;

    // Should mention queuing with [~]
    expect(instr).toContain('[~]');

    // Should mention queueGroupTasks
    expect(instr).toMatch(/queue/i);

    // Should mention failure cascade — group gets [!] and queued tasks revert
    expect(instr).toContain('[!]');
    expect(instr).toMatch(/handleTaskFailure|failure/i);
  });
});

// ── 2.3.4 Verify run-task instructions include [~] ─────────────────────────

describe('run-task skill instructions', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   */
  it('instructions include [~] in status list', () => {
    const skill = getSkillByName('run-task');
    expect(skill).toBeDefined();
    const instr = skill!.instructions;

    // Should list [~] as a status indicator
    expect(instr).toContain('[~]');
    expect(instr).toMatch(/queued/i);
  });
});
