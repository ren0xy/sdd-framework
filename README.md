# SDD Framework (Spec-Driven Development)

A portable abstraction layer for AI coding agent projects. Define skills and specs once, deploy to Kiro, Claude Code, OpenAI Codex, Google Antigravity, or Amazon Q Developer.

AI coding agents each have their own project structure and skill formats — this creates platform lock-in and makes it hard to switch tools or collaborate across teams. SDD Framework solves this with a unified spec location (`.kiro/specs/`), canonical skill definitions that transform to any platform format, and a consistent development workflow regardless of which AI agent you use.

Skills are instructions, not scripts. When you install a skill, you're installing a markdown document that tells an AI agent *how* to perform a task. The agent reads these instructions and does the work itself. The framework's value is in providing consistent, well-tested instructions that produce the same results everywhere.

## Multi-IDE, Shared Specs

The core idea: one workspace, many agents, one source of truth.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              YOUR WORKSPACE                                     │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        .kiro/specs/  (shared)                             │  │
│  │                                                                           │  │
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │  │
│  │   │ user-auth/       │  │ payments/        │  │ notifications/   │        │  │
│  │   │  requirements.md │  │  requirements.md │  │  requirements.md │        │  │
│  │   │  design.md       │  │  design.md       │  │  design.md       │        │  │
│  │   │  tasks.md        │  │  tasks.md        │  │  tasks.md        │        │  │
│  │   └──────────────────┘  └──────────────────┘  └──────────────────┘        │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│         ▲                   ▲                   ▲               ▲               │
│         │ reads/writes      │                   │               │               │
│  ┌──────┴──────┐  ┌─────────┴────┐  ┌───────────┴──┐  ┌─────────┴────────┐      │
│  │    Kiro     │  │  Claude Code │  │    Codex     │  │  Antigravity     │      │
│  │             │  │              │  │              │  │                  │      │
│  │ .kiro/      │  │ .claude/     │  │ .codex/      │  │ .agent/          │      │
│  │  skills/    │  │  skills/     │  │  skills/     │  │  skills/         │      │
│  │  steering/  │  │ CLAUDE.md    │  │ AGENTS.md    │  │  rules/          │      │
│  └─────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘      │
│                                                                                 │
│  ┌──────────────────┐                                                           │
│  │   Amazon Q       │                                                           │
│  │                  │                                                           │
│  │ .amazonq/        │                                                           │
│  │  rules/          │                                                           │
│  └──────────────────┘                                                           │
│   isolated paths   isolated paths   isolated paths    isolated paths            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Every agent writes skills and instructions to its own isolated paths. The only shared location is `.kiro/specs/` — that's the whole point. Open the same workspace in all five IDEs simultaneously; each agent picks up its own skill files and they all converge on the same specs.

## Quick Start

```bash
# Install
git clone https://github.com/ren0xy/sdd-framework.git
cd sdd-framework
npm install
npm run build
npm link          # optional, makes `sdd` available globally

# Initialize and install skills for your platform
sdd init --platform claude-code
sdd install --platform claude-code

# Create a feature spec and run a task
sdd create-spec user-authentication
sdd run-task --spec user-authentication --task 1.1 --status completed
```

To set up multiple platforms at once:

```bash
for platform in kiro claude-code codex antigravity amazonq; do
  sdd init --platform $platform
  sdd install --platform $platform
done
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `sdd init --platform <platform>` | Initialize workspace for target platform |
| `sdd install --platform <platform>` | Install framework skills to workspace |
| `sdd create-spec <name>` | Create a new spec folder in `.kiro/specs/` |
| `sdd run-task --spec <name> --task <id> --status <status>` | Update task status in tasks.md |
| `sdd verify [--spec <name>] [--platform <platform>]` | Verify workspace structure and spec integrity |
| `sdd help` | Show help |
| `sdd version` | Show version |

All commands support `--json` for machine-readable output. Supported platforms: `kiro`, `claude-code`, `codex`, `antigravity`, `amazonq`

## Platform Output Structures

All platforms use `.kiro/specs/` for specs. Skills and instructions vary by platform:

| Platform | Skills Path | Instructions File | Specs (shared) |
|----------|-------------|-------------------|----------------|
| Kiro | `.kiro/skills/` | Steering files | `.kiro/specs/` |
| Claude Code | `.claude/skills/` | `CLAUDE.md` | `.kiro/specs/` |
| Codex | `.codex/skills/{name}/SKILL.md` | `AGENTS.md` | `.kiro/specs/` |
| Antigravity | `.agent/skills/` | `.agent/rules/specs.md` | `.kiro/specs/` |
| Amazon Q | `.amazonq/rules/` | Auto-loaded | `.kiro/specs/` |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SDD Framework                        │
├─────────────────────────────────────────────────────────┤
│  CLI (src/cli.ts)                                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Skill     │  │  Workspace  │  │     Task        │  │
│  │  Registry   │  │   Adapter   │  │    Tracker      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │              Skill Transformer                   │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │   Kiro   │ │  Claude  │ │  Codex   │ │Antigravity│   │
│  │ Adapter  │ │  Adapter │ │ Adapter  │ │  Adapter  │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘   │
│  ┌───────────┐                                           │
│  │ Amazon Q  │                                           │
│  │  Adapter  │                                           │
│  └───────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

Core components:

- **Skill Registry** — Manages canonical skill definitions and installation
- **Skill Transformer** — Converts skills to platform-specific formats
- **Workspace Adapter** — Handles platform detection and workspace transformation
- **Task Tracker** — Manages task status updates in `tasks.md` files
- **Platform Adapters** — Implement platform-specific formatting and paths

## Limitations

- **AI agent compliance is not guaranteed.** Skills provide instructions; agents interpret them. Different agents may handle formatting, edge cases, or steps slightly differently.
- **Cross-platform parity is behavioral, not mechanical.** Skills produce equivalent results across platforms, but minor variations can occur since AI agents do the actual work.
- **No runtime validation.** The framework doesn't verify that an agent correctly followed a skill's instructions.

## Trust Model

SDD Framework operates on a convention-over-enforcement model:

- **Guarantees:** Consistent file locations (`.kiro/specs/`), well-structured skill instructions, platform-appropriate formatting
- **Relies on:** AI agents faithfully interpreting and executing skill instructions
- **You should verify:** Critical operations, especially when switching platforms or working with new agents

## Library Usage

```typescript
import {
  KiroAdapter, ClaudeCodeAdapter, CodexAdapter, AntigravityAdapter, AmazonQAdapter,
  SkillRegistry, SkillTransformer, WorkspaceAdapter, TaskTracker,
  allSkills, getSkillByName,
  PlatformId, CanonicalSkill, TaskStatus
} from 'sdd-framework';

// Transform a skill for Claude Code
const adapters = new Map();
adapters.set('claude-code', new ClaudeCodeAdapter());

const registry = new SkillRegistry();
allSkills.forEach(skill => registry.register(skill));

const transformer = new SkillTransformer(registry, adapters);
const platformSkill = transformer.transformForPlatform('workspace-init', 'claude-code');
```

## Creating Custom Skills

```typescript
const mySkill: CanonicalSkill = {
  name: 'my-skill',
  title: 'My Custom Skill',
  description: 'Does something useful',
  version: '1.0.0',
  supportedPlatforms: ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'],
  parameters: [
    { name: 'input', type: 'string', required: true, description: 'Input value' }
  ],
  instructions: `# My Skill\n\nInstructions for the AI agent...`,
  platformOverrides: {
    'codex': { additionalContent: 'Codex-specific notes...' }
  }
};
```

## Development

```bash
npm test          # Run tests
npm run lint      # Type check
npm run build     # Build
```

## Further Reading

- **[VISION.md](VISION.md)** — Framework purpose, design philosophy, current status, and roadmap
- **[docs/INTEGRATION.md](docs/INTEGRATION.md)** — Complete public API, module format, generated file structures, spec schema, task status format, TypeScript types, validation error codes, and custom adapter implementation
- **[docs/CONSUMER-GUIDE.md](docs/CONSUMER-GUIDE.md)** — Building a GUI consumer (VS Code extension, etc.): file watching, spec parsing, task extraction, prompt templates, CLI vs. library patterns

## License

MIT
