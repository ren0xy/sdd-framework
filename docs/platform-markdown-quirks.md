# Platform Markdown Quirks Reference

Cross-platform markdown compatibility guide for skill authors.

## Quick Reference

| Platform | Most Critical Issue | Severity |
|----------|---------------------|----------|
| Claude | Missing blank lines before lists/code blocks | High |
| Codex/GPT | Missing code block formatting, language hints omitted | High |
| Kiro | Task checkbox syntax required, file reference syntax | High |
| Antigravity | Bold text in lists causes truncation | Critical |
| Amazon Q | Inherited Claude quirks (blank lines, escaping) | High |

## Risk Levels by Feature

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Headings | Low | Low | Low | Low | Low |
| Lists | Medium | Medium | Medium | **High** | Medium |
| Code | Medium | **High** | Medium | Medium | Medium |
| Emphasis | Medium | Low | Low | **High** | Medium |
| Links | Low | Medium | Low | Low | Low |
| Blockquotes | Low | Low | Low | Low | Low |
| Tables | Medium | **High** | Medium | **High** | Low (IDE) |
| Line Breaks | Medium | Medium | Medium | Medium | Medium |
| Escaping | **High** | **High** | **High** | Medium | **High** |
| Special Chars | Low | Medium | Low | Medium | Low |


## Critical Issues

### 1. Antigravity: Bold Text Truncates Lists
`**bold**` inside list items causes the entire list to be truncated. All subsequent items silently dropped.
Fix: Remove bold markers. Use backticks or dashes for emphasis.
Source: [Issue #8439](https://github.com/google-gemini/gemini-cli/issues/8439)

### 2. Antigravity: Nested Lists Silently Omitted
List items containing nested lists are completely omitted from output.
Fix: Flatten to single-level lists.

### 3. Antigravity: Code Blocks in Lists Cause Omission
List items containing code blocks with special characters are omitted entirely.
Fix: Move code blocks outside of list items.

### 4. Claude/Kiro/Amazon Q: Missing Blank Lines Before Blocks
Claude often omits required blank lines before lists and code blocks.
Fix: Always include a blank line before lists and code blocks.
Source: [Issue #17554](https://github.com/anthropics/claude-code/issues/17554)

### 5. Codex/GPT: Code Output as Plain Text
Codex CLI sometimes outputs code as unindented plain text.
Fix: Add explicit instructions in AGENTS.md to use fenced code blocks with language hints.
Source: [Issue #6053](https://github.com/openai/codex/issues/6053)

### 6. All Platforms: Snake_case Triggers Italics
Underscores in identifiers trigger unintended italicization.
Fix: Always wrap identifiers with underscores in backticks.

### 7. Claude: Backslash Escaping Removes Underscores
`\_` may remove the underscore entirely.
Fix: Use backticks instead of backslash escaping.
Source: [Issue #12655](https://github.com/anthropics/claude-code/issues/12655)

### 8. GPT-4.1: Table Whitespace Spam
GPT-4.1 generates excessive whitespace in markdown tables, sometimes filling max tokens with spaces.
Fix: Use lists instead of tables, or add explicit formatting instructions.

### 9. Antigravity: Table Column Misalignment in CLI
Table columns don't align correctly in CLI output.
Fix: Use lists instead of tables for CLI-focused output.
Source: [Issue #3122](https://github.com/google-gemini/gemini-cli/issues/3122)

## Safe Patterns (Work Everywhere)

### Lists
- Always include a blank line before lists
- Keep lists flat (max 2 levels of nesting)
- Never use `**bold**` inside list items (breaks Antigravity)
- Never include code blocks inside list items (breaks Antigravity)
- Place code blocks after the list instead

### Code Blocks
- Always specify language hints (e.g., ` ```typescript `)
- Always include a blank line before code blocks
- Use `~~~` (tilde) fences for outer blocks when nesting
- Keep blocks under 50 lines when possible

### Emphasis
- Wrap identifiers with underscores in backticks: `` `user_profile_data` ``
- Add spaces around bold text: `text **bold** text`
- Never use backslash escaping for underscores

### Tables
- Keep tables simple with few columns and ASCII content
- Prefer lists over tables for CLI-focused output

### Special Characters
- Use HTML entities (`&lt;`, `&gt;`) for angle brackets outside code
- Wrap special characters in backticks
- Never use `\[` or `\]` (crashes GPT formatting)

### Platform-Specific Syntax
- Kiro file references: `#[[file:path/to/file.ts]]`
- Kiro task checkboxes: `[ ]` not started, `[x]` completed, `[-]` in progress, `[~]` queued, `[ ]*` optional
- Kiro context keys in chat: `#File`, `#Folder`, `#Problems`, `#Terminal`

## Platform Override Strategy

Use `platformOverrides` in skill definitions when cross-platform behavior differs:
- `instructions`: Replaces entire instructions for a platform
- `additionalContent`: Appends platform-specific guidance

| Quirk | Platform | Strategy | Override Type |
|-------|----------|----------|---------------|
| Bold in lists | Antigravity | Remove bold markers | `instructions` |
| Nested lists | Antigravity | Flatten to single level | `instructions` |
| Code in lists | Antigravity | Move code outside lists | `instructions` |
| Missing blank lines | Claude, Amazon Q | Add formatting reminder | `additionalContent` |
| Plain text code | Codex | Add explicit formatting rules | `additionalContent` |
| Snake_case italics | All | Use backticks in base | Base instructions |
| Table rendering | Antigravity, Codex | Convert to lists | `instructions` |
| Task syntax | Kiro | Add syntax reference | `additionalContent` |
| Nested fences | All | Use tilde in base | Base instructions |

## Checklist for Skill Authors

- [ ] All code blocks have language hints
- [ ] Blank lines before all lists and code blocks
- [ ] No bold text inside list items
- [ ] No nested lists deeper than 2 levels
- [ ] No code blocks inside list items
- [ ] All snake_case identifiers wrapped in backticks
- [ ] Tables kept simple or replaced with lists
- [ ] Tilde fences used for nested code examples

---

*Last updated: February 2026*
