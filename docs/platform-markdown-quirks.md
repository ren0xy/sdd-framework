# Platform Markdown Quirks Reference

A comprehensive guide to markdown interpretation differences across AI coding agents. Use this reference when authoring skills for cross-platform compatibility.

## Quick Reference

| Platform | Most Critical Issue | Severity |
|----------|---------------------|----------|
| Claude | Missing blank lines before lists/code blocks | High |
| Codex/GPT | Missing code block formatting, language hints omitted | High |
| Kiro | Task checkbox syntax required, file reference syntax | High |
| Antigravity | Bold text in lists causes truncation | Critical |
| Amazon Q | Inherited Claude quirks (blank lines, escaping) | High |

---

## Quirks Matrix

This comprehensive matrix covers all 10 markdown feature categories across all 4 platforms. Use this to quickly identify compatibility issues.

**Legend**: ✅ Works well | ⚠️ Minor issues/workarounds needed | ❌ Significant problems/avoid

---

### 1. Headings

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| ATX Headings (`#`, `##`, `###`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Setext Headings (`===`, `---`) | ✅ | ⚠️ Rarely generated | ⚠️ Not preferred | ✅ | ✅ Inherited Claude |
| Heading Hierarchy | ✅ | ⚠️ May use `**bold**` instead | ⚠️ Specific structure in specs | ✅ | ✅ |
| Heading in Responses | ✅ | ✅ | ⚠️ Suppressed unless multi-step | ✅ | ✅ |

**Notes**:
- Claude/Codex/GPT: May use `**Bold**` instead of proper `#` headings when instructed to avoid markdown
- Kiro: Expects specific heading hierarchy in spec files; avoids headers in chat responses

---

### 2. Lists

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Unordered Lists (`-`, `*`) | ⚠️ Missing blank line before | ⚠️ Unicode bullets (•) | ⚠️ Inherited Claude issues | ❌ Bold truncates entire list | ⚠️ Inherited Claude issues |
| Ordered Lists (`1.`, `2.`) | ⚠️ Missing blank line before | ⚠️ Numbering restarts randomly | ⚠️ Inherited Claude issues | ⚠️ Auto-numbering bugs | ⚠️ Inherited Claude issues |
| Nested Lists (2+ levels) | ⚠️ Excessive whitespace | ⚠️ May collapse/flatten | ⚠️ Max 2-3 levels recommended | ❌ Omitted entirely | ⚠️ Inherited Claude issues |
| Task Checkboxes (`- [ ]`) | ✅ | ✅ | ✅ Special syntax required | ✅ | ✅ |
| Mixed List Types | ⚠️ Spacing issues | ⚠️ May merge incorrectly | ⚠️ Inherited Claude issues | ⚠️ Rendering issues | ⚠️ Inherited Claude issues |
| Code Blocks in Lists | ⚠️ Indentation issues | ⚠️ May break list | ⚠️ Inherited Claude issues | ❌ Entire item omitted | ⚠️ Inherited Claude issues |
| Bold Text in Lists | ✅ | ✅ | ✅ | ❌ Truncates from that point | ✅ |

**Critical**: Antigravity truncates lists at first bold item and omits nested lists entirely.

---

### 3. Code

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Inline Code (`` `code` ``) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fenced Code Blocks (` ``` `) | ⚠️ Missing blank line before | ⚠️ May output as plain text | ⚠️ Inherited Claude issues | ⚠️ Stripped in CLI | ⚠️ Inherited Claude issues |
| Language Hints (` ```js `) | ⚠️ Italics without hint | ❌ Often omitted | ✅ Strongly preferred | ✅ | ⚠️ Inherited Claude issues |
| Nested Code Blocks | ❌ Same fence length breaks | ❌ Fence collisions | ❌ Inherited Claude issues | ❌ Fence collisions | ❌ Inherited Claude issues |
| Indented Code Blocks (4 spaces) | ⚠️ Italicization issues | ⚠️ Inconsistent | ⚠️ Inherited Claude issues | ⚠️ May not render | ⚠️ Inherited Claude issues |
| Tilde Fences (`~~~`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Long Code Blocks | ✅ | ✅ | ⚠️ Keep under 50 lines | ✅ | ✅ |

**Critical**: Always use language hints. Use `~~~` for outer fences when nesting.

---

### 4. Emphasis

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Bold (`**text**`) | ✅ | ✅ | ⚠️ Suppressed in responses | ❌ Breaks lists | ✅ |
| Italic (`*text*` or `_text_`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bold+Italic (`***text***`) | ✅ | ✅ | ⚠️ Suppressed in responses | ⚠️ May fail | ✅ |
| Snake_case Identifiers | ❌ Triggers italics | ❌ Triggers italics | ❌ Inherited Claude issues | ❌ Triggers italics | ❌ Inherited Claude issues |
| Underscore Bold (`__text__`) | ✅ | ✅ | ✅ | ⚠️ Less reliable | ✅ |
| Bold with Mixed Content | ✅ | ✅ | ✅ | ❌ Fails without spaces | ✅ |

**Critical**: All platforms have snake_case issues. Antigravity requires spaces around `**bold**`.

---

### 5. Links

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Inline Links `[text](url)` | ✅ | ⚠️ Broken in desktop app | ✅ | ✅ | ✅ |
| Reference Links `[text][ref]` | ✅ | ✅ | ⚠️ Less commonly used | ✅ | ✅ |
| Autolinks `<https://...>` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bare URLs | ⚠️ May not linkify | ⚠️ May not linkify | ⚠️ May not linkify | ⚠️ May not linkify | ⚠️ May not linkify |
| File References | N/A | N/A | ✅ `#[[file:path]]` syntax | N/A | N/A |
| URL Security Stripping | N/A | ⚠️ href may be stripped | N/A | N/A | N/A |

**Note**: Kiro has special `#[[file:path]]` syntax for file references in specs.

---

### 6. Blockquotes

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Single-level (`>`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nested (`>>`, `>>>`) | ⚠️ May add whitespace | ✅ | ⚠️ Inherited Claude issues | ✅ | ⚠️ Inherited Claude issues |
| With Other Elements | ⚠️ Complexity issues | ⚠️ Complexity issues | ⚠️ Complexity issues | ⚠️ Complexity issues | ⚠️ Inherited Claude issues |
| Multi-paragraph | ✅ | ✅ | ✅ | ✅ | ✅ |

**Note**: Blockquotes work well across platforms. Avoid deep nesting with other elements.

---

### 7. Tables (GFM)

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Basic Tables | ⚠️ Terminal rendering issues | ❌ Whitespace spam (GPT-4.1) | ⚠️ Width limitations | ❌ Column misalignment | ✅ IDE renders well |
| Column Alignment (`:---:`) | ✅ | ⚠️ May be ignored | ✅ | ⚠️ May not work in CLI | ✅ |
| Non-ASCII Content | ❌ Broken columns | ⚠️ Rendering issues | ⚠️ Inherited Claude issues | ⚠️ Visibility issues | ⚠️ Inherited Claude issues |
| Complex Tables (many columns) | ⚠️ Layout problems | ❌ Token spam | ⚠️ Layout problems | ❌ Severe misalignment | ⚠️ Inherited Claude issues |
| Tables in Code Fences | N/A | ❌ GPT wraps tables in fences | N/A | N/A | N/A |

**Critical**: Tables are problematic on all platforms. Prefer lists for CLI contexts.

---

### 8. Line Breaks

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Trailing Spaces (2 spaces) | ✅ | ⚠️ Invisible chars added | ✅ | ⚠️ Double spaces in prose | ✅ |
| HTML Break (`<br>`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blank Lines | ⚠️ Inconsistent before blocks | ⚠️ Random indentation | ⚠️ Inherited Claude issues | ⚠️ Excessive whitespace | ⚠️ Inherited Claude issues |
| Paragraph Separation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hard Breaks in Lists | ⚠️ May cause issues | ⚠️ May cause issues | ⚠️ May cause issues | ⚠️ May cause issues | ⚠️ Inherited Claude issues |

**Note**: Use explicit blank lines. Don't rely on trailing spaces.

---

### 9. Escaping

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Backslash (`\*`, `\_`) | ❌ `\_` removes underscore | ❌ Context-unaware | ❌ Inherited Claude issues | ⚠️ May be stripped | ❌ Inherited Claude issues |
| HTML Entities (`&lt;`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Backtick Escaping | ✅ | ⚠️ Nesting issues | ✅ | ⚠️ May fail | ✅ |
| Dollar Sign (`$`) | ✅ | ⚠️ Always escaped as `\$` | ✅ | ⚠️ LaTeX conflicts | ✅ |
| Backslash Display | ⚠️ May need `\\` | ❌ Single `\` consumed | ⚠️ Inherited Claude issues | ⚠️ May be stripped | ⚠️ Inherited Claude issues |

**Critical**: Backslash escaping is unreliable. Use inline code or HTML entities instead.

---

### 10. Special Characters

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| Curly Braces `{`, `}` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Angle Brackets `<`, `>` | ⚠️ HTML interpretation | ⚠️ HTML interpretation | ⚠️ HTML interpretation | ⚠️ HTML interpretation | ⚠️ Inherited Claude issues |
| Square Brackets `[`, `]` | ✅ | ❌ `\[` crashes formatting | ✅ | ⚠️ May cause omission | ✅ |
| At Symbol `@` | ✅ | ✅ | ✅ | ✅ | ⚠️ Context trigger in chat |
| Hash `#` | ✅ | ✅ | ⚠️ Context key syntax in chat | ✅ | ✅ |
| Pipe `|` | ⚠️ Table conflicts | ⚠️ Table conflicts | ⚠️ Table conflicts | ⚠️ Table conflicts | ⚠️ Table conflicts |
| Smart/Curly Quotes | ⚠️ May generate in HTML | ⚠️ May generate in HTML | ⚠️ Inherited Claude issues | ⚠️ May generate | ⚠️ Inherited Claude issues |

**Note**: Use HTML entities for angle brackets outside code. Wrap special chars in backticks.

---

### Summary: Platform Risk Levels by Feature

| Feature | Claude | Codex/GPT | Kiro | Antigravity | Amazon Q |
|---------|--------|-----------|------|-------------|----------|
| 1. Headings | Low | Low | Low | Low | Low |
| 2. Lists | Medium | Medium | Medium | **High** | Medium |
| 3. Code | Medium | **High** | Medium | Medium | Medium |
| 4. Emphasis | Medium | Low | Low | **High** | Medium |
| 5. Links | Low | Medium | Low | Low | Low |
| 6. Blockquotes | Low | Low | Low | Low | Low |
| 7. Tables | Medium | **High** | Medium | **High** | Low (IDE) / Medium (CLI) |
| 8. Line Breaks | Medium | Medium | Medium | Medium | Medium |
| 9. Escaping | **High** | **High** | **High** | Medium | **High** |
| 10. Special Chars | Low | Medium | Low | Medium | Low |

**Risk Levels**: Low = generally safe | Medium = use workarounds | **High** = avoid or use alternatives

---

## Known Issues

This section documents specific markdown patterns that cause problems on certain platforms, with concrete examples and workarounds.

---

### Critical Issues (Must Address)

#### 1. Antigravity: Bold Text Truncates Lists

**Platform**: Antigravity/Gemini CLI  
**Severity**: Critical  
**Source**: [GitHub Issue #8439](https://github.com/google-gemini/gemini-cli/issues/8439)

**Problem**: Using `**bold**` inside list items causes the entire list to be truncated from that point forward. All subsequent items are silently dropped.

**Example - Broken**:
```markdown
- First item renders correctly
- Second item also works
- **This bold item** causes truncation
- This item is NEVER rendered
- Neither is this one
- The entire rest of the list is lost
```

**Actual Output**:
```
• First item renders correctly
• Second item also works
(rest of list missing)
```

**Example - Fixed**:
```markdown
- First item renders correctly
- Second item also works
- This important item (no bold formatting)
- Use `code formatting` for emphasis instead
- All items now render correctly
```

---

#### 2. Antigravity: Nested Lists Are Silently Omitted

**Platform**: Antigravity/Gemini CLI  
**Severity**: Critical  
**Source**: [GitHub Issue #8439](https://github.com/google-gemini/gemini-cli/issues/8439)

**Problem**: Entire list items containing nested lists are silently omitted from output. No error is shown - the content simply disappears.

**Example - Broken**:
```markdown
- Installation steps
  - Download the package
  - Run the installer
- Configuration options
- Usage examples
```

**Actual Output**:
```
• Configuration options
• Usage examples
(Installation steps item completely missing)
```

**Example - Fixed**:
```markdown
- Installation steps:
- Step 1: Download the package
- Step 2: Run the installer
- Configuration options
- Usage examples
```

---

#### 3. Antigravity: Code Blocks in Lists Cause Omission

**Platform**: Antigravity/Gemini CLI  
**Severity**: Critical  
**Source**: [GitHub Issue #8439](https://github.com/google-gemini/gemini-cli/issues/8439)

**Problem**: List items containing code blocks with special characters (brackets, etc.) are omitted entirely.

**Example - Broken**:
```markdown
- Initialize the array:
  ```javascript
  let items = [1, 2, 3];
  ```
- Process the data
- Return results
```

**Actual Output**:
```
• Process the data
• Return results
(First item with code block missing)
```

**Example - Fixed**:
```markdown
- Initialize the array (see code below)
- Process the data
- Return results

```javascript
let items = [1, 2, 3];
```
```

---

#### 4. Claude/Kiro: Missing Blank Lines Before Blocks

**Platform**: Claude, Kiro  
**Severity**: High  
**Source**: [GitHub Issue #17554](https://github.com/anthropics/claude-code/issues/17554)

**Problem**: Claude often omits required blank lines before lists and code blocks, violating CommonMark spec. This causes rendering issues in strict markdown parsers.

**Example - Claude May Generate**:
```markdown
Here is the configuration:
- Option A: Enable logging
- Option B: Set timeout
- Option C: Configure retries
```

**Example - Correct Format**:
```markdown
Here is the configuration:

- Option A: Enable logging
- Option B: Set timeout
- Option C: Configure retries
```

**Example - Code Block Issue**:
```markdown
<!-- PROBLEMATIC -->
Run this command:
```bash
npm install
```

<!-- CORRECT -->
Run this command:

```bash
npm install
```
```

---

#### 5. Codex/GPT: Code Blocks Output as Plain Text

**Platform**: Codex CLI  
**Severity**: High  
**Source**: [GitHub Issue #6053](https://github.com/openai/codex/issues/6053)

**Problem**: Codex CLI sometimes outputs code as unindented plain text instead of proper fenced code blocks, making code difficult to read and copy.

**Example - Broken Output**:
```
function calculateTotal(items) {
const sum = items.reduce((acc, item) => acc + item.price, 0);
return sum * 1.08; // Add tax
}
```

**Example - Expected Output**:
```javascript
function calculateTotal(items) {
  const sum = items.reduce((acc, item) => acc + item.price, 0);
  return sum * 1.08; // Add tax
}
```

**Workaround**: Add explicit instructions in AGENTS.md:
```markdown
## Code Output Requirements
- Always use fenced code blocks (```) for all code output
- Always include language hints (```javascript, ```python, etc.)
- Never output code as plain unformatted text
```

---

#### 6. All Platforms: Snake_case Triggers Unintended Italics

**Platform**: All (Claude, Codex, Kiro, Antigravity)  
**Severity**: High

**Problem**: Underscores in identifiers like `some_variable_name` can trigger unintended italicization when not wrapped in code formatting.

**Example - Broken**:
```markdown
The user_profile_data variable contains the authenticated user's information.
Set the max_retry_count to 3 for optimal performance.
```

**Rendered Output**:
> The user*profile*data variable contains the authenticated user's information.
> Set the max*retry*count to 3 for optimal performance.

**Example - Fixed**:
```markdown
The `user_profile_data` variable contains the authenticated user's information.
Set the `max_retry_count` to 3 for optimal performance.
```

---

#### 7. Claude: Backslash Escaping Removes Underscores

**Platform**: Claude  
**Severity**: High  
**Source**: [GitHub Issue #12655](https://github.com/anthropics/claude-code/issues/12655)

**Problem**: Using `\_` to escape underscores may remove them entirely instead of displaying them literally.

**Example - Broken**:
```markdown
The file is named config\_settings\_v2.json
```

**Rendered Output**:
> The file is named configsettingsv2.json

**Example - Fixed**:
```markdown
The file is named `config_settings_v2.json`
```

---

### Medium Severity Issues

#### 8. GPT: Unicode Bullet Characters Break Compatibility

**Platform**: ChatGPT  
**Severity**: Medium  
**Source**: [OpenAI Community](https://community.openai.com/t/markdown-based-copying-for-better-cross-app-compatibility/1296922)

**Problem**: ChatGPT uses Unicode bullet character (•, U+2022) instead of markdown-compatible characters (`-` or `*`), causing layout issues when pasting into other applications.

**Example - GPT Output**:
```
• First item
• Second item
• Third item
```

**Example - Expected Markdown**:
```markdown
- First item
- Second item
- Third item
```

**Workaround**: Explicitly request hyphen bullets in prompts:
```markdown
Use hyphen (-) characters for all bullet points, not Unicode bullets (•).
```

---

#### 9. All Platforms: Nested Code Block Fence Collisions

**Platform**: All  
**Severity**: Medium

**Problem**: Using ``` for both outer and inner code fences breaks markdown structure. Per CommonMark §4.5, outer fences should be longer than inner fences.

**Example - Broken**:
~~~markdown
```markdown
Here's how to create a code block:
```javascript
console.log("Hello");
```
```
~~~

**Example - Fixed (Using Tilde Fences)**:
~~~markdown
~~~markdown
Here's how to create a code block:
```javascript
console.log("Hello");
```
~~~
~~~

**Example - Fixed (Using Longer Fences)**:
~~~markdown
````markdown
Here's how to create a code block:
```javascript
console.log("Hello");
```
````
~~~

---

#### 10. GPT-4.1: Table Whitespace Spam

**Platform**: GPT-4.1  
**Severity**: Medium  
**Source**: [OpenAI Community](https://community.openai.com/t/gpt-4-1-breaks-bugs-out-and-spams-space-characters-when-generating-markdown-tables/1230193)

**Problem**: GPT-4.1 generates excessive whitespace when creating markdown tables, sometimes filling max tokens with spaces. The model appears to freeze while outputting spaces.

**Example - Broken Output**:
```markdown
| Name    | Value                                                    |
|---------|----------------------------------------------------------|
| Item 1  | Description                                              
                                                                   
                                                                   
(continues with whitespace...)
```

**Workaround**: Use alternative formats or add explicit instructions:
```markdown
## Table Formatting
- Use basic GFM table syntax without extra whitespace
- Do not add padding spaces for alignment
- Consider using JSON or CSV format for data tables
```

---

#### 11. Antigravity: Table Column Misalignment in CLI

**Platform**: Antigravity/Gemini CLI  
**Severity**: Medium  
**Source**: [GitHub Issue #3122](https://github.com/google-gemini/gemini-cli/issues/3122)

**Problem**: Table columns don't align correctly in CLI output regardless of terminal width, even when the model generates perfect markdown.

**Example - Model Output (Correct)**:
```markdown
| Feature | Status | Notes |
|---------|--------|-------|
| Auth    | Done   | v2.1  |
| API     | WIP    | v2.0  |
```

**Example - CLI Rendering (Broken)**:
```
| Feature | Status | Notes |
|---------|--------|-------|
| Auth | Done | v2.1 |
| API | WIP | v2.0 |
```

**Workaround**: Use lists instead of tables for CLI-focused output:
```markdown
Features:
- Auth: Done (v2.1)
- API: WIP (v2.0)
```

---

#### 12. Kiro: Special Task Checkbox Syntax Required

**Platform**: Kiro  
**Severity**: Medium

**Problem**: Kiro requires specific checkbox syntax for task tracking that differs from standard markdown. Using incorrect syntax will cause task status tracking to fail.

**Kiro Task Syntax**:
```markdown
- [ ] Not started (space inside brackets)
- [x] Completed (lowercase x)
- [-] In progress (dash)
- [~] Queued (tilde)
- [ ]* Optional task (asterisk after bracket)
- [ ]\* Optional task (escaped asterisk also works)
```

**Standard Markdown (Won't Work for Kiro Tasks)**:
```markdown
- [ ] Task (only this format is standard)
- [X] Completed (uppercase X may not work)
```

---

#### 13. Claude: Excessive Whitespace in Nested Structures

**Platform**: Claude  
**Severity**: Medium  
**Source**: [GitHub Issue #14649](https://github.com/anthropics/claude-code/issues/14649)

**Problem**: When combining headings with nested bullet lists, Claude Code terminal output can produce ~27 consecutive blank lines.

**Example - Problematic Structure**:
```markdown
## Main Section

### Subsection

- Item 1
  - Nested item
    - Deeply nested
- Item 2

### Another Subsection
```

**Workaround**: Flatten structure and avoid deep nesting:
```markdown
## Main Section

Subsection items:
- Item 1
- Nested item (as separate item)
- Deeply nested (as separate item)
- Item 2

Another Subsection items:
```

---

#### 14. Antigravity: Bold Text Requires Surrounding Spaces

**Platform**: Antigravity/Gemini  
**Severity**: Medium  
**Source**: [80aj.com](https://www.80aj.com/2025/12/21/fixing-bold-text-issues-in-gemini-and-antigravity-en/)

**Problem**: Bold text fails to display properly when mixed with certain content. Spaces must be added before and after `**bold content**`.

**Example - Broken**:
```markdown
The**important**value must be set.
Configure the**timeout**parameter.
```

**Example - Fixed**:
```markdown
The **important** value must be set.
Configure the **timeout** parameter.
```

---

#### 15. GPT: Square Bracket Escaping Crashes Formatting

**Platform**: ChatGPT  
**Severity**: Medium  
**Source**: [OpenAI Community](https://community.openai.com/t/or-crashes-chatgtps-formatting/785524)

**Problem**: `\[` and `\]` sequences can crash ChatGPT's formatting, making text unreadable.

**Example - Broken**:
```markdown
Use the regex pattern \[a-z\]+ to match lowercase words.
```

**Example - Fixed**:
```markdown
Use the regex pattern `[a-z]+` to match lowercase words.
```

---

### Low Severity Issues

#### 16. Claude: Code Blocks Without Language Hints Get Italicized

**Platform**: Claude  
**Severity**: Low  
**Source**: [GitHub Issue #12655](https://github.com/anthropics/claude-code/issues/12655)

**Problem**: Fenced code blocks without a language hint may incorrectly apply markdown formatting to content inside.

**Example - Broken**:
~~~markdown
```
function get_user_data() {
  return _cached_data;
}
```
~~~

**Rendered Output** (may show italics):
> function get*user*data() { return *cached*data; }

**Example - Fixed**:
~~~markdown
```javascript
function get_user_data() {
  return _cached_data;
}
```
~~~

---

#### 17. Antigravity: Double Spaces in Prose Output

**Platform**: Antigravity/Gemini  
**Severity**: Low  
**Source**: [Google AI Forum](https://discuss.ai.google.dev/t/geminis-double-space-issue/73460)

**Problem**: Gemini models add double spaces after periods and in other places in prose output.

**Example - Gemini Output**:
```
This is a sentence.  Here is another one.  And a third.
```

**Workaround**: Post-process output to replace double spaces with single spaces.

---

#### 18. GPT: Links Not Clickable in Desktop App

**Platform**: ChatGPT Desktop  
**Severity**: Low  
**Source**: [OpenAI Community](https://community.openai.com/t/custom-gpt-links-arent-clickable-on-desktop/878903)

**Problem**: Links render correctly as markdown but aren't clickable in the desktop ChatGPT interface. Mobile and web versions work correctly.

**Example**:
```markdown
Visit [OpenAI Documentation](https://platform.openai.com/docs) for more info.
```

**Workaround**: Provide full URLs separately when desktop users need to click links:
```markdown
Visit the OpenAI Documentation for more info.
URL: https://platform.openai.com/docs
```

---

## Recommended Patterns

This section provides safe markdown patterns that work consistently across all platforms. Following these patterns will minimize cross-platform compatibility issues.

### Core Principles

1. **Simplicity wins** - Simpler markdown structures have fewer platform-specific quirks
2. **Explicit is better** - Always specify language hints, use explicit blank lines, wrap special content
3. **Test on target platforms** - When in doubt, test your skill on each target platform

---

### Safe Markdown Patterns (Work Everywhere)

#### Headings

**DO**: Use ATX-style headings with proper hierarchy
```markdown
# Main Title
## Section
### Subsection
```

**DON'T**: Use setext-style headings or skip levels
```markdown
Main Title
==========

Subsection (skipping ## level)
### This breaks hierarchy
```

---

#### Lists

**DO**: Keep lists flat and simple with blank lines before them
```markdown
Here are the steps:

- Step one
- Step two
- Step three
```

**DO**: Use numbered lists for sequential steps
```markdown
Installation process:

1. Download the package
2. Extract the files
3. Run the installer
```

**DON'T**: Use bold inside list items (breaks Antigravity)
```markdown
- **Important**: This will truncate the list on Antigravity
```

**DON'T**: Nest lists deeper than 2 levels
```markdown
- Level 1
  - Level 2
    - Level 3 (problematic on multiple platforms)
```

**DON'T**: Include code blocks inside list items
```markdown
- Run this command:
  ```bash
  npm install  # This breaks on Antigravity
  ```
```

**INSTEAD**: Place code blocks after the list
```markdown
- Run the installation command (see below)
- Configure the settings
- Start the application

```bash
npm install
```

---

#### Code Blocks

**DO**: Always specify language hints
```markdown
```typescript
const config: Config = { timeout: 5000 };
```
```

**DO**: Include blank lines before code blocks
```markdown
Run this command:

```bash
npm run build
```
```

**DO**: Use tilde fences (`~~~`) for outer blocks when nesting
~~~markdown
Here's how to document code:

~~~markdown
```javascript
console.log("nested example");
```
~~~
~~~

**DON'T**: Use code blocks without language hints
```markdown
```
function example() {
  return _value;  // May get italicized
}
```
```

**DON'T**: Use same fence style for nested blocks
```markdown
```markdown
```javascript
// This breaks the outer fence
```
```
```

---

#### Emphasis and Formatting

**DO**: Wrap identifiers containing underscores in backticks
```markdown
Set the `max_retry_count` variable to configure retries.
The `user_profile_data` object contains user information.
```

**DO**: Add spaces around bold text
```markdown
This is **important** information.
```

**DON'T**: Use underscores in prose without backticks
```markdown
Set the max_retry_count variable.  // Renders as italics
```

**DON'T**: Use bold without surrounding spaces (breaks Antigravity)
```markdown
The**important**value must be set.
```

---

#### Tables

**DO**: Use simple tables with few columns
```markdown
| Option | Default | Description |
|--------|---------|-------------|
| timeout | 5000 | Request timeout in ms |
| retries | 3 | Number of retry attempts |
```

**PREFER**: Lists over tables for CLI-focused output
```markdown
Configuration options:
- `timeout`: 5000 (request timeout in ms)
- `retries`: 3 (number of retry attempts)
```

**DON'T**: Use complex tables with many columns or non-ASCII content
```markdown
| Feature | Status | Owner | Priority | Sprint | Notes | Dependencies |
// Too many columns - causes alignment issues
```

---

#### Special Characters

**DO**: Use HTML entities for angle brackets outside code
```markdown
Use the &lt;config&gt; element to define settings.
```

**DO**: Wrap special characters in backticks
```markdown
The `|` character is used as a pipe operator.
Use `[brackets]` for optional parameters.
```

**DON'T**: Use backslash escaping for underscores
```markdown
The file config\_settings.json  // May remove underscore entirely
```

**DON'T**: Use `\[` or `\]` (crashes GPT formatting)
```markdown
Match pattern \[a-z\]+  // Use backticks instead
```

---

#### Links

**DO**: Use standard inline link syntax
```markdown
See the [documentation](https://example.com/docs) for details.
```

**DO**: Provide full URLs when clickability matters
```markdown
Documentation: https://example.com/docs
```

**DON'T**: Rely on bare URL auto-linking
```markdown
Visit https://example.com for more info.  // May not linkify
```

---

#### Line Breaks and Whitespace

**DO**: Use explicit blank lines to separate sections
```markdown
First paragraph ends here.

Second paragraph starts here.
```

**DO**: Use `<br>` for explicit line breaks when needed
```markdown
Line one<br>
Line two (same paragraph)
```

**DON'T**: Rely on trailing spaces for line breaks
```markdown
Line one  
Line two  // Trailing spaces are invisible and unreliable
```

---

### Platform-Specific Syntax

#### Kiro File References
```markdown
#[[file:path/to/file.ts]]
```

#### Kiro Context Keys (in chat)
```markdown
#File, #Folder, #Problems, #Terminal, #Git Diff
```

#### Kiro Task Checkboxes
```markdown
- [ ] Not started
- [x] Completed
- [-] In progress
- [~] Queued
- [ ]* Optional task
```

---

### Pattern Summary Table

| Pattern | Why | Platforms Affected |
|---------|-----|-------------------|
| Blank lines before blocks | Prevents rendering issues | Claude, Kiro, Amazon Q |
| Language hints on code | Prevents italicization | Claude, Codex, Amazon Q |
| No bold in lists | Prevents truncation | Antigravity |
| Flat lists (max 2 levels) | Prevents omission | Antigravity |
| Backticks for snake_case | Prevents italics | All |
| Tilde fences for nesting | Prevents fence collision | All |
| Lists over tables | Better CLI rendering | Antigravity, Codex |
| HTML entities for `<>` | Prevents HTML interpretation | All |
| Spaces around bold | Ensures rendering | Antigravity |
| No backslash escaping | Unreliable behavior | Claude, Codex, Amazon Q |

---

## Platform Overrides Examples

Use `platformOverrides` in skill definitions when cross-platform behavior differs significantly. The framework supports two override properties:

- `instructions`: Replaces the entire instructions section for a platform
- `additionalContent`: Appends platform-specific guidance to the base instructions

---

### Critical Quirk #1: Antigravity List Truncation

**Problem**: Bold text in lists causes truncation; nested lists are silently omitted.

**Base Skill**:
```markdown
## Instructions

When documenting configuration options:

- **Required**: Set the timeout value
- **Optional**: Configure retry count
  - Default: 3 retries
  - Maximum: 10 retries
- **Advanced**: Enable debug logging
```

**With Platform Override**:
```json
{
  "name": "config-documentation",
  "instructions": "When documenting configuration options:\n\n- Required: Set the timeout value\n- Optional: Configure retry count\n  - Default: 3 retries\n  - Maximum: 10 retries\n- Advanced: Enable debug logging",
  "platformOverrides": {
    "antigravity": {
      "instructions": "When documenting configuration options:\n\n- Required - Set the timeout value\n- Optional - Configure retry count\n- Retry default: 3 retries\n- Retry maximum: 10 retries\n- Advanced - Enable debug logging"
    }
  }
}
```

**Why**: Antigravity version removes bold markers and flattens nested lists to prevent truncation.

---

### Critical Quirk #2: Claude Missing Blank Lines

**Problem**: Claude often omits blank lines before lists and code blocks.

**Base Skill**:
```markdown
## Instructions

Generate a configuration file with these steps:
- Read the template
- Apply user settings
- Write the output

Example output:
```yaml
timeout: 5000
retries: 3
```
```

**With Platform Override**:
```json
{
  "name": "config-generator",
  "instructions": "Generate a configuration file with these steps:\n- Read the template\n- Apply user settings\n- Write the output\n\nExample output:\n```yaml\ntimeout: 5000\nretries: 3\n```",
  "platformOverrides": {
    "claude-code": {
      "additionalContent": "\n\n## Formatting Requirements\n\nIMPORTANT: Always include a blank line before:\n- Any bullet list\n- Any numbered list\n- Any fenced code block\n\nThis ensures proper markdown rendering."
    }
  }
}
```

**Why**: The `additionalContent` reminds Claude to add proper spacing without rewriting the entire skill.

---

### Critical Quirk #3: Codex Plain Text Code Output

**Problem**: Codex CLI sometimes outputs code as unformatted plain text.

**Base Skill**:
```markdown
## Instructions

Create a utility function that validates email addresses.
Return the implementation with proper error handling.
```

**With Platform Override**:
```json
{
  "name": "email-validator",
  "instructions": "Create a utility function that validates email addresses.\nReturn the implementation with proper error handling.",
  "platformOverrides": {
    "codex": {
      "additionalContent": "\n\n## Code Output Requirements\n\nWhen outputting code:\n1. ALWAYS use fenced code blocks (triple backticks)\n2. ALWAYS include the language identifier (e.g., ```typescript)\n3. NEVER output code as plain unformatted text\n4. Use hyphen (-) characters for all bullet points, not Unicode bullets (•)"
    }
  }
}
```

**Why**: Explicit formatting instructions prevent Codex from outputting unformatted code.

---

### Critical Quirk #4: Snake_case Italicization (All Platforms)

**Problem**: Underscores in identifiers trigger unintended italics on all platforms.

**Base Skill**:
```markdown
## Instructions

Set the user_profile_data variable to store authentication state.
Configure max_retry_count for optimal performance.
```

**With Platform Override**:
```json
{
  "name": "auth-setup",
  "instructions": "Set the `user_profile_data` variable to store authentication state.\nConfigure `max_retry_count` for optimal performance.",
  "platformOverrides": {
    "antigravity": {
      "additionalContent": "\n\n## Identifier Formatting\n\nWhen referencing variables or identifiers containing underscores:\n- Always wrap them in backticks: `variable_name`\n- Never use bare underscores in prose text"
    },
    "claude-code": {
      "additionalContent": "\n\n## Identifier Formatting\n\nWhen referencing variables or identifiers containing underscores:\n- Always wrap them in backticks: `variable_name`\n- Do NOT use backslash escaping (\\_) as it may remove the underscore"
    }
  }
}
```

**Why**: Base instructions use backticks; overrides add platform-specific reminders.

---

### Critical Quirk #5: Antigravity Code Blocks in Lists

**Problem**: List items containing code blocks are silently omitted.

**Base Skill**:
```markdown
## Instructions

Document the API endpoints:

- GET /users - Returns user list
  ```json
  { "users": [...] }
  ```
- POST /users - Creates a user
  ```json
  { "name": "string" }
  ```
```

**With Platform Override**:
```json
{
  "name": "api-documentation",
  "instructions": "Document the API endpoints:\n\n- GET /users - Returns user list\n  ```json\n  { \"users\": [...] }\n  ```\n- POST /users - Creates a user\n  ```json\n  { \"name\": \"string\" }\n  ```",
  "platformOverrides": {
    "antigravity": {
      "instructions": "Document the API endpoints:\n\n- GET /users - Returns user list (see example below)\n- POST /users - Creates a user (see example below)\n\nGET /users response:\n```json\n{ \"users\": [...] }\n```\n\nPOST /users request body:\n```json\n{ \"name\": \"string\" }\n```"
    }
  }
}
```

**Why**: Antigravity version moves code blocks outside list items to prevent omission.

---

### Critical Quirk #6: Table Rendering Issues

**Problem**: Tables render poorly on Antigravity CLI and Codex.

**Base Skill**:
```markdown
## Instructions

Display the configuration options:

| Option | Default | Description |
|--------|---------|-------------|
| timeout | 5000 | Request timeout in ms |
| retries | 3 | Number of retry attempts |
```

**With Platform Override**:
```json
{
  "name": "config-display",
  "instructions": "Display the configuration options:\n\n| Option | Default | Description |\n|--------|---------|-------------|\n| timeout | 5000 | Request timeout in ms |\n| retries | 3 | Number of retry attempts |",
  "platformOverrides": {
    "antigravity": {
      "instructions": "Display the configuration options:\n\nConfiguration options:\n- `timeout`: 5000 (request timeout in ms)\n- `retries`: 3 (number of retry attempts)"
    },
    "codex": {
      "instructions": "Display the configuration options:\n\nConfiguration options:\n- `timeout`: 5000 - Request timeout in ms\n- `retries`: 3 - Number of retry attempts\n\nNote: Use list format instead of tables for better CLI rendering."
    }
  }
}
```

**Why**: CLI platforms get list-based alternatives that render reliably.

---

### Critical Quirk #7: Kiro-Specific Syntax

**Problem**: Kiro has unique syntax for task checkboxes and file references.

**Base Skill**:
```markdown
## Instructions

Create a task list for the implementation:

- [ ] Set up project structure
- [ ] Implement core logic
- [ ] Add tests
```

**With Platform Override**:
```json
{
  "name": "task-creator",
  "instructions": "Create a task list for the implementation:\n\n- [ ] Set up project structure\n- [ ] Implement core logic\n- [ ] Add tests",
  "platformOverrides": {
    "kiro": {
      "additionalContent": "\n\n## Kiro Task Syntax\n\nUse these checkbox formats for task status:\n- `- [ ]` Not started (space inside brackets)\n- `- [x]` Completed (lowercase x)\n- `- [-]` In progress (dash)\n- `- [~]` Queued (tilde)\n- `- [ ]*` Optional task (asterisk after bracket)\n\nFor file references, use: `#[[file:path/to/file.ts]]`"
    }
  }
}
```

**Why**: Kiro override adds platform-specific syntax documentation.

---

### Critical Quirk #8: Nested Code Block Fences

**Problem**: Same fence length for nested blocks breaks markdown on all platforms.

**Base Skill**:
```markdown
## Instructions

Show how to create a code block in documentation:

```markdown
Here's an example:
```javascript
console.log("Hello");
```
```
```

**With Platform Override**:
```json
{
  "name": "docs-example",
  "instructions": "Show how to create a code block in documentation:\n\n~~~markdown\nHere's an example:\n```javascript\nconsole.log(\"Hello\");\n```\n~~~",
  "platformOverrides": {
    "claude-code": {
      "additionalContent": "\n\n## Nested Code Blocks\n\nWhen showing code block examples:\n- Use tilde fences (~~~) for the outer block\n- Use backtick fences (```) for inner blocks\n- Or use longer fence sequences (4+ backticks) for outer blocks"
    },
    "codex": {
      "additionalContent": "\n\n## Nested Code Blocks\n\nWhen showing code block examples:\n- Use tilde fences (~~~) for the outer block\n- Use backtick fences (```) for inner blocks\n- Never use the same fence style at both levels"
    }
  }
}
```

**Why**: Base instructions use tilde fences; overrides explain the pattern.

---

### Complete Multi-Platform Skill Example

Here's a comprehensive example showing overrides for all critical quirks:

```json
{
  "name": "api-client-generator",
  "title": "API Client Generator",
  "description": "Generates a typed API client from endpoint definitions",
  "version": "1.0.0",
  "supportedPlatforms": ["kiro", "claude-code", "codex", "antigravity", "amazonq"],
  "instructions": "Generate a typed API client with the following features:\n\n- **Authentication**: Support for API key and OAuth2\n  - API key via header\n  - OAuth2 with refresh tokens\n- **Error handling**: Typed error responses\n- **Retry logic**: Configurable retry with exponential backoff\n\nExample usage:\n```typescript\nconst client = new ApiClient({ apiKey: 'xxx' });\nconst users = await client.getUsers();\n```\n\nConfiguration options:\n\n| Option | Type | Default |\n|--------|------|--------|\n| timeout | number | 5000 |\n| retries | number | 3 |",
  "parameters": [
    {
      "name": "baseUrl",
      "type": "string",
      "required": true,
      "description": "Base URL for the API"
    }
  ],
  "platformOverrides": {
    "antigravity": {
      "instructions": "Generate a typed API client with the following features:\n\n- Authentication - Support for API key and OAuth2\n- API key authentication via header\n- OAuth2 with refresh tokens\n- Error handling - Typed error responses\n- Retry logic - Configurable retry with exponential backoff\n\nExample usage (see code below)\n\n```typescript\nconst client = new ApiClient({ apiKey: 'xxx' });\nconst users = await client.getUsers();\n```\n\nConfiguration options:\n- `timeout`: number (default: 5000)\n- `retries`: number (default: 3)"
    },
    "claude-code": {
      "additionalContent": "\n\n## Formatting Requirements\n\n- Always include blank lines before lists and code blocks\n- Always specify language hints on code blocks\n- Wrap identifiers like `api_key` in backticks"
    },
    "codex": {
      "additionalContent": "\n\n## Output Requirements\n\n- Always use fenced code blocks with language hints\n- Never output code as plain text\n- Use hyphen (-) for bullet points\n- Prefer lists over tables for configuration display"
    },
    "kiro": {
      "additionalContent": "\n\n## Kiro-Specific\n\n- Use `#[[file:path]]` syntax for file references\n- Task checkboxes: `[ ]` not started, `[x]` done, `[-]` in progress"
    },
    "amazonq": {
      "additionalContent": "\n\n## Amazon Q-Specific\n\n- Rules are auto-loaded from `.amazonq/rules/` — no conditional inclusion\n- Always include blank lines before lists and code blocks (inherited Claude quirk)\n- Wrap identifiers like `api_key` in backticks\n- Do NOT use backslash escaping (\\_) as it may remove the underscore"
    }
  }
}
```

---

### Override Strategy Summary

| Quirk | Platform | Strategy | Override Type |
|-------|----------|----------|---------------|
| Bold in lists | Antigravity | Remove bold markers | `instructions` |
| Nested lists | Antigravity | Flatten to single level | `instructions` |
| Code in lists | Antigravity | Move code outside lists | `instructions` |
| Missing blank lines | Claude, Amazon Q | Add formatting reminder | `additionalContent` |
| Plain text code | Codex | Add explicit formatting rules | `additionalContent` |
| Snake_case italics | All | Use backticks in base | Base + `additionalContent` |
| Table rendering | Antigravity, Codex | Convert to lists | `instructions` |
| Task syntax | Kiro | Add syntax reference | `additionalContent` |
| Nested fences | All | Use tilde in base | Base + `additionalContent` |
| Backslash escaping | Claude, Amazon Q | Use inline code instead | `additionalContent` |

---

## Quick Checklist for Skill Authors

Before publishing a skill for cross-platform use:

- [ ] All code blocks have language hints
- [ ] Blank lines before all lists and code blocks
- [ ] No bold text inside list items
- [ ] No nested lists deeper than 2 levels
- [ ] No code blocks inside list items
- [ ] All snake_case identifiers wrapped in backticks
- [ ] Tables kept simple or replaced with lists
- [ ] Tilde fences used for nested code examples
- [ ] Platform-specific syntax documented in overrides

---

## Additional Resources

- [docs/research/claude-markdown-quirks.md](research/claude-markdown-quirks.md) - Detailed Claude research
- [docs/research/codex-gpt-markdown-quirks.md](research/codex-gpt-markdown-quirks.md) - Detailed Codex/GPT research
- [docs/research/kiro-markdown-quirks.md](research/kiro-markdown-quirks.md) - Detailed Kiro research
- [docs/research/antigravity-markdown-quirks.md](research/antigravity-markdown-quirks.md) - Detailed Antigravity research
- [docs/research/amazonq-vscode-quirks.md](research/amazonq-vscode-quirks.md) - Detailed Amazon Q Developer research

---

*Last updated: February 2026*
