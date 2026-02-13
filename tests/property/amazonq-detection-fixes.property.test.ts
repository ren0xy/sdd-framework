/**
 * Property-Based Tests for Amazon Q Detection Fixes
 * 
 * Feature: 010-amazonq-detection-fixes
 * 
 * Properties:
 *   2.1.1: Single marker detection returns correct platform
 *   2.1.2: Priority ordering preserved with multiple markers
 *   2.2.1: Error metadata validPlatforms matches Validator.VALID_PLATFORMS
 * 
 * Validates: Requirements 1, 2, 3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkspaceAdapter, type WorkspaceFileSystem } from '../../src/workspace/workspace-adapter';
import { KiroAdapter } from '../../src/adapters/kiro-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { CodexAdapter } from '../../src/adapters/codex-adapter';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import { AmazonQAdapter } from '../../src/adapters/amazonq-adapter';
import { InstallSkillsCommand } from '../../src/commands/install-skills-command';
import type { InstallSkillsFileSystem } from '../../src/commands/install-skills-command';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { allSkills } from '../../src/skills/index';
import { Validator } from '../../src/validation/validator';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import type { PlatformId } from '../../src/types';

// --- Mock File System ---

class MockWorkspaceFileSystem implements WorkspaceFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  async exists(path: string): Promise<boolean> {
    const normalizedPath = path.endsWith('/') ? path : path + '/';
    return this.directories.has(path) ||
           this.directories.has(normalizedPath) ||
           this.files.has(path);
  }

  async mkdir(path: string): Promise<void> { this.directories.add(path); }
  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }
  async writeFile(path: string, content: string): Promise<void> { this.files.set(path, content); }
  async readdir(path: string): Promise<string[]> { return []; }
  async copyDirectory(source: string, target: string): Promise<void> {}
  async isDirectory(path: string): Promise<boolean> {
    const normalizedPath = path.endsWith('/') ? path : path + '/';
    return this.directories.has(path) || this.directories.has(normalizedPath);
  }

  addDirectory(path: string): void { this.directories.add(path); }
  addFile(path: string, content: string): void { this.files.set(path, content); }
}

// --- Helpers ---


/**
 * All platform markers: directory or file markers mapped to their expected PlatformId.
 * This is the single source of truth for the detection cascade.
 */
const PLATFORM_MARKERS: Array<{ marker: string; isDir: boolean; expected: PlatformId }> = [
  { marker: '.kiro/', isDir: true, expected: 'kiro' },
  { marker: '.claude/', isDir: true, expected: 'claude-code' },
  { marker: 'CLAUDE.md', isDir: false, expected: 'claude-code' },
  { marker: '.codex/', isDir: true, expected: 'codex' },
  { marker: 'AGENTS.md', isDir: false, expected: 'codex' },
  { marker: '.agent/', isDir: true, expected: 'antigravity' },
  { marker: '.amazonq/', isDir: true, expected: 'amazonq' },
];

/** The expected priority order (highest to lowest) */
const PRIORITY_ORDER: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];

function createFullAdapterMap(): Map<PlatformId, PlatformAdapter> {
  const adapters = new Map<PlatformId, PlatformAdapter>();
  adapters.set('kiro', new KiroAdapter());
  adapters.set('claude-code', new ClaudeCodeAdapter());
  adapters.set('codex', new CodexAdapter());
  adapters.set('antigravity', new AntigravityAdapter());
  adapters.set('amazonq', new AmazonQAdapter());
  return adapters;
}

// --- Property Tests ---

describe('Property 2.1.1: Single marker detection returns correct platform', () => {
  /**
   * **Validates: Requirements 1, 2**
   *
   * For any single platform marker directory/file, detectCurrentPlatform
   * returns the correct platform.
   */
  it('detects the correct platform for any single marker', async () => {
    const arbitraryMarker = fc.constantFrom(...PLATFORM_MARKERS);

    await fc.assert(
      fc.asyncProperty(arbitraryMarker, async ({ marker, isDir, expected }) => {
        const adapter = new WorkspaceAdapter(createFullAdapterMap());
        const fs = new MockWorkspaceFileSystem();

        if (isDir) {
          fs.addDirectory(marker);
        } else {
          fs.addFile(marker, '');
        }

        const detected = await adapter.detectCurrentPlatform(fs);
        expect(detected).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1**
   *
   * Specifically, a workspace with only .amazonq/ returns 'amazonq'.
   */
  it('detects amazonq when only .amazonq/ marker exists', async () => {
    const adapter = new WorkspaceAdapter(createFullAdapterMap());
    const fs = new MockWorkspaceFileSystem();
    fs.addDirectory('.amazonq/');

    const detected = await adapter.detectCurrentPlatform(fs);
    expect(detected).toBe('amazonq');
  });

  /**
   * Returns null when no markers exist.
   */
  it('returns null when no platform markers exist', async () => {
    const adapter = new WorkspaceAdapter(createFullAdapterMap());
    const fs = new MockWorkspaceFileSystem();

    const detected = await adapter.detectCurrentPlatform(fs);
    expect(detected).toBeNull();
  });
});

describe('Property 2.1.2: Priority ordering preserved with multiple markers', () => {
  /**
   * **Validates: Requirements 2**
   *
   * When multiple platform markers exist, the higher-priority platform wins.
   * Priority: kiro > claude-code > codex > antigravity > amazonq
   */
  it('higher-priority platform wins when multiple markers present', async () => {
    // Generate pairs of distinct platforms from the priority order
    const arbitraryPlatformPair = fc.integer({ min: 0, max: PRIORITY_ORDER.length - 2 }).chain(higherIdx =>
      fc.integer({ min: higherIdx + 1, max: PRIORITY_ORDER.length - 1 }).map(lowerIdx => ({
        higher: PRIORITY_ORDER[higherIdx],
        lower: PRIORITY_ORDER[lowerIdx],
      }))
    );

    await fc.assert(
      fc.asyncProperty(arbitraryPlatformPair, async ({ higher, lower }) => {
        const adapter = new WorkspaceAdapter(createFullAdapterMap());
        const fs = new MockWorkspaceFileSystem();

        // Add markers for both platforms (use the primary directory marker for each)
        const higherMarker = PLATFORM_MARKERS.find(m => m.expected === higher && m.isDir)!;
        const lowerMarker = PLATFORM_MARKERS.find(m => m.expected === lower && m.isDir)!;

        fs.addDirectory(higherMarker.marker);
        fs.addDirectory(lowerMarker.marker);

        const detected = await adapter.detectCurrentPlatform(fs);
        expect(detected).toBe(higher);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2**
   *
   * .kiro/ always takes priority over .amazonq/
   */
  it('.kiro/ takes priority over .amazonq/', async () => {
    const adapter = new WorkspaceAdapter(createFullAdapterMap());
    const fs = new MockWorkspaceFileSystem();
    fs.addDirectory('.kiro/');
    fs.addDirectory('.amazonq/');

    const detected = await adapter.detectCurrentPlatform(fs);
    expect(detected).toBe('kiro');
  });
});

describe('Property 2.2.1: Error metadata validPlatforms matches Validator.VALID_PLATFORMS', () => {
  /**
   * **Validates: Requirements 3**
   *
   * For any invalid platform string, the error metadata validPlatforms array
   * matches the set of platforms accepted by Validator.validatePlatform.
   */
  it('error validPlatforms matches Validator accepted platforms', async () => {
    const arbitraryInvalidPlatform = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')),
      { minLength: 1, maxLength: 20 }
    ).filter(s => !Validator.isValidPlatform(s));

    await fc.assert(
      fc.asyncProperty(arbitraryInvalidPlatform, async (badPlatform) => {
        const registry = new SkillRegistry();
        allSkills.forEach(skill => registry.register(skill));
        const adapters = createFullAdapterMap();
        const mockFs: InstallSkillsFileSystem = {
          exists: async () => false,
          mkdir: async () => {},
          writeFile: async () => {},
        };
        const command = new InstallSkillsCommand(registry, adapters, mockFs);

        const result = await command.execute({ platform: badPlatform as PlatformId });

        expect(result.success).toBe(false);
        const details = result.error?.details as { validPlatforms?: string[] } | undefined;
        expect(details?.validPlatforms).toBeDefined();

        // The validPlatforms in error details must match exactly the set
        // of platforms that Validator considers valid
        const validFromDetails = [...details!.validPlatforms!].sort();
        const validFromValidator = PRIORITY_ORDER.slice().sort();
        expect(validFromDetails).toEqual(validFromValidator);

        // Double-check each one passes validation
        for (const p of details!.validPlatforms!) {
          expect(Validator.isValidPlatform(p)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
