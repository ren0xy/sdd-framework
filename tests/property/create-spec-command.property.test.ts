/**
 * Property-Based Tests for CreateSpecCommand
 * 
 * Feature: 002-hybrid-executable-layer
 * Property 4: Complete Spec Folder Creation
 * Property 6: Spec Creation Idempotence Prevention
 * Property 7: Generation Mode Configuration
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CreateSpecCommand } from '../../src/commands/create-spec-command';
import type { CreateSpecFileSystem } from '../../src/commands/create-spec-command';

// --- Generators ---

const arbitraryKebabCase = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 30 }
).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

const arbitraryInvalidSpecName = fc.oneof(
  fc.constant(''),
  fc.constant('UPPERCASE'),
  fc.constant('-leading-hyphen'),
  fc.constant('trailing-hyphen-'),
  fc.constant('double--hyphen'),
  fc.constant('has space'),
  fc.constant('has_underscore')
);

const arbitraryMode = fc.constantFrom<'requirements-first' | 'design-first'>(
  'requirements-first', 'design-first'
);

const arbitraryPlatform = fc.constantFrom<'kiro' | 'claude-code' | 'codex' | 'antigravity'>(
  'kiro', 'claude-code', 'codex', 'antigravity'
);

// --- Mock FS ---

function createMockFs(existingPaths: Set<string> = new Set()): CreateSpecFileSystem & { written: Map<string, string>; dirs: string[] } {
  const written = new Map<string, string>();
  const dirs: string[] = [];
  return {
    written,
    dirs,
    exists: async (p: string) => existingPaths.has(p),
    mkdir: async (p: string) => { dirs.push(p); },
    writeFile: async (p: string, content: string) => { written.set(p, content); },
  };
}

// --- Tests ---

describe('Property 4: Complete Spec Folder Creation', () => {
  it('valid kebab-case names produce a spec folder with all required files', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        const data = result.data!;
        expect(data.files).toContain('requirements.md');
        expect(data.files).toContain('design.md');
        expect(data.files).toContain('tasks.md');
        expect(data.files).toContain('.config.kiro');
        expect(data.files).toHaveLength(4);
      }),
      { numRuns: 100 }
    );
  });

  it('spec folder path includes the spec name', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        expect(result.data!.path).toContain(name);
      }),
      { numRuns: 100 }
    );
  });

  it('all four files are actually written to the filesystem', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        await command.execute({ name, workspaceRoot: '/workspace' });

        // 4 files written: .config.kiro, requirements.md, design.md, tasks.md
        expect(mockFs.written.size).toBe(4);

        // Template files should be empty, only .config.kiro has content
        for (const [filePath, content] of mockFs.written) {
          if (filePath.endsWith('.config.kiro')) {
            expect(content.length).toBeGreaterThan(0);
          } else {
            expect(content).toBe('');
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: Spec Creation Idempotence Prevention', () => {
  it('rejects creation when spec already exists', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        // Pre-populate the existing path
        const specPath = `/workspace/.kiro/specs/${name}`;
        // On Windows path.join uses backslashes, so match what the command builds
        const mockFs = createMockFs();
        // Override exists to return true for any path containing the spec name
        mockFs.exists = async (p: string) => p.includes(name);

        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.code).toBe('SPEC_EXISTS');
      }),
      { numRuns: 100 }
    );
  });

  it('does not write any files when spec already exists', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        const mockFs = createMockFs();
        mockFs.exists = async () => true;

        const command = new CreateSpecCommand(mockFs);
        await command.execute({ name, workspaceRoot: '/workspace' });

        expect(mockFs.written.size).toBe(0);
        expect(mockFs.dirs).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Generation Mode Configuration', () => {
  it('config contains the specified generation mode', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, arbitraryMode, async (name, mode) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, mode, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        expect(result.data!.config.generationMode).toBe(mode);
      }),
      { numRuns: 100 }
    );
  });

  it('config file written to disk contains the generation mode', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, arbitraryMode, async (name, mode) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        await command.execute({ name, mode, workspaceRoot: '/workspace' });

        // Find the .config.kiro file
        const configEntry = [...mockFs.written.entries()].find(([k]) => k.endsWith('.config.kiro'));
        expect(configEntry).toBeDefined();

        const config = JSON.parse(configEntry![1]);
        expect(config.generationMode).toBe(mode);
      }),
      { numRuns: 100 }
    );
  });

  it('defaults to requirements-first when no mode specified', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);
        expect(result.data!.config.generationMode).toBe('requirements-first');
      }),
      { numRuns: 100 }
    );
  });

  it('invalid spec names are rejected before any file operations', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidSpecName, async (name) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(false);
        expect(result.error!.code).toBe('INVALID_SPEC_NAME');
        expect(mockFs.written.size).toBe(0);
        expect(mockFs.dirs).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});
