# SDD Framework Integration Reference

Technical reference for the complete public API, output formats, and error handling.

## Module Information

- **Module format**: ESM | **Node.js**: >= 18.0.0 | **Types**: `dist/index.d.ts`

```typescript
import { SkillRegistry, KiroAdapter } from 'sdd-framework';
```

## Public API

### Exports Overview

```typescript
// Platform Adapters
export { KiroAdapter, ClaudeCodeAdapter, CodexAdapter, AntigravityAdapter, AmazonQAdapter };
export type { PlatformAdapter };

// Core Classes
export { SkillRegistry, SkillTransformer, WorkspaceAdapter, TaskTracker, TasksGenerator };

// Validation
export { validateSpecConfig, validateSpecFolder, validateAllSpecs };

// Built-in Skills
export { workspaceInitSkill, createSpecSkill, runTaskSkill, installSkillsSkill };
export { allSkills, getSkillByName };

// Type Guards
export { isDirectorySkill, isSingleFileSkill };
```

### SkillRegistry

```typescript
class SkillRegistry {
  register(skill: CanonicalSkill): void;
  get(name: string): CanonicalSkill | undefined;
  listForPlatform(platform: PlatformId): SkillMetadata[];
  listAll(): SkillMetadata[];
  install(skillName: string, adapter: PlatformAdapter, fs: FileSystem): Promise<SkillInstallResult>;
}
```

### SkillTransformer

```typescript
class SkillTransformer {
  constructor(registry: SkillRegistry, adapters: Map<PlatformId, PlatformAdapter>);
  transformForPlatform(skillName: string, targetPlatform: PlatformId): PlatformSkill;
  generateAllPlatformSkills(skillName: string): Map<PlatformId, PlatformSkill>;
  getSpecPath(featureName: string, platform: PlatformId): string;
  createSpecFolder(featureName: string, platform: PlatformId, fs: FileSystemOperations): Promise<CreateSpecResult>;
}
```

### WorkspaceAdapter

```typescript
class WorkspaceAdapter {
  constructor(adapters: Map<PlatformId, PlatformAdapter>);
  detectCurrentPlatform(fs: WorkspaceFileSystem): Promise<PlatformId | null>;
  findSpecs(fs: WorkspaceFileSystem): Promise<SpecLocation[]>;
  getAllSpecsMetadata(fs: WorkspaceFileSystem): Promise<SpecMetadata[]>;
  transformWorkspace(source: PlatformId, target: PlatformId, fs: WorkspaceFileSystem): Promise<TransformResult>;
}
```

### TaskTracker

```typescript
class TaskTracker {
  parseTaskStatus(content: string, taskId: string): TaskStatus;
  replaceTaskStatus(content: string, taskId: string, status: TaskStatus): string;
  statusToChar(status: TaskStatus): string; // completed→x, in_progress→-, failed→!, not_started→' '
  updateTaskStatus(path: string, taskId: string, status: TaskStatus, error?: string): Promise<TaskUpdate>;
  runTask(path: string, taskId: string, executor: () => Promise<void>): Promise<TaskUpdate>;
  runTasks(path: string, taskIds: string[], executors: Map<string, () => Promise<void>>): Promise<TaskUpdate[]>;
}
```

### TasksGenerator

```typescript
class TasksGenerator {
  statusToCheckboxChar(status: TaskStatus): string;
  generateTaskLine(task: TaskInput, indent?: number): string;
  generateTaskWithDetails(task: TaskInput, indent?: number): string[];
  generate(tasks: TaskInput[], options?: TasksGeneratorOptions): string;
  taskToInput(task: Task): TaskInput;
}
```

### Built-in Skills

```typescript
export const allSkills: CanonicalSkill[];  // workspace-init, install-skills, create-spec, run-task
export function getSkillByName(name: string): CanonicalSkill | undefined;
```

## Core Types

```typescript
type PlatformId = 'kiro' | 'claude-code' | 'codex' | 'antigravity' | 'amazonq';
type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';
type GenerationMode = 'requirements-first' | 'design-first';


interface CanonicalSkill {
  name: string;                        // kebab-case
  title: string;
  description: string;
  version: string;                     // semver
  supportedPlatforms: PlatformId[];
  instructions: string;                // markdown
  parameters: SkillParameter[];
  platformOverrides?: { [K in PlatformId]?: { instructions?: string; additionalContent?: string; } };
}

type PlatformSkill = SingleFileSkill | DirectorySkill;
// SingleFileSkill: { filename, content } — Kiro, Claude Code, Antigravity, Amazon Q
// DirectorySkill: { directory, files[] } — Codex
```

## Generated File Structures

### Per-Platform Workspace Layout

| Platform | Skills Path | Instructions File |
|----------|------------|-------------------|
| Kiro | `.kiro/skills/*.md` | None |
| Claude Code | `.claude/skills/*.md` | `CLAUDE.md` |
| Codex | `.codex/skills/{name}/SKILL.md` | `AGENTS.md` |
| Antigravity | `.agent/skills/*.md` | `.agent/rules/specs.md` |
| Amazon Q | `.amazonq/rules/*.md` | None (auto-loaded) |

All platforms use `.kiro/specs/` for spec folders.

### Spec Folder Structure

```
.kiro/specs/{feature-name}/
├── .config.json (.config.kiro for Kiro)
├── requirements.md
├── design.md
└── tasks.md
```

### Task Status Format

```markdown
- [ ] 1.1 Not started
- [-] 1.2 In progress
- [x] 1.3 Completed
- [!] 1.4 Failed
  - [ ] 1.4.1 Subtask
```

> Platform switching is non-destructive — `workspace-init` for a new platform does not remove previous platform files.

## Validation Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CONFIG_TYPE` | Config is not a valid object |
| `MISSING_GENERATION_MODE` | Required field missing |
| `INVALID_GENERATION_MODE` | Not `requirements-first` or `design-first` |
| `INVALID_PLATFORM` | Platform ID not recognized |
| `SPEC_NOT_FOUND` | Spec folder does not exist |
| `NOT_A_DIRECTORY` | Path exists but is not a directory |
| `MISSING_CONFIG` | Missing `.config.json` or `.config.kiro` |
| `INVALID_CONFIG_JSON` | Config file is not valid JSON |

## Implementing Custom Platform Adapters

```typescript
class MyAdapter implements PlatformAdapter {
  readonly platformId: PlatformId = 'my-platform' as PlatformId;
  readonly skillsPath = '.myplatform/skills/';
  readonly specsPath = '.kiro/specs/';
  readonly instructionsFile = 'MY_INSTRUCTIONS.md'; // or null

  getSkillsDirectory(): string { return this.skillsPath; }
  getSpecsDirectory(): string { return this.specsPath; }
  getUserSkillsDirectory(): string | null { return null; }
  formatSkill(skill: CanonicalSkill): PlatformSkill { /* transform to platform format */ }
  parseSkill(content: string): CanonicalSkill { /* parse back to canonical */ }
  generateInstructionsContent(specs: SpecMetadata[]): string { /* generate instructions file */ }
  validateWorkspace(): ValidationResult { return { valid: true, errors: [], warnings: [] }; }
}
```

Register with: `adapters.set('my-platform', new MyAdapter());`
