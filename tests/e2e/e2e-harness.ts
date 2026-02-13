/**
 * E2E Test Harness for Platform Switching Tests
 *
 * Provides InMemoryFS, adapter/registry factories, and a round-trip orchestrator
 * for cross-platform end-to-end testing.
 *
 * Feature: 004-e2e-platform-switching-tests
 */

import * as path from 'path';
import type { PlatformId } from '../../src/types';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import type { WorkspaceInitFileSystem } from '../../src/commands/workspace-init-command';
import type { CreateSpecFileSystem } from '../../src/commands/create-spec-command';
import type { InstallSkillsFileSystem } from '../../src/commands/install-skills-command';
import type { VerifyFileSystem } from '../../src/verification/verify-file-system';

/**
 * Normalize a path to forward slashes and resolve relative segments.
 */
function normalizePath(p: string): string {
  // Replace backslashes with forward slashes
  let normalized = p.replace(/\\/g, '/');
  // Remove trailing slash unless it's the root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * InMemoryFS — satisfies WorkspaceInitFileSystem, CreateSpecFileSystem,
 * InstallSkillsFileSystem, and VerifyFileSystem interfaces.
 *
 * All paths are normalized to forward slashes.
 */
export class InMemoryFS
  implements WorkspaceInitFileSystem, CreateSpecFileSystem,
             InstallSkillsFileSystem, VerifyFileSystem
{
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();
  private _failOnNextWrite = false;

  async exists(p: string): Promise<boolean> {
    const np = normalizePath(p);
    return this.files.has(np) || this.dirs.has(np);
  }

  async mkdir(p: string, options?: { recursive?: boolean }): Promise<void> {
    const np = normalizePath(p);
    if (options?.recursive) {
      // Create all ancestor directories
      const parts = np.split('/').filter(Boolean);
      const prefix = np.startsWith('/') ? '/' : '';
      let current = '';
      for (const part of parts) {
        current = current ? `${current}/${part}` : `${prefix}${part}`;
        this.dirs.add(current);
      }
    }
    this.dirs.add(np);
  }

  async writeFile(p: string, content: string): Promise<void> {
    if (this._failOnNextWrite) {
      this._failOnNextWrite = false;
      throw new Error('Simulated write failure');
    }
    const np = normalizePath(p);
    this.files.set(np, content);
    // Implicitly create parent directories
    const lastSlash = np.lastIndexOf('/');
    if (lastSlash > 0) {
      await this.mkdir(np.substring(0, lastSlash), { recursive: true });
    }
  }

  async readFile(p: string): Promise<string> {
    const np = normalizePath(p);
    const content = this.files.get(np);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file: ${np}`);
    }
    return content;
  }

  async readdir(p: string): Promise<string[]> {
    const np = normalizePath(p);
    const entries = new Set<string>();
    const prefix = np + '/';

    // Collect direct children from files
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const rest = filePath.slice(prefix.length);
        const firstSegment = rest.split('/')[0];
        entries.add(firstSegment);
      }
    }

    // Collect direct children from dirs
    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(prefix)) {
        const rest = dirPath.slice(prefix.length);
        const firstSegment = rest.split('/')[0];
        entries.add(firstSegment);
      }
    }

    return Array.from(entries);
  }

  async isDirectory(p: string): Promise<boolean> {
    const np = normalizePath(p);
    return this.dirs.has(np);
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const np = normalizePath(dirPath);
    const result: string[] = [];
    const prefix = np + '/';

    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        result.push(filePath);
      }
    }

    return result;
  }

  // --- Test inspection helpers ---

  getFile(p: string): string | undefined {
    return this.files.get(normalizePath(p));
  }

  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  getAllDirs(): Set<string> {
    return new Set(this.dirs);
  }

  hasFile(p: string): boolean {
    return this.files.has(normalizePath(p));
  }

  hasDir(p: string): boolean {
    return this.dirs.has(normalizePath(p));
  }

  /**
   * Configure the next writeFile call to throw an error.
   */
  failOnNextWrite(): void {
    this._failOnNextWrite = true;
  }
}

// --- Factory Functions ---

import {
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
  AmazonQAdapter,
} from '../../src/adapters/index';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { allSkills } from '../../src/skills/index';

/**
 * Create a Map of all four platform adapters.
 */
export function createAdapters(): Map<PlatformId, PlatformAdapter> {
  const adapters = new Map<PlatformId, PlatformAdapter>();
  adapters.set('kiro', new KiroAdapter());
  adapters.set('claude-code', new ClaudeCodeAdapter());
  adapters.set('codex', new CodexAdapter());
  adapters.set('antigravity', new AntigravityAdapter());
  adapters.set('amazonq', new AmazonQAdapter());
  return adapters;
}

/**
 * Create a SkillRegistry pre-loaded with all canonical skills.
 */
export function createSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  for (const skill of allSkills) {
    registry.register(skill);
  }
  return registry;
}

// --- Round-Trip Orchestrator ---

import type { CommandResult } from '../../src/commands/command-result';
import type { WorkspaceInitResult } from '../../src/commands/workspace-init-command';
import { WorkspaceInitCommand } from '../../src/commands/workspace-init-command';
import type { CreateSpecResult } from '../../src/commands/create-spec-command';
import { CreateSpecCommand } from '../../src/commands/create-spec-command';
import type { InstallSkillsResult } from '../../src/commands/install-skills-command';
import { InstallSkillsCommand } from '../../src/commands/install-skills-command';
import type { VerificationData } from '../../src/verification/verification-data';
import { VerifyCommand } from '../../src/commands/verify-command';

/**
 * Result of a full round-trip scenario.
 */
export interface RoundTripResult {
  sourceInit: CommandResult<WorkspaceInitResult>;
  specCreation: CommandResult<CreateSpecResult>;
  targetInit: CommandResult<WorkspaceInitResult>;
  skillInstall: CommandResult<InstallSkillsResult>;
  verification: CommandResult<VerificationData>;
  fs: InMemoryFS;
}

/**
 * Execute a full round-trip scenario:
 *   workspace-init source → create-spec → workspace-init target →
 *   install-skills target → verify (spec + platform + skills)
 *
 * All steps operate on the same InMemoryFS instance.
 * Does NOT short-circuit on failure — captures all results.
 */
export async function runRoundTrip(
  source: PlatformId,
  target: PlatformId,
  specName: string
): Promise<RoundTripResult> {
  const fs = new InMemoryFS();
  const adapters = createAdapters();
  const registry = createSkillRegistry();
  const workspaceRoot = '/workspace';

  // 1. workspace-init for source platform
  const sourceInitCmd = new WorkspaceInitCommand(fs, adapters);
  const sourceInit = await sourceInitCmd.execute({ platform: source, workspaceRoot });

  // 2. create-spec
  const createSpecCmd = new CreateSpecCommand(fs);
  const specCreation = await createSpecCmd.execute({ name: specName, workspaceRoot });

  // 3. workspace-init for target platform (same FS — preserves files)
  const targetInitCmd = new WorkspaceInitCommand(fs, adapters);
  const targetInit = await targetInitCmd.execute({ platform: target, workspaceRoot });

  // 4. install-skills for target platform
  const installCmd = new InstallSkillsCommand(registry, adapters, fs);
  const skillInstall = await installCmd.execute({ platform: target, force: true, workspaceRoot });

  // 5. verify --spec --platform on target
  //    Note: skills are verified for existence only (not content) because
  //    InstallSkillsCommand uses adapter.formatSkill() which doesn't inject
  //    CLI invocation sections. Content verification is a separate concern.
  const verifyCmd = new VerifyCommand(fs);
  const verification = await verifyCmd.execute({
    spec: specName,
    platform: target,
    workspaceRoot,
  });

  return { sourceInit, specCreation, targetInit, skillInstall, verification, fs };
}
