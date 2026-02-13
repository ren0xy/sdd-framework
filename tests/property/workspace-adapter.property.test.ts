/**
 * Property-Based Tests for Workspace Adapter
 * 
 * Feature: 000-sdd-framework-init
 * Property 1: Content Preservation During Transformation
 * Property 2: Instructions File Contains Spec References
 * Property 17: Cross-Platform Spec Reading
 * 
 * Validates: Requirements 1.2, 1.3, 1.4, 9.1, 9.2, 9.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { WorkspaceAdapter, type WorkspaceFileSystem } from '../../src/workspace/workspace-adapter';
import { KiroAdapter } from '../../src/adapters/kiro-adapter';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code-adapter';
import { CodexAdapter } from '../../src/adapters/codex-adapter';
import { AntigravityAdapter } from '../../src/adapters/antigravity-adapter';
import type { PlatformAdapter } from '../../src/adapters/platform-adapter';
import type { PlatformId } from '../../src/types';

/**
 * Generator for valid kebab-case feature names
 */
const arbitraryFeatureName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 2, maxLength: 15 }
).map(s => {
  const base = s.replace(/^[0-9]+/, '').toLowerCase();
  if (base.length < 2) return 'feature';
  return base;
}).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

/**
 * Generator for valid platform IDs
 */
const arbitraryPlatformId: fc.Arbitrary<PlatformId> = fc.constantFrom(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

/**
 * Generator for arbitrary file content
 */
const arbitraryFileContent = fc.string({ minLength: 0, maxLength: 500 });

/**
 * Generator for spec file structure
 */
const arbitrarySpecFiles = fc.record({
  'requirements.md': arbitraryFileContent,
  'design.md': arbitraryFileContent,
  'tasks.md': arbitraryFileContent,
});

/**
 * Mock file system for testing workspace operations
 */
class MockWorkspaceFileSystem implements WorkspaceFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  async exists(path: string): Promise<boolean> {
    // Normalize path for comparison
    const normalizedPath = path.endsWith('/') ? path : path + '/';
    return this.directories.has(path) || 
           this.directories.has(normalizedPath) ||
           this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.directories.add(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async readdir(path: string): Promise<string[]> {
    const normalizedPath = path.endsWith('/') ? path : path + '/';
    const entries: Set<string> = new Set();
    
    // Find all files and directories under this path
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(normalizedPath)) {
        const relativePath = filePath.slice(normalizedPath.length);
        const firstPart = relativePath.split('/')[0];
        if (firstPart) {
          entries.add(firstPart);
        }
      }
    }
    
    for (const dirPath of this.directories) {
      if (dirPath.startsWith(normalizedPath) && dirPath !== normalizedPath) {
        const relativePath = dirPath.slice(normalizedPath.length);
        const firstPart = relativePath.split('/')[0];
        if (firstPart) {
          entries.add(firstPart);
        }
      }
    }
    
    return Array.from(entries);
  }

  async copyDirectory(source: string, target: string): Promise<void> {
    const normalizedSource = source.endsWith('/') ? source : source + '/';
    const normalizedTarget = target.endsWith('/') ? target : target + '/';
    
    // Create target directory
    this.directories.add(normalizedTarget);
    
    // Copy all files under source to target
    for (const [filePath, content] of this.files.entries()) {
      if (filePath.startsWith(normalizedSource)) {
        const relativePath = filePath.slice(normalizedSource.length);
        const targetPath = normalizedTarget + relativePath;
        this.files.set(targetPath, content);
      }
    }
    
    // Copy subdirectories
    for (const dirPath of this.directories) {
      if (dirPath.startsWith(normalizedSource) && dirPath !== normalizedSource) {
        const relativePath = dirPath.slice(normalizedSource.length);
        const targetPath = normalizedTarget + relativePath;
        this.directories.add(targetPath);
      }
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    const normalizedPath = path.endsWith('/') ? path : path + '/';
    return this.directories.has(path) || this.directories.has(normalizedPath);
  }

  // Helper methods for test setup
  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  addDirectory(path: string): void {
    this.directories.add(path);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }

  getAllDirectories(): Set<string> {
    return new Set(this.directories);
  }
}


/**
 * Create a workspace adapter with all platform adapters
 */
function createWorkspaceAdapter(): WorkspaceAdapter {
  const adapters = new Map<PlatformId, PlatformAdapter>([
    ['kiro', new KiroAdapter()],
    ['claude-code', new ClaudeCodeAdapter()],
    ['codex', new CodexAdapter()],
    ['antigravity', new AntigravityAdapter()],
  ]);
  return new WorkspaceAdapter(adapters);
}

/**
 * Set up a mock file system with specs at a given location
 */
function setupSpecsInFileSystem(
  fs: MockWorkspaceFileSystem,
  specsPath: string,
  specs: Map<string, Record<string, string>>
): void {
  fs.addDirectory(specsPath);
  
  for (const [specName, files] of specs.entries()) {
    const specDir = `${specsPath}${specName}/`;
    fs.addDirectory(specDir);
    
    for (const [fileName, content] of Object.entries(files)) {
      fs.addFile(`${specDir}${fileName}`, content);
    }
  }
}

describe('Property 1: Content Preservation During Transformation', () => {
  /**
   * **Validates: Requirements 1.4**
   * 
   * Property: For any spec directory structure with any content, transforming
   * from one platform to another SHALL produce identical file content at the
   * target location (which is always .kiro/specs/).
   */
  it('preserves all file content during transformation', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        arbitrarySpecFiles,
        fc.constantFrom<PlatformId>('kiro'),
        fc.constantFrom<PlatformId>('claude-code', 'codex', 'antigravity'),
        async (specName, specFiles, sourcePlatform, targetPlatform) => {
          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          // Set up source specs
          const sourceSpecs = new Map([[specName, specFiles]]);
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          // Transform workspace
          const result = await adapter.transformWorkspace(sourcePlatform, targetPlatform, fs);

          expect(result.success).toBe(true);

          // Verify all files were preserved with identical content (all platforms use .kiro/specs/)
          const targetDir = '.kiro/specs/';
          for (const [fileName, originalContent] of Object.entries(specFiles)) {
            const targetPath = `${targetDir}${specName}/${fileName}`;
            const transformedContent = fs.getFile(targetPath);
            
            expect(transformedContent).toBe(originalContent);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple specs are all preserved during transformation
   */
  it('preserves multiple specs during transformation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFeatureName, { minLength: 1, maxLength: 5 }),
        arbitrarySpecFiles,
        async (specNames, specFiles) => {
          // Ensure unique spec names
          const uniqueNames = [...new Set(specNames)];
          if (uniqueNames.length === 0) return;

          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          // Set up source specs
          const sourceSpecs = new Map<string, Record<string, string>>();
          for (const name of uniqueNames) {
            sourceSpecs.set(name, specFiles);
          }
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          // Transform workspace
          const result = await adapter.transformWorkspace('kiro', 'claude-code', fs);

          expect(result.success).toBe(true);
          expect(result.filesTransformed).toBe(uniqueNames.length);

          // Verify all specs were preserved (all platforms use .kiro/specs/)
          for (const specName of uniqueNames) {
            for (const [fileName, originalContent] of Object.entries(specFiles)) {
              const targetPath = `.kiro/specs/${specName}/${fileName}`;
              const transformedContent = fs.getFile(targetPath);
              
              expect(transformedContent).toBe(originalContent);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty files are preserved
   */
  it('preserves empty files during transformation', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        async (specName) => {
          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          // Set up source spec with empty files
          const emptyFiles = {
            'requirements.md': '',
            'design.md': '',
            'tasks.md': '',
          };
          const sourceSpecs = new Map([[specName, emptyFiles]]);
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          // Transform workspace
          const result = await adapter.transformWorkspace('kiro', 'codex', fs);

          expect(result.success).toBe(true);

          // Verify empty files were preserved (all platforms use .kiro/specs/)
          for (const fileName of Object.keys(emptyFiles)) {
            const targetPath = `.kiro/specs/${specName}/${fileName}`;
            const transformedContent = fs.getFile(targetPath);
            
            expect(transformedContent).toBe('');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 2: Instructions File Contains Spec References', () => {
  /**
   * **Validates: Requirements 1.2, 1.3**
   * 
   * Property: For any set of specs in a workspace, generating an instructions
   * file (CLAUDE.md or AGENTS.md) SHALL produce content that references all
   * spec names present in the workspace.
   */
  it('instructions file references all spec names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFeatureName, { minLength: 1, maxLength: 5 }),
        fc.constantFrom<PlatformId>('claude-code', 'codex', 'antigravity'),
        async (specNames, targetPlatform) => {
          // Ensure unique spec names
          const uniqueNames = [...new Set(specNames)];
          if (uniqueNames.length === 0) return;

          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          // Set up source specs
          const sourceSpecs = new Map<string, Record<string, string>>();
          for (const name of uniqueNames) {
            sourceSpecs.set(name, { 'requirements.md': `# ${name}` });
          }
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          // Transform workspace
          const result = await adapter.transformWorkspace('kiro', targetPlatform, fs);

          expect(result.success).toBe(true);

          // Get the instructions file path based on platform
          const instructionsFile = targetPlatform === 'claude-code' 
            ? 'CLAUDE.md' 
            : targetPlatform === 'codex'
              ? 'AGENTS.md'
              : '.agent/rules/specs.md';

          const instructionsContent = fs.getFile(instructionsFile);
          expect(instructionsContent).toBeDefined();

          // Verify all spec names are referenced
          for (const specName of uniqueNames) {
            expect(instructionsContent).toContain(specName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Claude Code generates CLAUDE.md with spec references
   */
  it('Claude Code generates CLAUDE.md with spec references', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFeatureName, { minLength: 1, maxLength: 3 }),
        async (specNames) => {
          const uniqueNames = [...new Set(specNames)];
          if (uniqueNames.length === 0) return;

          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          const sourceSpecs = new Map<string, Record<string, string>>();
          for (const name of uniqueNames) {
            sourceSpecs.set(name, { 'requirements.md': '' });
          }
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          await adapter.transformWorkspace('kiro', 'claude-code', fs);

          const content = fs.getFile('CLAUDE.md');
          expect(content).toBeDefined();
          expect(content).toContain('Project Instructions');
          expect(content).toContain('.kiro/specs/');

          for (const specName of uniqueNames) {
            expect(content).toContain(specName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Codex generates AGENTS.md with spec references
   */
  it('Codex generates AGENTS.md with spec references', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFeatureName, { minLength: 1, maxLength: 3 }),
        async (specNames) => {
          const uniqueNames = [...new Set(specNames)];
          if (uniqueNames.length === 0) return;

          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          const sourceSpecs = new Map<string, Record<string, string>>();
          for (const name of uniqueNames) {
            sourceSpecs.set(name, { 'requirements.md': '' });
          }
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          await adapter.transformWorkspace('kiro', 'codex', fs);

          const content = fs.getFile('AGENTS.md');
          expect(content).toBeDefined();
          expect(content).toContain('Agent Instructions');
          expect(content).toContain('.kiro/specs/');

          for (const specName of uniqueNames) {
            expect(content).toContain(specName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Antigravity generates .agent/rules/specs.md with spec references
   */
  it('Antigravity generates .agent/rules/specs.md with spec references', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFeatureName, { minLength: 1, maxLength: 3 }),
        async (specNames) => {
          const uniqueNames = [...new Set(specNames)];
          if (uniqueNames.length === 0) return;

          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          const sourceSpecs = new Map<string, Record<string, string>>();
          for (const name of uniqueNames) {
            sourceSpecs.set(name, { 'requirements.md': '' });
          }
          setupSpecsInFileSystem(fs, '.kiro/specs/', sourceSpecs);

          await adapter.transformWorkspace('kiro', 'antigravity', fs);

          const content = fs.getFile('.agent/rules/specs.md');
          expect(content).toBeDefined();
          expect(content).toContain('Specs Instructions');
          expect(content).toContain('.kiro/specs/');

          for (const specName of uniqueNames) {
            expect(content).toContain(specName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 17: Unified Spec Location', () => {
  /**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   * 
   * Property: For any spec access operation on any platform, the Workspace_Adapter
   * SHALL read from `.kiro/specs/` as the canonical spec location.
   */
  it('finds specs in .kiro/specs/ location', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        async (specName) => {
          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          // Set up spec in .kiro/specs/
          const specs = new Map([[specName, { 'requirements.md': '# Test' }]]);
          setupSpecsInFileSystem(fs, '.kiro/specs/', specs);

          // Find specs
          const foundSpecs = await adapter.findSpecs(fs);

          // Verify the spec was found
          expect(foundSpecs.length).toBeGreaterThanOrEqual(1);
          
          const foundSpec = foundSpecs.find(s => s.name === specName);
          expect(foundSpec).toBeDefined();
          expect(foundSpec!.path).toBe('.kiro/specs/');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Finds multiple specs in .kiro/specs/
   */
  it('finds multiple specs in .kiro/specs/', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbitraryFeatureName, { minLength: 1, maxLength: 5 }),
        async (specNames) => {
          // Ensure unique names
          const uniqueNames = [...new Set(specNames)];
          if (uniqueNames.length === 0) return;

          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          // Place all specs in .kiro/specs/
          const specs = new Map<string, Record<string, string>>();
          for (const name of uniqueNames) {
            specs.set(name, { 'requirements.md': '# Test' });
          }
          setupSpecsInFileSystem(fs, '.kiro/specs/', specs);

          // Find all specs
          const foundSpecs = await adapter.findSpecs(fs);

          // Verify all specs were found
          expect(foundSpecs.length).toBe(uniqueNames.length);

          for (const name of uniqueNames) {
            const foundSpec = foundSpecs.find(s => s.name === name);
            expect(foundSpec).toBeDefined();
            expect(foundSpec!.path).toBe('.kiro/specs/');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Returns empty array when no specs exist
   */
  it('returns empty array when no specs exist', async () => {
    const adapter = createWorkspaceAdapter();
    const fs = new MockWorkspaceFileSystem();

    const foundSpecs = await adapter.findSpecs(fs);

    expect(foundSpecs).toEqual([]);
  });

  /**
   * Property: Spec location path is correctly reported
   */
  it('reports correct path for specs', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryFeatureName,
        async (specName) => {
          const adapter = createWorkspaceAdapter();
          const fs = new MockWorkspaceFileSystem();

          const specs = new Map([[specName, { 'requirements.md': '# Test' }]]);
          setupSpecsInFileSystem(fs, '.kiro/specs/', specs);

          const foundSpecs = await adapter.findSpecs(fs);
          const foundSpec = foundSpecs.find(s => s.name === specName);

          expect(foundSpec).toBeDefined();
          expect(foundSpec!.path).toBe('.kiro/specs/');
          expect(foundSpec!.name).toBe(specName);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Platform detection works for all platforms
   */
  it('detects platform based on workspace markers', async () => {
    const testCases: Array<{ marker: string; expected: PlatformId }> = [
      { marker: '.kiro/', expected: 'kiro' },
      { marker: '.claude/', expected: 'claude-code' },
      { marker: 'CLAUDE.md', expected: 'claude-code' },
      { marker: '.codex/', expected: 'codex' },
      { marker: 'AGENTS.md', expected: 'codex' },
      { marker: '.agent/', expected: 'antigravity' },
    ];

    for (const { marker, expected } of testCases) {
      const adapter = createWorkspaceAdapter();
      const fs = new MockWorkspaceFileSystem();

      if (marker.endsWith('/')) {
        fs.addDirectory(marker);
      } else {
        fs.addFile(marker, '');
      }

      const detected = await adapter.detectCurrentPlatform(fs);
      expect(detected).toBe(expected);
    }
  });

  /**
   * Property: Returns null when no platform markers exist
   */
  it('returns null when no platform markers exist', async () => {
    const adapter = createWorkspaceAdapter();
    const fs = new MockWorkspaceFileSystem();

    const detected = await adapter.detectCurrentPlatform(fs);
    expect(detected).toBeNull();
  });
});
