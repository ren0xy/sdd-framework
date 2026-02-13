/**
 * Property-Based Tests for Spec Folder Creation
 * 
 * Feature: 000-sdd-framework-init
 * Property 5: Spec Folder Created at Platform-Appropriate Location
 * Property 6: Duplicate Spec Folder Returns Error
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SkillTransformer, type FileSystemOperations } from '../../src/transformer/skill-transformer';
import { SkillRegistry } from '../../src/registry/skill-registry';
import { KiroAdapter } from '../../src/adapters/kiro-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { CodexAdapter } from '../../src/adapters/codex-adapter';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import { AmazonQAdapter } from '../../src/adapters/amazonq-adapter';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import type { PlatformId } from '../../src/types';

/**
 * Generator for valid kebab-case feature names
 */
const arbitraryFeatureName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 2, maxLength: 15 }
).map(s => {
  // Ensure it starts with a letter and is valid kebab-case
  const base = s.replace(/^[0-9]+/, '').toLowerCase();
  if (base.length < 2) return 'feature';
  // Insert hyphens randomly to create kebab-case
  return base;
}).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

/**
 * Generator for valid platform IDs
 */
const arbitraryPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'
);

/**
 * Mock file system for testing
 */
class MockFileSystem implements FileSystemOperations {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  async exists(path: string): Promise<boolean> {
    return this.directories.has(path) || this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  getFiles(): Map<string, string> {
    return this.files;
  }

  getDirectories(): Set<string> {
    return this.directories;
  }

  addExistingDirectory(path: string): void {
    this.directories.add(path);
  }
}

/**
 * Create a transformer with all platform adapters
 */
function createTransformer(): SkillTransformer {
  const registry = new SkillRegistry();
  const adapters = new Map<PlatformId, PlatformAdapter>([
    ['kiro', new KiroAdapter()],
    ['claude-code', new ClaudeCodeAdapter()],
    ['codex', new CodexAdapter()],
    ['antigravity', new AntigravityAdapter()],
    ['amazonq', new AmazonQAdapter()],
  ]);
  return new SkillTransformer(registry, adapters);
}

describe('Property 5: Spec Folder Created at Platform-Appropriate Location', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * Property: For any valid feature name and target platform, creating a spec folder
   * SHALL place it at `.kiro/specs/{feature-name}/` with a valid configuration file.
   */
  it('creates spec folder at correct location for each platform', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName, platform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          const result = await transformer.createSpecFolder(featureName, platform, fs);

          // Should succeed
          expect(result.success).toBe(true);
          expect(result.error).toBeUndefined();

          // All platforms use .kiro/specs/
          expect(result.path).toBe(`.kiro/specs/${featureName}/`);

          // Verify directory was created
          expect(fs.getDirectories().has(result.path)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   * 
   * Property: All platforms use .kiro/specs/ path
   */
  it('all platforms use .kiro/specs/ path', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName, platform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          const result = await transformer.createSpecFolder(featureName, platform, fs);

          expect(result.success).toBe(true);
          expect(result.path).toMatch(/^\.kiro\/specs\//);
          expect(result.path).toBe(`.kiro/specs/${featureName}/`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * 
   * Property: Config file is created with valid content
   */
  it('creates config file with valid configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName, platform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          const result = await transformer.createSpecFolder(featureName, platform, fs);

          expect(result.success).toBe(true);

          // Find the config file
          const files = fs.getFiles();
          const configExtension = platform === 'kiro' ? '.config.kiro' : '.config.json';
          const configPath = `${result.path}${configExtension}`;

          expect(files.has(configPath)).toBe(true);

          // Verify config content is valid JSON
          const configContent = files.get(configPath)!;
          const config = JSON.parse(configContent);

          expect(config.generationMode).toBe('requirements-first');
          expect(config.platform).toBe(platform);
          expect(config.createdAt).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: getSpecPath returns correct path without creating folder
   */
  it('getSpecPath returns correct path for each platform', () => {
    fc.assert(
      fc.property(
        arbitraryFeatureName,
        arbitraryPlatformId,
        (featureName, platform) => {
          const transformer = createTransformer();
          const path = transformer.getSpecPath(featureName, platform);

          // All platforms use .kiro/specs/
          expect(path).toBe(`.kiro/specs/${featureName}/`);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 6: Duplicate Spec Folder Returns Error', () => {
  /**
   * **Validates: Requirements 3.5**
   * 
   * Property: For any existing spec folder, attempting to create a spec with the
   * same name SHALL return an error and leave the original content unchanged.
   */
  it('returns error when spec folder already exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName, platform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          // First creation should succeed
          const firstResult = await transformer.createSpecFolder(featureName, platform, fs);
          expect(firstResult.success).toBe(true);

          // Record the state after first creation
          const directoriesAfterFirst = new Set(fs.getDirectories());
          const filesAfterFirst = new Map(fs.getFiles());

          // Second creation should fail
          const secondResult = await transformer.createSpecFolder(featureName, platform, fs);

          expect(secondResult.success).toBe(false);
          expect(secondResult.error).toBeDefined();
          expect(secondResult.error).toContain('already exists');

          // Verify original content unchanged
          expect(fs.getDirectories()).toEqual(directoriesAfterFirst);
          expect(fs.getFiles()).toEqual(filesAfterFirst);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pre-existing folder prevents creation
   */
  it('fails when folder pre-exists before any creation attempt', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName, platform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          // Pre-create the directory (all platforms use .kiro/specs/)
          const expectedPath = `.kiro/specs/${featureName}/`;
          fs.addExistingDirectory(expectedPath);

          // Attempt to create should fail
          const result = await transformer.createSpecFolder(featureName, platform, fs);

          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('already exists');
          expect(result.path).toBe(expectedPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error message includes the path
   */
  it('error message includes the conflicting path', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName, platform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          // Create first
          await transformer.createSpecFolder(featureName, platform, fs);

          // Try to create again
          const result = await transformer.createSpecFolder(featureName, platform, fs);

          expect(result.success).toBe(false);
          expect(result.error).toContain(result.path);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different feature names don't conflict
   */
  it('different feature names can be created independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryFeatureName,
        arbitraryPlatformId,
        async (featureName1, featureName2, platform) => {
          // Skip if names are the same
          fc.pre(featureName1 !== featureName2);

          const transformer = createTransformer();
          const fs = new MockFileSystem();

          // Create first feature
          const result1 = await transformer.createSpecFolder(featureName1, platform, fs);
          expect(result1.success).toBe(true);

          // Create second feature should also succeed
          const result2 = await transformer.createSpecFolder(featureName2, platform, fs);
          expect(result2.success).toBe(true);

          // Both directories should exist
          expect(fs.getDirectories().has(result1.path)).toBe(true);
          expect(fs.getDirectories().has(result2.path)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Cross-Platform Spec Format Compatibility', () => {
  /**
   * Property: Spec created on any platform can be read by any other platform's adapter.
   * This validates that the unified .kiro/specs/ location works across all platforms.
   */
  it('spec created on one platform is accessible from all platforms', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitraryPlatformId,
        arbitraryPlatformId,
        async (featureName, sourcePlatform, targetPlatform) => {
          const transformer = createTransformer();
          const fs = new MockFileSystem();

          // Create spec on source platform
          const createResult = await transformer.createSpecFolder(featureName, sourcePlatform, fs);
          expect(createResult.success).toBe(true);

          // Verify the path is accessible from target platform's perspective
          // All platforms should use the same .kiro/specs/ path
          const expectedPath = `.kiro/specs/${featureName}/`;
          expect(createResult.path).toBe(expectedPath);

          // The spec folder should exist regardless of which platform created it
          expect(fs.getDirectories().has(expectedPath)).toBe(true);

          // Config file should be readable (exists and is valid JSON)
          const files = fs.getFiles();
          const configExtension = sourcePlatform === 'kiro' ? '.config.kiro' : '.config.json';
          const configPath = `${expectedPath}${configExtension}`;
          
          expect(files.has(configPath)).toBe(true);
          const configContent = files.get(configPath)!;
          
          // Should be valid JSON parseable by any platform
          expect(() => JSON.parse(configContent)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Config content is consistent regardless of source platform.
   * The config structure should be identical across platforms (only extension differs).
   */
  it('config structure is consistent across all platforms', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        async (featureName) => {
          const transformer = createTransformer();
          const platforms: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
          const configs: Record<string, unknown>[] = [];

          for (const platform of platforms) {
            const fs = new MockFileSystem();
            const result = await transformer.createSpecFolder(featureName, platform, fs);
            expect(result.success).toBe(true);

            const configExtension = platform === 'kiro' ? '.config.kiro' : '.config.json';
            const configPath = `${result.path}${configExtension}`;
            const configContent = fs.getFiles().get(configPath)!;
            const config = JSON.parse(configContent);
            
            // Normalize: remove platform-specific field for comparison
            const { platform: _, createdAt: __, ...normalizedConfig } = config;
            configs.push(normalizedConfig);
          }

          // All normalized configs should have the same structure
          const firstConfig = configs[0];
          for (const config of configs.slice(1)) {
            expect(Object.keys(config).sort()).toEqual(Object.keys(firstConfig).sort());
            expect(config.generationMode).toBe(firstConfig.generationMode);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Spec path is deterministic - same feature name always produces same path
   * regardless of platform or creation order.
   */
  it('spec path is deterministic across platforms', () => {
    fc.assert(
      fc.property(
        arbitraryFeatureName,
        arbitraryPlatformId,
        arbitraryPlatformId,
        (featureName, platform1, platform2) => {
          const transformer = createTransformer();
          
          const path1 = transformer.getSpecPath(featureName, platform1);
          const path2 = transformer.getSpecPath(featureName, platform2);

          // Same feature name should always produce same path
          expect(path1).toBe(path2);
          expect(path1).toBe(`.kiro/specs/${featureName}/`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple specs created on different platforms coexist without conflict.
   */
  it('specs from different platforms coexist in shared location', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(arbitraryFeatureName, arbitraryPlatformId), { minLength: 2, maxLength: 5 }),
        async (specDefinitions) => {
          // Ensure unique feature names
          const uniqueNames = new Set(specDefinitions.map(([name]) => name));
          fc.pre(uniqueNames.size === specDefinitions.length);

          const transformer = createTransformer();
          const fs = new MockFileSystem();

          // Create specs on various platforms
          for (const [featureName, platform] of specDefinitions) {
            const result = await transformer.createSpecFolder(featureName, platform, fs);
            expect(result.success).toBe(true);
          }

          // All specs should exist in .kiro/specs/
          for (const [featureName] of specDefinitions) {
            const expectedPath = `.kiro/specs/${featureName}/`;
            expect(fs.getDirectories().has(expectedPath)).toBe(true);
          }

          // Total directories should match number of specs (plus parent dirs)
          const specDirs = Array.from(fs.getDirectories()).filter(d => 
            d.startsWith('.kiro/specs/') && d !== '.kiro/specs/'
          );
          expect(specDirs.length).toBe(specDefinitions.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});
