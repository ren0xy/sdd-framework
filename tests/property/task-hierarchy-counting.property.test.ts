/**
 * Property-Based Tests for Task Hierarchy Counting Logic
 *
 * Feature: 009-task-hierarchy-and-injection-fixes
 * Property 1: group.totalTasks equals number of depth-2 tasks
 * Property 2: subgroup.totalTasks equals number of depth-3 tasks
 * Property 3: completedTasks <= totalTasks at both group and subgroup level
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TaskGroupResolver } from '../../src/tasks/task-group-resolver';

// ── Generators ──────────────────────────────────────────────────────────────

const arbitraryCheckboxChar = fc.constantFrom(' ', 'x', '-', '!', '~');

const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
  { minLength: 3, maxLength: 20 }
).filter(s => s.trim().length > 0);

/**
 * Generator for a task group with variable structure:
 * some subgroups have depth-3 children, some don't.
 */
const arbitraryHierarchicalGroup = fc.record({
  groupCheckbox: arbitraryCheckboxChar,
  subgroups: fc.array(
    fc.record({
      subCheckbox: arbitraryCheckboxChar,
      subTitle: arbitraryTaskText,
      leaves: fc.array(
        fc.record({
          checkbox: arbitraryCheckboxChar,
          text: arbitraryTaskText,
        }),
        { minLength: 0, maxLength: 4 }
      ),
    }),
    { minLength: 1, maxLength: 5 }
  ),
}).map(({ groupCheckbox, subgroups }) => {
  const lines: string[] = ['# Tasks', ''];
  lines.push(`- [${groupCheckbox}] 1 Group`);

  let depth2Count = 0;
  const subgroupLeafCounts: number[] = [];

  subgroups.forEach((sg, si) => {
    depth2Count++;
    lines.push(`  - [${sg.subCheckbox}] 1.${si + 1} ${sg.subTitle}`);
    subgroupLeafCounts.push(sg.leaves.length);
    sg.leaves.forEach((leaf, li) => {
      lines.push(`    - [${leaf.checkbox}] 1.${si + 1}.${li + 1} ${leaf.text}`);
    });
  });

  return {
    content: lines.join('\n'),
    depth2Count,
    subgroupLeafCounts,
  };
});

// ── Property 1: group.totalTasks equals depth-2 count ───────────────────────

describe('Property 1: group.totalTasks equals depth-2 task count', () => {
  /**
   * **Validates: Requirements 2.1, 2.2**
   */
  it('group.totalTasks always equals the number of depth-2 tasks in the group', () => {
    const resolver = new TaskGroupResolver();
    fc.assert(
      fc.property(arbitraryHierarchicalGroup, ({ content, depth2Count }) => {
        const groups = resolver.parseGroups(content);
        expect(groups.length).toBe(1);
        expect(groups[0].totalTasks).toBe(depth2Count);
      }),
      { numRuns: 200 }
    );
  });
});

// ── Property 2: subgroup.totalTasks equals depth-3 count ────────────────────

describe('Property 2: subgroup.totalTasks equals depth-3 task count', () => {
  /**
   * **Validates: Requirements 2.3, 2.4**
   */
  it('subgroup.totalTasks always equals the number of depth-3 tasks in the subgroup', () => {
    const resolver = new TaskGroupResolver();
    fc.assert(
      fc.property(arbitraryHierarchicalGroup, ({ content, subgroupLeafCounts }) => {
        const groups = resolver.parseGroups(content);
        expect(groups.length).toBe(1);
        const group = groups[0];
        expect(group.subgroups.length).toBe(subgroupLeafCounts.length);
        for (let i = 0; i < group.subgroups.length; i++) {
          expect(group.subgroups[i].totalTasks).toBe(subgroupLeafCounts[i]);
        }
      }),
      { numRuns: 200 }
    );
  });
});

// ── Property 3: completedTasks <= totalTasks invariant ──────────────────────

describe('Property 3: completedTasks <= totalTasks invariant', () => {
  /**
   * **Validates: Requirements 2.5**
   */
  it('completedTasks <= totalTasks holds at both group and subgroup level', () => {
    const resolver = new TaskGroupResolver();
    fc.assert(
      fc.property(arbitraryHierarchicalGroup, ({ content }) => {
        const groups = resolver.parseGroups(content);
        for (const group of groups) {
          expect(group.completedTasks).toBeLessThanOrEqual(group.totalTasks);
          expect(group.failedTasks).toBeLessThanOrEqual(group.totalTasks);
          for (const subgroup of group.subgroups) {
            expect(subgroup.completedTasks).toBeLessThanOrEqual(subgroup.totalTasks);
            expect(subgroup.failedTasks).toBeLessThanOrEqual(subgroup.totalTasks);
          }
        }
      }),
      { numRuns: 200 }
    );
  });
});
