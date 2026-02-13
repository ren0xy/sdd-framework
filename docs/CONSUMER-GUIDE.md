# Consumer Guide: Building a GUI for SDD Framework

For developers building applications (like VS Code extensions) that provide a graphical interface for SDD Framework.

## What the Framework Provides vs What You Build

| Responsibility | SDD Framework | Your Extension |
|----------------|---------------|----------------|
| Create spec folders | ✅ | Trigger via CLI/API |
| Install skills | ✅ | Trigger via CLI/API |
| Update task status | ✅ | Trigger via CLI/API |
| Generate instruction files | ✅ | Trigger via CLI/API |
| List/parse specs | Partial (names only) | Full parsing |
| Watch for file changes | ❌ | Implement |
| Prompt templates | ❌ | Implement |
| Tree view data | ❌ | Implement |

## Consumer Responsibilities

### 1. File System Watching

Monitor `.kiro/specs/` for changes:

```typescript
const watcher = vscode.workspace.createFileSystemWatcher('**/.kiro/specs/**');
watcher.onDidChange(uri => refreshSpecList());
```

### 2. Task List Parser

```typescript
// Task line pattern: - [x] 1.1 Task description
const taskPattern = /^(\s*)- \[([ x\-!])\]\s*(\d+(?:\.\d+)*)\s+(.+)$/;

// Status mapping: ' '=not_started, 'x'=completed, '-'=in_progress, '!'=failed
```

### 3. Platform Detection

Check for platform markers:
- `.kiro/` → Kiro
- `.claude/` or `CLAUDE.md` → Claude Code
- `.codex/` or `AGENTS.md` → Codex
- `.agent/` → Antigravity
- `.amazonq/` → Amazon Q

## Using the Framework

### Option A: CLI

```typescript
const cmd = `npx sdd create-spec ${name} --platform ${platform} --json`;
exec(cmd, { cwd: workspaceRoot }, (error, stdout) => { /* parse JSON */ });
```

### Option B: Library Import

```typescript
import {
  SkillRegistry, SkillTransformer, TaskTracker,
  WorkspaceAdapter, KiroAdapter, ClaudeCodeAdapter, allSkills
} from 'sdd-framework';

const adapters = new Map([['kiro', new KiroAdapter()], ['claude-code', new ClaudeCodeAdapter()]]);
const registry = new SkillRegistry();
allSkills.forEach(skill => registry.register(skill));
const transformer = new SkillTransformer(registry, adapters);
```

## File Structure Reference

```
.kiro/specs/{spec-name}/
├── .config.kiro          # JSON: { generationMode, platform?, createdAt? }
├── requirements.md
├── design.md
└── tasks.md              # Checkbox syntax: [ ] not_started, [-] in_progress, [x] completed, [!] failed

# Platform-specific skill locations:
.claude/skills/*.md
.codex/skills/{name}/SKILL.md
.agent/skills/*.md
.kiro/skills/*.md           # With front-matter
.amazonq/rules/*.md         # Auto-loaded

# Platform instruction files:
CLAUDE.md | AGENTS.md | .agent/rules/specs.md
```

> Platform switching is non-destructive — running `workspace-init` for a new platform does NOT remove files from the previous platform.

## Spec Config Schema

```typescript
interface SpecConfig {
  generationMode: 'requirements-first' | 'design-first';
  platform?: 'kiro' | 'claude-code' | 'codex' | 'antigravity' | 'amazonq';
  createdAt?: string;  // ISO 8601
}
```
