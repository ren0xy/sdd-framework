/**
 * Property-Based Tests for TaskTracker — Task Lifecycle & Status Management
 *
 * Feature: 008-task-lifecycle-status-management
 * Property 1: Status character round-trip
 * Property 3: queueGroupTasks only changes not_started to queued
 * Property 5: Failure cascade preserves pre-failure and reverts post-failure
 * Property 6: Queued tasks accept all valid status transitions
 *
 * Validates: Requirements 1.2, 1.3, 1.5, 3.3, 3.4, 4.3, 4.4, 6.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskTracker } from '../../src/tasks/task-tracker';
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

function createTaskLine(id: string, text: string, status: TaskStatus): string {
  return `- [${statusToCheckboxChar[status]}] ${id} ${text}`;
}

// ── 2.1.1 Property test: status character round-trip ────────────────────────

describe('Feature: task-lifecycle-status-management, Property 1: Status character round-trip', () => {
  /**
   * **Validates: Requirements 1.2, 1.3, 1.5**
   *
   * For any valid TaskStatus (including queued), statusToChar then parseTaskStatus
   * on a synthetic `- [<char>] 1.1 test` line returns the original status.
   */
  it('round-trips all TaskStatus values through statusToChar and parseTaskStatus', () => {
    const tracker = new TaskTracker();
    fc.assert(
      fc.property(arbitraryTaskStatus, (status) => {
        const ch = tracker.statusToChar(status);
        const line = `- [${ch}] 1.1 test task`;
        const parsed = tracker.parseTaskStatus(line, '1.1');
        expect(parsed).toBe(status);
      }),
      { numRuns: 100 }
    );
  });
});


// ── 2.1.2 Property test: queueGroupTasks only changes not_started to queued ─

/**
 * Generator for a task group with leaf tasks in mixed statuses.
 * Returns { content, leafStatuses } where leafStatuses maps task ID → original status.
 */
const arbitraryMixedGroup = fc.array(
  arbitraryTaskStatus,
  { minLength: 2, maxLength: 6 }
).chain(statuses =>
  fc.array(arbitraryTaskText, { minLength: statuses.length, maxLength: statuses.length }).map(texts => {
    const lines: string[] = ['# Tasks', ''];
    lines.push('- [ ] 1 Group');
    lines.push('  - [ ] 1.1 Subgroup');
    const leafStatuses: Record<string, TaskStatus> = {};
    statuses.forEach((s, i) => {
      const id = `1.1.${i + 1}`;
      leafStatuses[id] = s;
      lines.push(`    ${createTaskLine(id, texts[i], s)}`);
    });
    return { content: lines.join('\n'), leafStatuses };
  })
);

describe('Feature: task-lifecycle-status-management, Property 3: queueGroupTasks only changes not_started to queued', () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'queue-test-'));
    tempFile = path.join(tempDir, 'tasks.md');
  });

  afterEach(async () => {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  /**
   * **Validates: Requirements 3.3, 3.4**
   *
   * After queueGroupTasks, all previously not_started leaf tasks are queued,
   * all other statuses unchanged.
   */
  it('only changes not_started leaves to queued, leaves others unchanged', { timeout: 30000 }, async () => {
    const tracker = new TaskTracker();
    await fc.assert(
      fc.asyncProperty(arbitraryMixedGroup, async ({ content, leafStatuses }) => {
        await fs.writeFile(tempFile, content, 'utf-8');
        await tracker.queueGroupTasks(tempFile, '1');
        const result = await fs.readFile(tempFile, 'utf-8');

        for (const [id, originalStatus] of Object.entries(leafStatuses)) {
          const newStatus = tracker.parseTaskStatus(result, id);
          if (originalStatus === 'not_started') {
            expect(newStatus).toBe('queued');
          } else {
            expect(newStatus).toBe(originalStatus);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


// ── 2.1.3 Property test: failure cascade preserves pre-failure and reverts post-failure ─

/**
 * Generator for a group with a failed task at a random position.
 * Pre-failure tasks get random completed/in_progress statuses.
 * Post-failure tasks are queued.
 */
const arbitraryFailureCascadeGroup = fc.integer({ min: 3, max: 6 }).chain(leafCount =>
  fc.integer({ min: 0, max: leafCount - 1 }).chain(failIndex =>
    fc.array(arbitraryTaskText, { minLength: leafCount, maxLength: leafCount }).map(texts => {
      const lines: string[] = ['# Tasks', ''];
      lines.push('- [ ] 1 Group');
      lines.push('  - [ ] 1.1 Subgroup');

      const leafStatuses: Record<string, TaskStatus> = {};
      const failedTaskId = `1.1.${failIndex + 1}`;

      for (let i = 0; i < leafCount; i++) {
        const id = `1.1.${i + 1}`;
        let status: TaskStatus;
        if (i < failIndex) {
          status = 'completed';
        } else if (i === failIndex) {
          status = 'failed';
        } else {
          status = 'queued';
        }
        leafStatuses[id] = status;
        lines.push(`    ${createTaskLine(id, texts[i], status)}`);
      }

      return { content: lines.join('\n'), leafStatuses, failedTaskId, failIndex };
    })
  )
);

describe('Feature: task-lifecycle-status-management, Property 5: Failure cascade preserves pre-failure and reverts post-failure', () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'failure-test-'));
    tempFile = path.join(tempDir, 'tasks.md');
  });

  afterEach(async () => {
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  /**
   * **Validates: Requirements 4.3, 4.4**
   *
   * After handleTaskFailure: group is [!], pre-failure tasks unchanged,
   * failed task is [!], post-failure queued tasks are [ ].
   */
  it('sets group to failed, preserves pre-failure, reverts post-failure queued to not_started', { timeout: 30000 }, async () => {
    const tracker = new TaskTracker();
    await fc.assert(
      fc.asyncProperty(arbitraryFailureCascadeGroup, async ({ content, leafStatuses, failedTaskId, failIndex }) => {
        await fs.writeFile(tempFile, content, 'utf-8');
        await tracker.handleTaskFailure(tempFile, '1', failedTaskId);
        const result = await fs.readFile(tempFile, 'utf-8');

        // Group should be failed
        const groupStatus = tracker.parseTaskStatus(result, '1');
        expect(groupStatus).toBe('failed');

        // Check each leaf task
        for (const [id, originalStatus] of Object.entries(leafStatuses)) {
          const idx = parseInt(id.split('.')[2]) - 1;
          const newStatus = tracker.parseTaskStatus(result, id);

          if (idx < failIndex) {
            // Pre-failure: unchanged
            expect(newStatus).toBe(originalStatus);
          } else if (idx === failIndex) {
            // Failed task stays failed
            expect(newStatus).toBe('failed');
          } else {
            // Post-failure queued → not_started
            if (originalStatus === 'queued') {
              expect(newStatus).toBe('not_started');
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


// ── 2.1.4 Property test: queued tasks accept all valid status transitions ───

describe('Feature: task-lifecycle-status-management, Property 6: Queued tasks accept all valid status transitions', () => {
  /**
   * **Validates: Requirements 6.3**
   *
   * For a [~] task, replaceTaskStatus with any valid target status produces
   * content where the task's checkbox reflects the target status.
   */
  it('replaceTaskStatus on a queued task produces correct checkbox for any target status', () => {
    const tracker = new TaskTracker();
    fc.assert(
      fc.property(
        arbitraryTaskText,
        arbitraryTaskStatus,
        (text, targetStatus) => {
          const line = `- [~] 1.1 ${text}`;
          const updated = tracker.replaceTaskStatus(line, '1.1', targetStatus);
          const parsed = tracker.parseTaskStatus(updated, '1.1');
          expect(parsed).toBe(targetStatus);
        }
      ),
      { numRuns: 100 }
    );
  });
});
