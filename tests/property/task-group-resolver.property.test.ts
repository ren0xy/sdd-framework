/**
 * Property-Based Tests for TaskGroupResolver
 *
 * Feature: 007-task-execution-skill
 * Property 1: Group parsing preserves all tasks
 * Property 2: Aggregate status consistency
 * Property 3: Blocking detection correctness
 * Property 4: Requirements extraction completeness
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 5.1, 5.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TaskGroupResolver } from '../../src/tasks/task-group-resolver';
import type { TaskGroupStatus } from '../../src/tasks/task-group-resolver';
import type { TaskStatus } from '../../src/types';

// ── Generators ──────────────────────────────────────────────────────────────

const arbitraryCheckboxChar = fc.constantFrom(' ', 'x', '-', '!');

const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')),
  { minLength: 3, maxLength: 30 }
).filter(s => s.trim().length > 0);

const arbitraryOptionalMarker = fc.constantFrom('', '*');

/**
 * Generator for a structured task group with known leaf count.
 * Produces { content, leafCount } where content is valid tasks.md text.
 */
const arbitraryTaskGroup = fc.record({
  groupTitle: arbitraryTaskText,
  groupCheckbox: arbitraryCheckboxChar,
  groupOptional: arbitraryOptionalMarker,
  subgroups: fc.array(
    fc.record({
      subTitle: arbitraryTaskText,
      subCheckbox: arbitraryCheckboxChar,
      leaves: fc.array(
        fc.record({
          text: arbitraryTaskText,
          checkbox: arbitraryCheckboxChar,
          optional: arbitraryOptionalMarker,
        }),
        { minLength: 1, maxLength: 4 }
      ),
    }),
    { minLength: 1, maxLength: 3 }
  ),
}).map(({ groupTitle, groupCheckbox, groupOptional, subgroups }) => {
  const lines: string[] = ['# Tasks', '', '## Implementation', ''];
  let leafCount = 0;

  const gOpt = groupOptional ? '*' : '';
  lines.push(`- [${groupCheckbox}]${gOpt} 1 ${groupTitle}`);

  subgroups.forEach((sg, si) => {
    lines.push(`  - [${sg.subCheckbox}] 1.${si + 1} ${sg.subTitle}`);
    sg.leaves.forEach((leaf, li) => {
      const lOpt = leaf.optional ? '*' : '';
      lines.push(`    - [${leaf.checkbox}]${lOpt} 1.${si + 1}.${li + 1} ${leaf.text}`);
      leafCount++;
    });
  });

  return { content: lines.join('\n'), leafCount };
});


/**
 * Map checkbox char to TaskStatus for verification.
 */
function charToStatus(ch: string): TaskStatus {
  switch (ch) {
    case 'x': return 'completed';
    case '-': return 'in_progress';
    case '!': return 'failed';
    default:  return 'not_started';
  }
}

// ── Property 1: Group parsing preserves all tasks ───────────────────────────

describe('Property 1: Group parsing preserves all tasks', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3**
   *
   * For any valid tasks.md content with N subgroups,
   * parseGroups() shall return groups whose combined totalTasks equals
   * the number of depth-2 immediate children.
   */
  it('totalTasks matches the number of depth-2 immediate children', () => {
    const resolver = new TaskGroupResolver();
    fc.assert(
      fc.property(arbitraryTaskGroup, ({ content }) => {
        const groups = resolver.parseGroups(content);
        for (const group of groups) {
          const depth2Count = group.tasks.filter(t => t.depth === 2).length;
          expect(group.totalTasks).toBe(depth2Count);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 2: Aggregate status consistency ────────────────────────────────

describe('Property 2: Aggregate status consistency', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any parsed TaskGroup, the status field shall be consistent with
   * the depth-2 task effective statuses (derived from their children).
   */
  it('group status matches expected aggregate of depth-2 effective statuses', () => {
    const resolver = new TaskGroupResolver();
    fc.assert(
      fc.property(arbitraryTaskGroup, ({ content }) => {
        const groups = resolver.parseGroups(content);
        for (const group of groups) {
          const depth2Tasks = group.tasks.filter(t => t.depth === 2);
          if (depth2Tasks.length === 0) continue;

          // Build subgroup map for effective status derivation
          const subgroupMap = new Map<string, typeof group.subgroups[0]>();
          for (const sg of group.subgroups) {
            subgroupMap.set(sg.id, sg);
          }

          // Derive effective statuses for depth-2 tasks
          const effectiveStatuses: TaskStatus[] = depth2Tasks.map(t => {
            const sg = subgroupMap.get(t.id);
            if (sg) {
              const childStatuses = sg.tasks.filter(c => c.depth === 3).map(c => c.status);
              if (childStatuses.length > 0) {
                // Derive from children
                const hasCompleted  = childStatuses.some(s => s === 'completed');
                const hasFailed     = childStatuses.some(s => s === 'failed');
                const hasInProgress = childStatuses.some(s => s === 'in_progress');
                const hasNotStarted = childStatuses.some(s => s === 'not_started');
                if (hasFailed) return 'failed' as TaskStatus;
                if (hasInProgress) return 'in_progress' as TaskStatus;
                if (hasCompleted && !hasNotStarted) return 'completed' as TaskStatus;
                if (hasCompleted && hasNotStarted) return 'in_progress' as TaskStatus; // partial maps to in_progress
                return 'not_started' as TaskStatus;
              }
            }
            return t.status;
          });

          const hasCompleted  = effectiveStatuses.some(s => s === 'completed');
          const hasFailed     = effectiveStatuses.some(s => s === 'failed');
          const hasInProgress = effectiveStatuses.some(s => s === 'in_progress');
          const hasNotStarted = effectiveStatuses.some(s => s === 'not_started');

          let expected: TaskGroupStatus;
          if (hasFailed) expected = 'failed';
          else if (hasInProgress) expected = 'in_progress';
          else if (hasCompleted && !hasNotStarted) expected = 'completed';
          else if (hasCompleted && hasNotStarted) expected = 'partial';
          else expected = 'not_started';

          expect(group.status).toBe(expected);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 3: Blocking detection correctness ─────────────────────────────

describe('Property 3: Blocking detection correctness', () => {
  /**
   * **Validates: Requirements 5.1, 5.2**
   *
   * For any subgroup where task N has status failed, all tasks with IDs
   * after N in the same subgroup shall have isBlocked = true.
   */
  it('tasks after a failed sibling in a subgroup are blocked', () => {
    const resolver = new TaskGroupResolver();

    // Generate a subgroup that always has a failed task
    const arbitraryWithFailure = fc.record({
      subTitle: arbitraryTaskText,
      failIndex: fc.integer({ min: 0, max: 2 }),
      leaves: fc.array(arbitraryTaskText, { minLength: 3, maxLength: 5 }),
    }).map(({ subTitle, failIndex, leaves }) => {
      const lines: string[] = ['# Tasks', '', '## Tasks', ''];
      lines.push(`- [ ] 1 Group`);
      lines.push(`  - [ ] 1.1 ${subTitle}`);
      leaves.forEach((text, i) => {
        const ch = i === failIndex ? '!' : ' ';
        lines.push(`    - [${ch}] 1.1.${i + 1} ${text}`);
      });
      return { content: lines.join('\n'), failIndex, leafCount: leaves.length };
    });

    fc.assert(
      fc.property(arbitraryWithFailure, ({ content, failIndex, leafCount }) => {
        const groups = resolver.parseGroups(content);
        expect(groups.length).toBe(1);
        const subgroup = groups[0].subgroups[0];
        expect(subgroup).toBeDefined();

        for (let i = 0; i < subgroup.tasks.length; i++) {
          if (i > failIndex) {
            expect(subgroup.tasks[i].isBlocked).toBe(true);
          } else {
            expect(subgroup.tasks[i].isBlocked).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ── Property 4: Requirements extraction completeness ────────────────────────

describe('Property 4: Requirements extraction completeness', () => {
  /**
   * **Validates: Requirements 3.4, 4.1**
   *
   * For any task line followed by a _Requirements: X.Y, Z.W_ detail line,
   * the parsed task's requirements array shall contain all referenced IDs.
   */
  it('all requirement references are extracted from detail lines', () => {
    const resolver = new TaskGroupResolver();

    const arbitraryReqIds = fc.array(
      fc.tuple(
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 1, max: 9 })
      ).map(([a, b]) => `${a}.${b}`),
      { minLength: 1, maxLength: 4 }
    ).map(ids => [...new Set(ids)]); // deduplicate

    const arbitraryWithReqs = fc.tuple(arbitraryTaskText, arbitraryReqIds).map(([text, reqIds]) => {
      const lines = [
        '# Tasks', '',
        '- [ ] 1 Group',
        `  - [ ] 1.1 Subgroup`,
        `    - [ ] 1.1.1 ${text}`,
        `      - _Requirements: ${reqIds.join(', ')}_`,
      ];
      return { content: lines.join('\n'), expectedReqs: reqIds };
    });

    fc.assert(
      fc.property(arbitraryWithReqs, ({ content, expectedReqs }) => {
        const groups = resolver.parseGroups(content);
        const leaf = groups[0]?.tasks.find(t => t.id === '1.1.1');
        expect(leaf).toBeDefined();
        for (const reqId of expectedReqs) {
          expect(leaf!.requirements).toContain(reqId);
        }
      }),
      { numRuns: 100 }
    );
  });
});
