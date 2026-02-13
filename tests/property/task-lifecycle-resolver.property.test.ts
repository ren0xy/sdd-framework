/**
 * Property-Based Tests for TaskGroupResolver — Task Lifecycle & Status Management
 *
 * Feature: 008-task-lifecycle-status-management
 * Property 2: Group status aggregation follows precedence rules
 * Property 4: findNextExecutableTask considers queued tasks
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TaskGroupResolver } from '../../src/tasks/task-group-resolver';
import type { TaskGroupStatus } from '../../src/tasks/task-group-resolver';
import type { TaskStatus } from '../../src/types';

// ── Generators ──────────────────────────────────────────────────────────────

const allStatuses: TaskStatus[] = ['not_started', 'in_progress', 'completed', 'failed', 'queued'];

const arbitraryTaskStatus = fc.constantFrom<TaskStatus>(...allStatuses);

const arbitraryTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')),
  { minLength: 3, maxLength: 30 }
).filter(s => s.trim().length > 0);

const statusToCheckboxChar: Record<TaskStatus, string> = {
  not_started: ' ',
  in_progress: '-',
  completed: 'x',
  failed: '!',
  queued: '~',
};

/**
 * Compute expected aggregate status following the design doc precedence rules.
 */
function expectedAggregate(statuses: TaskStatus[]): TaskGroupStatus {
  if (statuses.length === 0) return 'not_started';
  const normalized = statuses.map(s => s === 'queued' ? 'not_started' as TaskStatus : s);
  const hasFailed = normalized.some(s => s === 'failed');
  const hasInProgress = normalized.some(s => s === 'in_progress');
  const hasCompleted = normalized.some(s => s === 'completed');
  const hasNotStarted = normalized.some(s => s === 'not_started');

  if (hasFailed) return 'failed';
  if (hasInProgress) return 'in_progress';
  if (hasCompleted && !hasNotStarted) return 'completed';
  if (hasCompleted && hasNotStarted) return 'partial';
  return 'not_started';
}


// ── 2.2.1 Property test: group status aggregation follows precedence rules ──

describe('Feature: task-lifecycle-status-management, Property 2: Group status aggregation follows precedence rules', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6, 2.7**
   *
   * Generate random arrays of TaskStatus values (including queued),
   * build a tasks.md, parse it, and verify the group status matches
   * the expected precedence rules.
   */
  it('group status matches expected aggregate of leaf statuses including queued', () => {
    const resolver = new TaskGroupResolver();

    const arbitraryLeafStatuses = fc.array(arbitraryTaskStatus, { minLength: 1, maxLength: 8 });

    fc.assert(
      fc.property(
        arbitraryLeafStatuses,
        fc.array(arbitraryTaskText, { minLength: 8, maxLength: 8 }),
        (statuses, texts) => {
          // Build tasks.md content with one group, one subgroup, N leaves
          const lines: string[] = ['# Tasks', ''];
          lines.push('- [ ] 1 Group');
          lines.push('  - [ ] 1.1 Subgroup');
          statuses.forEach((s, i) => {
            const ch = statusToCheckboxChar[s];
            lines.push(`    - [${ch}] 1.1.${i + 1} ${texts[i]}`);
          });
          const content = lines.join('\n');

          const groups = resolver.parseGroups(content);
          expect(groups.length).toBe(1);

          // With new semantics: group status is derived from depth-2 effective statuses.
          // The single depth-2 task (1.1) has children, so its effective status
          // is the aggregate of the leaf statuses. Then the group aggregates from
          // that single effective status.
          const leafAggregate = expectedAggregate(statuses);
          // Map TaskGroupStatus to TaskStatus for the depth-2 effective status
          let effectiveStatus: TaskStatus;
          switch (leafAggregate) {
            case 'completed': effectiveStatus = 'completed'; break;
            case 'failed': effectiveStatus = 'failed'; break;
            case 'in_progress': effectiveStatus = 'in_progress'; break;
            case 'partial': effectiveStatus = 'in_progress'; break;
            default: effectiveStatus = 'not_started'; break;
          }
          // Group aggregate of a single status is just that status mapped back
          const expected = expectedAggregate([effectiveStatus]);
          expect(groups[0].status).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── 2.2.2 Property test: findNextExecutableTask considers queued tasks ──────

describe('Feature: task-lifecycle-status-management, Property 4: findNextExecutableTask considers queued tasks', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * Generate random task groups where some leaf tasks are queued and none
   * are not_started. Verify findNextExecutableTask returns the first
   * non-blocked queued task.
   */
  it('returns first non-blocked queued task when no not_started tasks exist', () => {
    const resolver = new TaskGroupResolver();

    // Statuses that are NOT not_started (completed, in_progress, failed, queued)
    const nonNotStartedStatus = fc.constantFrom<TaskStatus>('completed', 'in_progress', 'failed', 'queued');

    const arbitraryLeafStatuses = fc.array(nonNotStartedStatus, { minLength: 2, maxLength: 6 })
      .filter(statuses => statuses.some(s => s === 'queued'));

    fc.assert(
      fc.property(
        arbitraryLeafStatuses,
        fc.array(arbitraryTaskText, { minLength: 6, maxLength: 6 }),
        (statuses, texts) => {
          const lines: string[] = ['# Tasks', ''];
          lines.push('- [ ] 1 Group');
          lines.push('  - [ ] 1.1 Subgroup');
          statuses.forEach((s, i) => {
            const ch = statusToCheckboxChar[s];
            lines.push(`    - [${ch}] 1.1.${i + 1} ${texts[i]}`);
          });
          const content = lines.join('\n');

          const groups = resolver.parseGroups(content);
          expect(groups.length).toBe(1);

          const next = resolver.findNextExecutableTask(groups[0]);

          // Find the first queued task that isn't blocked
          // Blocking: tasks after a failed sibling in the same subgroup are blocked
          let blocked = false;
          let expectedId: string | undefined;
          for (let i = 0; i < statuses.length; i++) {
            if (blocked && statuses[i] === 'queued') continue;
            if (statuses[i] === 'failed') { blocked = true; continue; }
            if (statuses[i] === 'queued' && !blocked) {
              expectedId = `1.1.${i + 1}`;
              break;
            }
          }

          if (expectedId) {
            expect(next).toBeDefined();
            expect(next!.id).toBe(expectedId);
          } else {
            expect(next).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
