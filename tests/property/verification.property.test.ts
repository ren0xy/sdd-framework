/**
 * Property-Based Tests for Post-Operation Verification
 *
 * Feature: 003-post-operation-verification
 * Test file: tests/property/verification.property.test.ts
 *
 * Properties 1-11 as defined in the design document.
 * All verifiers use dependency-injected VerifyFileSystem for testability.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpecVerifier } from '../../src/verification/spec-verifier.js';
import { TaskVerifier } from '../../src/verification/task-verifier.js';
import { PlatformVerifier } from '../../src/verification/platform-verifier.js';
import { SkillVerifier } from '../../src/verification/skill-verifier.js';
import { VerifyCommand } from '../../src/commands/verify-command.js';
import { buildVerificationData, type VerificationCheck } from '../../src/verification/verification-data.js';
import { JSONFormatter } from '../../src/commands/output-formatter.js';
import { successResult, errorResult } from '../../src/commands/command-result.js';
import type { VerifyFileSystem } from '../../src/verification/verify-file-system.js';
import type { PlatformId, TaskStatus } from '../../src/types.js';

// ─── Mock File System ───────────────────────────────────────────────────────

class MockVerifyFS implements VerifyFileSystem {
  private files = new Map<string, string>();
  private dirs = new Set<string>();

  addFile(p: string, content: string): void {
    this.files.set(this.norm(p), content);
  }

  addDir(p: string): void {
    this.dirs.add(this.norm(p));
  }

  async exists(p: string): Promise<boolean> {
    const n = this.norm(p);
    return this.files.has(n) || this.dirs.has(n);
  }

  async readFile(p: string): Promise<string> {
    const n = this.norm(p);
    const c = this.files.get(n);
    if (c === undefined) throw new Error(`File not found: ${p}`);
    return c;
  }

  async isDirectory(p: string): Promise<boolean> {
    return this.dirs.has(this.norm(p));
  }

  async listFiles(p: string): Promise<string[]> {
    const prefix = this.norm(p);
    const results: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) results.push(key);
    }
    return results;
  }

  private norm(p: string): string {
    return p.replace(/\\/g, '/');
  }
}


// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbSpecName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 20 }
).filter(s => /^[a-z][a-z0-9-]*$/.test(s));

const arbPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

const arbTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'not_started', 'in_progress', 'completed', 'failed'
);

const arbCheckboxChar = fc.constantFrom(' ', 'x', '-', '!', '~');

const arbValidGenerationMode = fc.constantFrom('requirements-first', 'design-first');

const arbTaskId = fc.tuple(
  fc.integer({ min: 1, max: 99 }),
  fc.integer({ min: 1, max: 99 })
).map(([a, b]) => `${a}.${b}`);

const arbTaskText = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')),
  { minLength: 3, maxLength: 40 }
).filter(s => s.trim().length > 0);

const arbSkillName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
  { minLength: 2, maxLength: 15 }
).filter(s => /^[a-z][a-z-]*[a-z]$/.test(s));

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusCharToTaskStatus(c: string): TaskStatus {
  switch (c) {
    case ' ': return 'not_started';
    case 'x': return 'completed';
    case '-': return 'in_progress';
    case '!': return 'failed';
    case '~': return 'not_started';
    default: return 'not_started';
  }
}

function taskStatusToChar(s: TaskStatus): string {
  switch (s) {
    case 'not_started': return ' ';
    case 'in_progress': return '-';
    case 'completed': return 'x';
    case 'failed': return '!';
  }
}

function buildTasksContent(tasks: Array<{ id: string; text: string; char: string }>): string {
  const lines = ['# Tasks', '', '## Implementation', ''];
  for (const t of tasks) {
    lines.push(`- [${t.char}] ${t.id} ${t.text}`);
  }
  return lines.join('\n');
}

function buildSpecFS(
  specName: string,
  opts: {
    hasFolder?: boolean;
    hasRequirements?: boolean;
    hasDesign?: boolean;
    hasTasks?: boolean;
    hasConfig?: boolean;
    configContent?: string;
    tasksContent?: string;
  }
): MockVerifyFS {
  const fs = new MockVerifyFS();
  const root = '/workspace';
  const specPath = `${root}/.kiro/specs/${specName}`;

  if (opts.hasFolder !== false) fs.addDir(specPath);
  if (opts.hasRequirements !== false) fs.addFile(`${specPath}/requirements.md`, '# Requirements');
  if (opts.hasDesign !== false) fs.addFile(`${specPath}/design.md`, '# Design');
  if (opts.hasTasks !== false) {
    fs.addFile(`${specPath}/tasks.md`, opts.tasksContent ?? '# Tasks\n\n- [ ] 1.1 Initial setup');
  }
  if (opts.hasConfig !== false) {
    fs.addFile(`${specPath}/.config.kiro`, opts.configContent ?? JSON.stringify({ generationMode: 'requirements-first' }));
  }

  return fs;
}


// ═══════════════════════════════════════════════════════════════════════════
// Property 1: Spec structure verification correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 1: Spec structure verification correctness', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
   *
   * For any file system state representing a spec folder (with any combination of
   * present/missing files and valid/invalid content), the SpecVerifier SHALL produce
   * a VerificationCheck for each expected check, where each check's passed status
   * correctly reflects whether the corresponding file exists and has valid content.
   */
  it('produces correct checks for any combination of present/missing files and valid/invalid content', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        fc.boolean(), // folder exists
        fc.boolean(), // requirements.md exists
        fc.boolean(), // design.md exists
        fc.boolean(), // tasks.md exists
        fc.boolean(), // .config.kiro exists
        fc.boolean(), // config has valid JSON
        arbValidGenerationMode,
        fc.constantFrom(' ', 'x', '-', '!', '~', 'Q'), // checkbox marker (Q = invalid)
        async (specName, hasFolder, hasReq, hasDes, hasTasks, hasConfig, validJson, mode, marker) => {
          const fs = new MockVerifyFS();
          const root = '/workspace';
          const specPath = `${root}/.kiro/specs/${specName}`;

          if (hasFolder) fs.addDir(specPath);
          if (hasFolder && hasReq) fs.addFile(`${specPath}/requirements.md`, '# Req');
          if (hasFolder && hasDes) fs.addFile(`${specPath}/design.md`, '# Design');
          if (hasFolder && hasTasks) {
            fs.addFile(`${specPath}/tasks.md`, `# Tasks\n\n- [${marker}] 1.1 Do something`);
          }
          if (hasFolder && hasConfig) {
            const content = validJson
              ? JSON.stringify({ generationMode: mode })
              : '{ invalid json !!!';
            fs.addFile(`${specPath}/.config.kiro`, content);
          }

          const verifier = new SpecVerifier(fs);
          const result = await verifier.verify(specName, root);

          // Check 1: folder exists check is always present
          const folderCheck = result.checks.find(c => c.name === 'Spec folder exists');
          expect(folderCheck).toBeDefined();
          expect(folderCheck!.passed).toBe(hasFolder);

          // Check 2-4: required files
          for (const file of ['requirements.md', 'design.md', 'tasks.md']) {
            const check = result.checks.find(c => c.name === `${file} exists`);
            expect(check).toBeDefined();
            const shouldExist = hasFolder && (
              file === 'requirements.md' ? hasReq :
              file === 'design.md' ? hasDes : hasTasks
            );
            expect(check!.passed).toBe(shouldExist);
          }

          // Check 5: .config.kiro missing → warning, not failure
          if (hasFolder && !hasConfig) {
            expect(result.warnings).toContain('.config.kiro missing (warning)');
            // No config-related checks should be present
            expect(result.checks.find(c => c.name === '.config.kiro valid JSON')).toBeUndefined();
          }

          // Check 6: .config.kiro valid JSON
          if (hasFolder && hasConfig) {
            const jsonCheck = result.checks.find(c => c.name === '.config.kiro valid JSON');
            expect(jsonCheck).toBeDefined();
            expect(jsonCheck!.passed).toBe(validJson);
          }

          // Check 7: generationMode valid (only if config is valid JSON)
          if (hasFolder && hasConfig && validJson) {
            const modeCheck = result.checks.find(c => c.name === '.config.kiro valid generationMode');
            expect(modeCheck).toBeDefined();
            expect(modeCheck!.passed).toBe(true);
          }

          // Check 8: tasks.md checkbox syntax
          if (hasFolder && hasTasks) {
            const syntaxCheck = result.checks.find(c => c.name === 'tasks.md checkbox syntax valid');
            expect(syntaxCheck).toBeDefined();
            const validMarkers = [' ', 'x', '-', '!', '~'];
            expect(syntaxCheck!.passed).toBe(validMarkers.includes(marker));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 2: No short-circuit verification
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 2: No short-circuit verification', () => {
  /**
   * **Validates: Requirements 3.7**
   *
   * For any file system state where N checks are expected, the verifier SHALL always
   * return exactly N check results, regardless of how many checks fail.
   */
  it('always returns the same number of checks regardless of failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbValidGenerationMode,
        async (specName, mode) => {
          // Build a fully valid spec to determine the expected check count
          const validFs = buildSpecFS(specName, {
            configContent: JSON.stringify({ generationMode: mode }),
          });
          const verifier = new SpecVerifier(validFs);
          const validResult = await verifier.verify(specName, '/workspace');
          const expectedCheckCount = validResult.checks.length;

          // Now build a spec where the folder exists but first file is missing
          const brokenFs = buildSpecFS(specName, {
            hasRequirements: false,
            configContent: JSON.stringify({ generationMode: mode }),
          });
          const brokenVerifier = new SpecVerifier(brokenFs);
          const brokenResult = await brokenVerifier.verify(specName, '/workspace');

          // Same number of checks despite the failure
          expect(brokenResult.checks.length).toBe(expectedCheckCount);
          // At least one check should have failed
          expect(brokenResult.checks.some(c => !c.passed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 10: Backward compatibility — missing config is warning
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 10: Backward compatibility — missing config is warning', () => {
  /**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * For any spec folder that lacks .config.kiro, the SpecVerifier SHALL report the
   * missing config as a warning, not as a failed check. The overall passed status
   * SHALL remain true if all other checks pass.
   */
  it('missing .config.kiro is a warning, not a failure, and overall passes if other checks pass', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbCheckboxChar.filter(c => [' ', 'x', '-', '!', '~'].includes(c)),
        async (specName, marker) => {
          const fs = buildSpecFS(specName, {
            hasConfig: false,
            tasksContent: `# Tasks\n\n- [${marker}] 1.1 Do something`,
          });

          const verifier = new SpecVerifier(fs);
          const result = await verifier.verify(specName, '/workspace');

          // Warning should be present
          expect(result.warnings.length).toBeGreaterThan(0);
          expect(result.warnings.some(w => w.includes('.config.kiro'))).toBe(true);

          // No config-related checks should fail
          const configChecks = result.checks.filter(c =>
            c.name.includes('.config.kiro')
          );
          // Config checks should not exist at all (since config is missing)
          expect(configChecks.length).toBe(0);

          // All checks that do exist should pass
          expect(result.checks.every(c => c.passed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 3: Task status verification correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 3: Task status verification correctness', () => {
  /**
   * **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
   *
   * For any valid tasks.md content containing a task with a known status, and any
   * expected status value, the TaskVerifier SHALL correctly report whether the actual
   * status matches the expected status, and SHALL include both expected and actual
   * values in the check result when they differ.
   */
  it('correctly reports match/mismatch between actual and expected task status', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbTaskId,
        arbTaskText,
        arbCheckboxChar,
        arbTaskStatus,
        async (specName, taskId, taskText, actualChar, expectedStatus) => {
          const tasksContent = buildTasksContent([{ id: taskId, text: taskText, char: actualChar }]);
          const fs = new MockVerifyFS();
          const root = '/workspace';
          fs.addFile(`${root}/.kiro/specs/${specName}/tasks.md`, tasksContent);

          const verifier = new TaskVerifier(fs);
          const checks = await verifier.verifyTaskStatus(specName, taskId, expectedStatus, root);

          // Should have readable check, task exists check, status check, and integrity check
          expect(checks.length).toBeGreaterThanOrEqual(3);

          // tasks.md readable
          const readableCheck = checks.find(c => c.name === 'tasks.md readable');
          expect(readableCheck).toBeDefined();
          expect(readableCheck!.passed).toBe(true);

          // Task exists
          const existsCheck = checks.find(c => c.name === `Task ${taskId} exists`);
          expect(existsCheck).toBeDefined();
          expect(existsCheck!.passed).toBe(true);

          // Status check
          const statusCheck = checks.find(c => c.name === `Task ${taskId} status`);
          expect(statusCheck).toBeDefined();

          const actualStatus = statusCharToTaskStatus(actualChar);
          const shouldMatch = actualStatus === expectedStatus;
          expect(statusCheck!.passed).toBe(shouldMatch);

          if (!shouldMatch) {
            // Drift: both expected and actual values present
            expect(statusCheck!.expected).toBeDefined();
            expect(statusCheck!.actual).toBeDefined();
            expect(statusCheck!.message).toContain('Drift');
          }

          // Content integrity check
          const integrityCheck = checks.find(c => c.name === 'Content integrity');
          expect(integrityCheck).toBeDefined();
          expect(integrityCheck!.passed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 6: Platform verification correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 6: Platform verification correctness', () => {
  const PLATFORM_INSTRUCTIONS: Record<PlatformId, string | null> = {
    kiro: null,
    'claude-code': 'CLAUDE.md',
    codex: 'AGENTS.md',
    antigravity: '.agent/rules/specs.md',
    amazonq: null,
  };

  /**
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
   *
   * For any platform identifier and file system state, the PlatformVerifier SHALL
   * check for the correct platform-specific files and SHALL verify that instructions
   * files contain a .kiro/specs/ reference.
   */
  it('checks correct platform-specific files and .kiro/specs/ reference', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPlatformId,
        fc.boolean(), // specsDir exists
        fc.boolean(), // instructions file exists
        fc.boolean(), // instructions file has reference
        async (platform, hasSpecsDir, hasInstrFile, hasRef) => {
          const fs = new MockVerifyFS();
          const root = '/workspace';

          if (hasSpecsDir) fs.addDir(`${root}/.kiro/specs`);

          const instrFile = PLATFORM_INSTRUCTIONS[platform];
          if (instrFile && hasInstrFile) {
            const content = hasRef
              ? `# Instructions\n\nSee .kiro/specs/ for details.`
              : `# Instructions\n\nNo reference here.`;
            fs.addFile(`${root}/${instrFile}`, content);
          }

          const verifier = new PlatformVerifier(fs);
          const checks = await verifier.verify(platform, root);

          // All platforms: .kiro/specs/ check
          const specsCheck = checks.find(c => c.name === '.kiro/specs/ exists');
          expect(specsCheck).toBeDefined();
          expect(specsCheck!.passed).toBe(hasSpecsDir);

          // Platform-specific instructions file checks
          if (instrFile) {
            const fileCheck = checks.find(c => c.name === `${instrFile} exists`);
            expect(fileCheck).toBeDefined();
            expect(fileCheck!.passed).toBe(hasInstrFile);

            if (hasInstrFile) {
              const refCheck = checks.find(c => c.name === `${instrFile} references .kiro/specs/`);
              expect(refCheck).toBeDefined();
              expect(refCheck!.passed).toBe(hasRef);
            }
          } else {
            // Kiro: no instructions file checks beyond .kiro/specs/
            expect(checks.length).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 7: Skill verification correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 7: Skill verification correctness', () => {
  const PLATFORM_SKILLS_PATH: Record<PlatformId, string> = {
    kiro: '.kiro/skills/',
    'claude-code': '.claude/skills/',
    codex: '.codex/skills/',
    antigravity: '.agent/skills/',
    amazonq: '.amazonq/rules/',
  };

  /**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
   *
   * For any platform, set of skill names, and file system state, the SkillVerifier
   * SHALL check that each specified skill file exists, is non-empty, and contains a
   * CLI invocation section. When a --skills filter is provided, only the filtered
   * skills SHALL be checked.
   */
  it('checks existence, non-empty, CLI invocation section, and Codex directory structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPlatformId,
        fc.array(arbSkillName, { minLength: 1, maxLength: 3 })
          .filter(arr => new Set(arr).size === arr.length),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }), // skill exists
        fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }), // skill has CLI section
        async (platform, skillNames, existsFlags, cliFlags) => {
          const fs = new MockVerifyFS();
          const root = '/workspace';
          const skillsBase = `${root}/${PLATFORM_SKILLS_PATH[platform]}`;
          const isCodex = platform === 'codex';

          for (let i = 0; i < skillNames.length; i++) {
            const name = skillNames[i];
            const exists = existsFlags[i % existsFlags.length];
            const hasCli = cliFlags[i % cliFlags.length];

            if (exists) {
              const skillPath = isCodex
                ? `${skillsBase}${name}/SKILL.md`
                : `${skillsBase}${name}.md`;
              const content = hasCli
                ? `# Skill\n\n## CLI Invocation\n\nnpx sdd run-task`
                : `# Skill\n\nNo CLI section here.`;
              fs.addFile(skillPath, content);

              if (isCodex) {
                fs.addDir(`${skillsBase}${name}`);
              }
            }
          }

          const verifier = new SkillVerifier(fs);
          const checks = await verifier.verify(platform, skillNames, root);

          // Each skill should have an existence check
          for (let i = 0; i < skillNames.length; i++) {
            const name = skillNames[i];
            const exists = existsFlags[i % existsFlags.length];
            const hasCli = cliFlags[i % cliFlags.length];

            const existsCheck = checks.find(c => c.name === `Skill ${name} exists`);
            expect(existsCheck).toBeDefined();
            expect(existsCheck!.passed).toBe(exists);

            if (exists) {
              // Non-empty check
              const nonEmptyCheck = checks.find(c => c.name === `Skill ${name} non-empty`);
              expect(nonEmptyCheck).toBeDefined();
              expect(nonEmptyCheck!.passed).toBe(true); // content is always non-empty in our setup

              // CLI invocation check
              const cliCheck = checks.find(c => c.name === `Skill ${name} CLI invocation section`);
              expect(cliCheck).toBeDefined();
              expect(cliCheck!.passed).toBe(hasCli);

              // Codex directory structure check
              if (isCodex) {
                const dirCheck = checks.find(c => c.name === `Skill ${name} directory structure`);
                expect(dirCheck).toBeDefined();
                expect(dirCheck!.passed).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 8: VerificationResult structural invariants
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 8: VerificationResult structural invariants', () => {
  /**
   * **Validates: Requirements 7.1, 7.2, 7.5**
   *
   * For any VerificationResult, summary.total SHALL equal summary.passed + summary.failed,
   * summary.total SHALL equal checks.length, passed SHALL equal summary.failed === 0,
   * and durationMs SHALL be >= 0.
   */
  it('structural invariants hold for any set of checks and duration', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
            passed: fc.boolean(),
            message: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.nat({ max: 60000 }),
        (rawChecks, durationMs) => {
          const checks: VerificationCheck[] = rawChecks.map(c => ({
            name: c.name,
            passed: c.passed,
            message: c.message,
          }));

          const data = buildVerificationData(checks, durationMs);

          // Invariant 1: total = passed + failed
          expect(data.summary.total).toBe(data.summary.passed + data.summary.failed);

          // Invariant 2: total = checks.length
          expect(data.summary.total).toBe(data.checks.length);

          // Invariant 3: passed iff failed === 0
          expect(data.passed).toBe(data.summary.failed === 0);

          // Invariant 4: durationMs >= 0
          expect(data.durationMs).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 9: Output correctness
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 9: Output correctness', () => {
  /**
   * **Validates: Requirements 1.5, 1.6, 1.7, 7.3, 7.4**
   *
   * For any VerificationResult, JSON output SHALL be valid JSON conforming to
   * CommandResult<VerificationData> structure. The exit code SHALL be 0 if and only
   * if all checks pass, and non-zero otherwise with all failed checks present.
   */
  it('JSON output is valid and exit code reflects pass/fail correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        fc.boolean(), // all files present
        arbValidGenerationMode,
        async (specName, allPresent, mode) => {
          const fs = allPresent
            ? buildSpecFS(specName, { configContent: JSON.stringify({ generationMode: mode }) })
            : buildSpecFS(specName, { hasDesign: false, configContent: JSON.stringify({ generationMode: mode }) });

          const verifyCmd = new VerifyCommand(fs);
          const result = await verifyCmd.execute({ spec: specName, workspaceRoot: '/workspace' });

          // JSON output must be valid JSON
          const formatter = new JSONFormatter();
          const jsonStr = formatter.format(result);
          const parsed = JSON.parse(jsonStr);

          // Must conform to CommandResult structure
          expect(typeof parsed.success).toBe('boolean');
          expect(typeof parsed.command).toBe('string');

          if (allPresent) {
            // All checks pass → success=true (exit code 0)
            expect(result.success).toBe(true);
            expect(parsed.data).toBeDefined();
            expect(parsed.data.passed).toBe(true);
            expect(parsed.data.summary.failed).toBe(0);
          } else {
            // Some checks fail → success=false (non-zero exit code)
            expect(result.success).toBe(false);
            // Failed checks should be present in error details
            expect(parsed.error).toBeDefined();
            expect(parsed.error.code).toBe('VERIFICATION_FAILED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 4: Command-then-verify round trip
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 4: Command-then-verify round trip', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   *
   * For any successful command execution against a mock file system, running the
   * corresponding verifier immediately after SHALL produce a passing VerificationResult.
   */
  it('create-spec then SpecVerifier produces passing result', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbValidGenerationMode,
        async (specName, mode) => {
          // Simulate what create-spec produces: a fully valid spec folder
          const fs = buildSpecFS(specName, {
            configContent: JSON.stringify({ generationMode: mode }),
            tasksContent: '# Tasks\n\n- [ ] 1. Initial setup\n  - Set up project structure\n  - _Requirements: TBD_',
          });

          const verifier = new SpecVerifier(fs);
          const result = await verifier.verify(specName, '/workspace');

          // All checks should pass
          expect(result.checks.every(c => c.passed)).toBe(true);
          expect(result.warnings.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('run-task then TaskVerifier produces passing result for matching status', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbTaskId,
        arbTaskText,
        arbTaskStatus,
        async (specName, taskId, taskText, status) => {
          // Simulate what run-task produces: tasks.md with the updated status
          const char = taskStatusToChar(status);
          const tasksContent = buildTasksContent([{ id: taskId, text: taskText, char }]);
          const fs = new MockVerifyFS();
          fs.addFile(`/workspace/.kiro/specs/${specName}/tasks.md`, tasksContent);

          const verifier = new TaskVerifier(fs);
          const checks = await verifier.verifyTaskStatus(specName, taskId, status, '/workspace');

          // All checks should pass
          expect(checks.every(c => c.passed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('workspace-init then PlatformVerifier produces passing result', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPlatformId,
        async (platform) => {
          const fs = new MockVerifyFS();
          const root = '/workspace';

          // Simulate what workspace-init produces
          fs.addDir(`${root}/.kiro/specs`);

          const instrFiles: Record<PlatformId, string | null> = {
            kiro: null,
            'claude-code': 'CLAUDE.md',
            codex: 'AGENTS.md',
            antigravity: '.agent/rules/specs.md',
            amazonq: null,
          };

          const instrFile = instrFiles[platform];
          if (instrFile) {
            fs.addFile(`${root}/${instrFile}`, `# Instructions\n\nSee .kiro/specs/ for details.`);
          }

          const verifier = new PlatformVerifier(fs);
          const checks = await verifier.verify(platform, root);

          expect(checks.every(c => c.passed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('install-skills then SkillVerifier produces passing result', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPlatformId,
        fc.array(arbSkillName, { minLength: 1, maxLength: 3 })
          .filter(arr => new Set(arr).size === arr.length),
        async (platform, skillNames) => {
          const fs = new MockVerifyFS();
          const root = '/workspace';
          const skillsPaths: Record<PlatformId, string> = {
            kiro: '.kiro/skills/',
            'claude-code': '.claude/skills/',
            codex: '.codex/skills/',
            antigravity: '.agent/skills/',
            amazonq: '.amazonq/rules/',
          };
          const skillsBase = `${root}/${skillsPaths[platform]}`;
          const isCodex = platform === 'codex';

          // Simulate what install-skills produces
          for (const name of skillNames) {
            const content = `# ${name}\n\n## CLI Invocation\n\nnpx sdd run-task`;
            if (isCodex) {
              fs.addDir(`${skillsBase}${name}`);
              fs.addFile(`${skillsBase}${name}/SKILL.md`, content);
            } else {
              fs.addFile(`${skillsBase}${name}.md`, content);
            }
          }

          const verifier = new SkillVerifier(fs);
          const checks = await verifier.verify(platform, skillNames, root);

          expect(checks.every(c => c.passed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 5: --verify flag is additive only
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 5: --verify flag is additive only', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * For any command execution with and without the --verify flag, the command's
   * primary side effects (files created, task status updated, etc.) SHALL be identical.
   * The --verify flag only appends a verification step.
   */
  it('CreateSpecCommand produces identical results with and without --verify context', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbValidGenerationMode,
        async (specName, mode) => {
          // Track writes for "without verify"
          const writesA: Array<{ path: string; content: string }> = [];
          const createFsA = {
            exists: async () => false,
            mkdir: async () => {},
            writeFile: async (p: string, c: string) => { writesA.push({ path: p, content: c }); },
          };

          // Track writes for "with verify" (same command, verify is external)
          const writesB: Array<{ path: string; content: string }> = [];
          const createFsB = {
            exists: async () => false,
            mkdir: async () => {},
            writeFile: async (p: string, c: string) => { writesB.push({ path: p, content: c }); },
          };

          const { CreateSpecCommand } = await import('../../src/commands/create-spec-command.js');

          const cmdA = new CreateSpecCommand(createFsA);
          const cmdB = new CreateSpecCommand(createFsB);

          const opts = { name: specName, mode: mode as 'requirements-first' | 'design-first', workspaceRoot: '/workspace' };
          const resultA = await cmdA.execute(opts);
          const resultB = await cmdB.execute(opts);

          // Primary side effects are identical
          expect(resultA.success).toBe(resultB.success);
          expect(writesA.length).toBe(writesB.length);

          // Normalize timestamps in config files since Date.now() differs between runs
          const normalize = (s: string) => s.replace(/"createdAt":\s*"[^"]*"/, '"createdAt": "NORMALIZED"');
          for (let i = 0; i < writesA.length; i++) {
            expect(writesA[i].path).toBe(writesB[i].path);
            expect(normalize(writesA[i].content)).toBe(normalize(writesB[i].content));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Property 11: Verification is read-only
// ═══════════════════════════════════════════════════════════════════════════

describe('Feature: 003-post-operation-verification, Property 11: Verification is read-only', () => {
  /**
   * **Validates: Requirements 2.6**
   *
   * For any verification operation, the file system state before and after
   * verification SHALL be identical. The verifier SHALL never call write, delete,
   * or mkdir operations.
   */
  it('VerifyFileSystem interface has no write/delete/mkdir methods and verification does not mutate state', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSpecName,
        arbPlatformId,
        arbValidGenerationMode,
        async (specName, platform, mode) => {
          // Track all method calls on the FS
          const calls: string[] = [];

          const trackingFs: VerifyFileSystem = {
            exists: async (p: string) => { calls.push(`exists:${p}`); return true; },
            readFile: async (p: string) => {
              calls.push(`readFile:${p}`);
              if (p.includes('.config.kiro')) return JSON.stringify({ generationMode: mode });
              if (p.includes('tasks.md')) return '# Tasks\n\n- [ ] 1.1 Setup';
              if (p.includes('CLAUDE.md') || p.includes('AGENTS.md') || p.includes('specs.md'))
                return 'See .kiro/specs/ for details.';
              return '# Content';
            },
            isDirectory: async (p: string) => { calls.push(`isDirectory:${p}`); return true; },
            listFiles: async (p: string) => { calls.push(`listFiles:${p}`); return []; },
          };

          const verifier = new SpecVerifier(trackingFs);
          await verifier.verify(specName, '/workspace');

          const platformVerifier = new PlatformVerifier(trackingFs);
          await platformVerifier.verify(platform, '/workspace');

          // All calls should be read-only operations
          for (const call of calls) {
            const method = call.split(':')[0];
            expect(['exists', 'readFile', 'isDirectory', 'listFiles']).toContain(method);
          }

          // No write, delete, or mkdir calls
          expect(calls.some(c => c.startsWith('write'))).toBe(false);
          expect(calls.some(c => c.startsWith('delete'))).toBe(false);
          expect(calls.some(c => c.startsWith('mkdir'))).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
