# Amazon Q Developer — Platform Reference

Reference for Amazon Q Developer integration as an SDD Framework platform adapter. Markdown quirks are documented in `docs/platform-markdown-quirks.md` (Amazon Q inherits Claude's behaviors).

## Workspace Conventions

### Rules Directory

- **Path**: `.amazonq/rules/` (auto-loaded into context)
- **Format**: Free-form markdown (`.md`), no enforced schema
- **Subdirectories**: Supported (e.g., `.amazonq/rules/frontend/react.rule.md`)
- **Dynamic updates**: Changes detected during active sessions

### Configuration Paths

| Level | Path | Scope |
|-------|------|-------|
| Project rules | `.amazonq/rules/` | Shared via version control |
| User prompts | `~/.aws/amazonq/prompts/` | Cross-project |
| MCP config (local) | `.amazonq/default.json` | Project-level |
| MCP config (global) | `~/.aws/amazonq/default.json` | User-level |
| Legacy MCP (local) | `.amazonq/mcp.json` | Still supported |
| Legacy MCP (global) | `~/.aws/amazonq/mcp.json` | Still supported |

### Key Differences from Other Platforms

- Uses `.amazonq/` directory (not `.kiro/`, `.claude/`, `.codex/`)
- Rules are free-form markdown with no enforced schema
- No conditional inclusion — all rules in `.amazonq/rules/` are auto-loaded
- No native "skills" concept — rules serve as the closest equivalent
- Amazon Q IDE is absent from the `npx skills` agent ecosystem

## Context Engineering Features

| Feature | Amazon Q IDE | Kiro IDE | Kiro CLI |
|---------|-------------|----------|----------|
| Project Rules | ✅ `.amazonq/rules/` | N/A (steering) | ✅ (legacy) |
| Agent Skills | ❌ | ✅ `.kiro/skills/` | ✅ |
| Hooks | ❌ | ✅ | ❌ |
| Subagents | ❌ | ✅ | ❌ |
| Steering | ❌ | ✅ `.kiro/steering/` | ❌ |
| Specs | ❌ | ✅ `.kiro/specs/` | ❌ |
| MCP | ✅ `default.json` | ✅ | ✅ |
| Prompt Library | ✅ `~/.aws/amazonq/prompts/` | N/A | ❌ |

## PlatformAdapter Configuration

```typescript
{
  platformId: 'amazonq',
  skillsPath: '.amazonq/rules',   // Rules serve as skills equivalent
  specsPath: '.kiro/specs',       // Standard across all platforms
  instructionsFile: null           // Rules are auto-loaded; no single instructions file
}
```

### Adapter Notes

- `getUserSkillsDirectory()` → `null` (prompt library serves a different purpose)
- `parseSkill()` requires heuristic extraction since rules have no enforced schema
- `generateInstructionsContent()` → generate a rule file (e.g., `.amazonq/rules/sdd-framework.md`) listing specs
- Integration is more limited than Claude Code or Kiro due to lack of native skills/hooks/steering

## Quotas

- Pro: ~1,000 user inputs/month (10,000 inference calls)
- Free: 50 agentic chat interactions/month

---

*Research: February 2026 | Extension: v1.109.0*
