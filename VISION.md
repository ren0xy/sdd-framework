# SDD Framework — Vision

## What is SDD Framework?

SDD Framework is a portable abstraction layer for AI coding agent projects. It lets you define skills and specs once, then deploy them to any supported AI coding platform without rewriting anything.

AI coding agents each impose their own project structure, skill format, and instruction conventions. This creates platform lock-in: switching from one agent to another means rewriting all your project scaffolding. SDD Framework eliminates that friction by providing a single canonical format that transforms cleanly to every platform.

The framework is a TypeScript library with a CLI. It manages specs in a shared `.kiro/specs/` directory and installs platform-specific skill files to each agent's expected paths.

## Design Philosophy

Three principles guide every decision in the framework:

- **Write once, deploy to any platform.** A skill definition is written once in a canonical format. Platform adapters handle the translation to Kiro steering files, Claude Code's `CLAUDE.md`, Codex's `AGENTS.md`, Antigravity's `.agent/rules/`, or Amazon Q's `.amazonq/rules/`. You never write platform-specific instructions by hand.

- **Skills are instructions, not scripts.** Installing a skill doesn't execute code — it installs a markdown document that tells an AI agent how to perform a task. The agent reads the instructions and does the work. The framework's value is in providing consistent, well-tested instructions that produce equivalent results everywhere.

- **Shared specs, isolated platform paths.** Every platform reads and writes specs from `.kiro/specs/`. Everything else — skill files, instruction files, configuration — goes into each platform's own directory. You can open the same workspace in five different IDEs simultaneously and they won't conflict.

## Status

**v0.1.0** — initial stable release.

The framework supports 5 platforms:
- Kiro
- Claude Code
- OpenAI Codex
- Google Antigravity
- Amazon Q Developer

Core capabilities at this milestone:
- Canonical skill definitions with platform-specific transformation
- CLI for workspace initialization, skill installation, spec creation, and task management
- Platform adapters with per-platform markdown formatting
- Task lifecycle management with status tracking
- Post-operation verification
- End-to-end platform switching tests

## Roadmap

Future directions under consideration:

- **npm publishing** — distribute the framework as an installable npm package
- **Additional platforms** — support new AI coding agents as they emerge
- **Plugin system** — allow third-party skill packs and custom adapters
- **Runtime verification** — validate that agents correctly followed skill instructions
- **Spec templates** — pre-built spec templates for common project patterns
