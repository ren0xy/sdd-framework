# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-02-13

### Added

#### Core Architecture
- Framework initialization with TypeScript project structure, CLI entry point, and canonical skill format (spec 000)
- Hybrid executable layer enabling platform-adaptive skill transformation from a single canonical definition (spec 002)

#### Platform Adapters
- Markdown quirks research across all target platforms, informing per-platform formatting decisions (spec 001)
- Amazon Q Developer support research and platform integration with `.amazonq/rules/` adapter (specs 005, 006)
- Amazon Q detection and adapter fixes for edge cases in workspace detection (spec 010)
- Antigravity directory-based skill installation with `.agent/skills/` and `.agent/rules/` paths (spec 013)

#### Task Management
- Task execution skill for running and tracking spec tasks via CLI (spec 007)
- Task lifecycle status management with checkbox-based status tracking in `tasks.md` (spec 008)
- Task hierarchy parsing fixes and instruction injection improvements (spec 009)
- Task insertion ordering fix ensuring correct placement of status updates (spec 011)
- Analyze-failure and run-task instruction templates for guided agent workflows (spec 012)
- Strict task format enforcement with validation of checkbox syntax and numbering (spec 015)

#### Skill System
- Empty spec templates for bootstrapping new specs with `requirements.md`, `design.md`, and `tasks.md` (spec 014)

#### Verification & Testing
- Post-operation verification system to validate workspace state after commands (spec 003)
- End-to-end platform switching tests covering multi-platform init/install/verify cycles (spec 004)
