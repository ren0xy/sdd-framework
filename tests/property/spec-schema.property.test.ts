/**
 * Property-Based Tests for Spec Schema Validation
 * 
 * Validates that spec folder schema validation catches drift
 * and ensures consistency across platforms.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateSpecConfig,
  validateSpecFolder,
  validateAllSpecs,
  type ValidationFileSystem,
} from '../../src/workspace/spec-schema';
import type { PlatformId } from '../../src/types';

/**
 * Generator for valid platform IDs
 */
const arbitraryPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

/**
 * Generator for valid generation modes
 */
const arbitraryGenerationMode = fc.constantFrom('requirements-first', 'design-first');

/**
 * Generator for valid spec configs
 */
const arbitraryValidConfig = fc.record({
  generationMode: arbitraryGenerationMode,
  platform: arbitraryPlatformId,
  createdAt: fc.date().map(d => d.toISOString()),
});

/**
 * Generator for invalid configs (missing required fields)
 */
const arbitraryInvalidConfig = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant({}),
  fc.constant({ platform: 'kiro' }), // missing generationMode
  fc.constant({ generationMode: 'invalid-mode' }), // invalid generationMode
);

/**
 * Mock file system for testing
 */
class MockValidationFS implements ValidationFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  addDirectory(path: string): void {
    this.directories.add(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.directories.has(path) || this.files.has(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async readdir(path: string): Promise<string[]> {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    const entries: string[] = [];
    
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(normalizedPath)) {
        const relative = filePath.slice(normalizedPath.length);
        const firstPart = relative.split('/')[0];
        if (firstPart && !entries.includes(firstPart)) {
          entries.push(firstPart);
        }
      }
    }
    
    for (const dirPath of this.directories) {
      if (dirPath.startsWith(normalizedPath) && dirPath !== normalizedPath) {
        const relative = dirPath.slice(normalizedPath.length);
        const firstPart = relative.split('/')[0];
        if (firstPart && !entries.includes(firstPart)) {
          entries.push(firstPart);
        }
      }
    }
    
    return entries;
  }

  async isDirectory(path: string): Promise<boolean> {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    return this.directories.has(path) || this.directories.has(normalizedPath) || this.directories.has(`${normalizedPath}/`);
  }
}

describe('Spec Config Schema Validation', () => {
  /**
   * Property: Valid configs always pass validation
   */
  it('accepts all valid configs', () => {
    fc.assert(
      fc.property(arbitraryValidConfig, (config) => {
        const result = validateSpecConfig(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid configs always fail validation
   */
  it('rejects invalid configs', () => {
    fc.assert(
      fc.property(arbitraryInvalidConfig, (config) => {
        const result = validateSpecConfig(config);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Missing platform produces warning, not error
   */
  it('warns but accepts configs without platform', () => {
    fc.assert(
      fc.property(arbitraryGenerationMode, (generationMode) => {
        const config = { generationMode };
        const result = validateSpecConfig(config);
        
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.code === 'MISSING_PLATFORM')).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property: Invalid platform is an error
   */
  it('rejects invalid platform values', () => {
    fc.assert(
      fc.property(
        arbitraryGenerationMode,
        fc.string().filter(s => !['kiro', 'claude-code', 'codex', 'antigravity'].includes(s)),
        (generationMode, invalidPlatform) => {
          const config = { generationMode, platform: invalidPlatform };
          const result = validateSpecConfig(config);
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.code === 'INVALID_PLATFORM')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Invalid generationMode is always an error
   */
  it('rejects invalid generationMode values', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !['requirements-first', 'design-first'].includes(s)),
        (invalidMode) => {
          const config = { generationMode: invalidMode, platform: 'kiro' };
          const result = validateSpecConfig(config);
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => 
            e.code === 'INVALID_GENERATION_MODE' || e.code === 'MISSING_GENERATION_MODE'
          )).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Spec Folder Validation', () => {
  /**
   * Property: Valid spec folder passes validation
   */
  it('accepts valid spec folders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        arbitraryValidConfig,
        fc.constantFrom('.config.json', '.config.kiro'),
        async (specName, config, configFile) => {
          const fs = new MockValidationFS();
          const specPath = `.kiro/specs/${specName}/`;
          
          fs.addDirectory(specPath);
          fs.addFile(`${specPath}${configFile}`, JSON.stringify(config));
          
          const result = await validateSpecFolder(specPath, fs);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Missing config file fails validation
   */
  it('rejects spec folders without config file', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        async (specName) => {
          const fs = new MockValidationFS();
          const specPath = `.kiro/specs/${specName}/`;
          
          fs.addDirectory(specPath);
          // No config file added
          
          const result = await validateSpecFolder(specPath, fs);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.code === 'MISSING_CONFIG')).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Non-existent folder fails validation
   */
  it('rejects non-existent spec folders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        async (specName) => {
          const fs = new MockValidationFS();
          const specPath = `.kiro/specs/${specName}/`;
          // Don't add the directory
          
          const result = await validateSpecFolder(specPath, fs);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.code === 'SPEC_NOT_FOUND')).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Empty spec folder produces warning
   */
  it('warns about empty spec folders', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        arbitraryValidConfig,
        async (specName, config) => {
          const fs = new MockValidationFS();
          const specPath = `.kiro/specs/${specName}/`;
          
          fs.addDirectory(specPath);
          fs.addFile(`${specPath}.config.json`, JSON.stringify(config));
          // No content files (requirements.md, etc.)
          
          const result = await validateSpecFolder(specPath, fs);
          expect(result.valid).toBe(true); // Still valid, just a warning
          expect(result.warnings.some(w => w.code === 'EMPTY_SPEC')).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Invalid JSON in config fails validation
   */
  it('rejects spec folders with invalid JSON config', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
        fc.string().filter(s => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        async (specName, invalidJson) => {
          const fs = new MockValidationFS();
          const specPath = `.kiro/specs/${specName}/`;
          
          fs.addDirectory(specPath);
          fs.addFile(`${specPath}.config.json`, invalidJson);
          
          const result = await validateSpecFolder(specPath, fs);
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.code === 'INVALID_CONFIG_JSON')).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Validate All Specs', () => {
  /**
   * Property: Returns results for all spec folders
   */
  it('validates all specs in directory', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ).filter(arr => new Set(arr).size === arr.length), // unique names
        arbitraryValidConfig,
        async (specNames, config) => {
          const fs = new MockValidationFS();
          const specsPath = '.kiro/specs/';
          
          fs.addDirectory(specsPath);
          
          for (const name of specNames) {
            const specPath = `${specsPath}${name}/`;
            fs.addDirectory(specPath);
            fs.addFile(`${specPath}.config.json`, JSON.stringify(config));
          }
          
          const results = await validateAllSpecs(specsPath, fs);
          
          expect(results.size).toBe(specNames.length);
          for (const name of specNames) {
            expect(results.has(name)).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Returns empty map for non-existent specs directory
   */
  it('returns empty map when specs directory does not exist', async () => {
    const fs = new MockValidationFS();
    const results = await validateAllSpecs('.kiro/specs/', fs);
    expect(results.size).toBe(0);
  });
});
