# Live Platform Testing Protocol

Manual test protocol for verifying SDD framework behavior on real AI agent platforms.

## Prerequisites

- Node.js 18+, `npm run build` completed
- Access to target platform (Kiro, Codex, or Antigravity)

## Test Scenarios

Run in order on a clean workspace or temp directory.

### 1. Fresh Workspace Init

```
npx sdd workspace-init --platform <PLATFORM> --json
npx sdd verify --platform <PLATFORM> --json
```

Record: JSON output, agent behavior, any deviations.

### 2. Create Spec

```
npx sdd create-spec live-test-feature --json
npx sdd verify --spec live-test-feature --json
```

Record: JSON output, kebab-case handling.

### 3. Install Skills

```
npx sdd install-skills --platform <PLATFORM> --json
npx sdd verify --platform <PLATFORM> --json
```

Record: JSON output, skill file locations, CLI invocation sections.

### 4. Run Task (Status Update)

Prerequisite: Scenario 2 done, `tasks.md` added with at least one task.

```
npx sdd run-task --spec live-test-feature --task 1.1 --status completed --json
npx sdd verify --spec live-test-feature --json
```

Record: JSON output, task status update in file.

### 5. Platform Switch

```
npx sdd workspace-init --platform <SOURCE> --json
npx sdd create-spec switch-test --json
npx sdd install-skills --platform <SOURCE> --json
npx sdd workspace-init --platform <TARGET> --json
npx sdd install-skills --platform <TARGET> --json
npx sdd verify --spec switch-test --platform <TARGET> --json
```

Record: All JSON output, spec survival, skill re-installation, file conflicts.

### 6. Skill Instruction Compliance

```
npx sdd install-skills --platform <PLATFORM> --json
```

Then ask the agent: "Using the installed create-spec skill, create a spec called agent-compliance-test"

Record: Whether agent used CLI command vs manual file creation.

## Interpreting Results

Compare across platforms:
1. Command output parity (same JSON structure?)
2. Agent compliance (CLI instructions followed?)
3. Platform switch integrity (specs survive?)
4. Failure modes (where do agents struggle?)

Save results as `results/YYYY-MM-DD-<platform>.md`.
