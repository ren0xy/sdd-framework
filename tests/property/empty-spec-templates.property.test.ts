/**
 * Property-Based Tests for Empty Spec Templates
 *
 * Feature: 014-empty-spec-templates
 * Property: Created spec files are empty
 *
 * Validates: Requirements 1, 2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CreateSpecCommand } from '../../src/commands/create-spec-command';
import type { CreateSpecFileSystem } from '../../src/commands/create-spec-command';

const arbitraryKebabCase = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 30 }
).filter(s => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s));

function createMockFs(): CreateSpecFileSystem & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    exists: async () => false,
    mkdir: async () => {},
    writeFile: async (p: string, content: string) => { written.set(p, content); },
  };
}

describe('Property: created spec files are empty', () => {
  it('requirements.md, design.md, and tasks.md contain only empty or whitespace-only content after creation', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryKebabCase, async (name) => {
        const mockFs = createMockFs();
        const command = new CreateSpecCommand(mockFs);
        const result = await command.execute({ name, workspaceRoot: '/workspace' });

        expect(result.success).toBe(true);

        const templateFiles = ['requirements.md', 'design.md', 'tasks.md'];
        for (const file of templateFiles) {
          const entry = [...mockFs.written.entries()].find(([k]) => k.endsWith(file));
          expect(entry).toBeDefined();
          expect(entry![1].trim()).toBe('');
        }
      }),
      { numRuns: 100 }
    );
  });
});
