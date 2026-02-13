#!/usr/bin/env node
/**
 * CLI Entry Point for SDD Framework (Spec-Driven Development)
 * 
 * Provides command-line interface for project initialization,
 * workspace setup, skill installation, spec creation, and task execution.
 * 
 * Requirements: 1.1, 1.2, 1.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import {
  PlatformId,
  TaskStatus,
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
  AmazonQAdapter,
  SkillRegistry,
  TaskTracker,
  allSkills,
  PlatformAdapter
} from './index.js';
import {
  CreateSpecCommand,
  RunTaskCommand,
  WorkspaceInitCommand,
  InstallSkillsCommand,
  VerifyCommand,
  getFormatter,
  ErrorCode,
  type CommandResult
} from './commands/index.js';
import { RefineCommand } from './commands/refine-command.js';
import { StartGroupCommand } from './commands/start-group-command.js';
import { NodeVerifyFileSystem } from './verification/verify-file-system.js';
import { SpecVerifier } from './verification/spec-verifier.js';
import { TaskVerifier } from './verification/task-verifier.js';
import { PlatformVerifier } from './verification/platform-verifier.js';
import { SkillVerifier } from './verification/skill-verifier.js';
import { buildVerificationData, mergeChecks, type VerificationCheck } from './verification/verification-data.js';

// Read version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
const VERSION = pkg.version;

// Exit codes based on error categories (Requirements: 1.5)
const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_ERROR: 1,
  RESOURCE_ERROR: 2,
  FILE_SYSTEM_ERROR: 3,
  INTERNAL_ERROR: 99
} as const;

// Command definitions
type Command = 'init' | 'install' | 'create-spec' | 'run-task' | 'refine' | 'start-group' | 'verify' | 'help' | 'version';

interface ParsedArgs {
  command: Command;
  unknownCommand?: string;
  platform?: PlatformId;
  specName?: string;
  taskId?: string;
  status?: TaskStatus;
  skills?: string[];
  mode?: 'requirements-first' | 'design-first';
  doc?: string;
  group?: string;
  force: boolean;
  json: boolean;
  help: boolean;
  verify: boolean;
}

const PLATFORMS: PlatformId[] = ['kiro', 'claude-code', 'codex', 'antigravity', 'amazonq'];
const TASK_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'completed', 'failed'];

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: 'help',
    force: false,
    json: false,
    help: false,
    verify: false
  };

  if (args.length === 0) {
    return result;
  }

  const command = args[0];
  
  // Check for global flags
  result.help = args.includes('--help') || args.includes('-h');
  result.json = args.includes('--json');
  result.force = args.includes('--force') || args.includes('-f');
  result.verify = args.includes('--verify');

  // Parse command
  switch (command) {
    case 'init':
    case 'workspace-init':
      result.command = 'init';
      result.platform = parsePlatform(args);
      break;
    case 'install':
    case 'install-skills':
      result.command = 'install';
      result.platform = parsePlatform(args);
      result.skills = parseSkills(args);
      break;
    case 'create-spec':
      result.command = 'create-spec';
      result.platform = parsePlatform(args);
      result.specName = parseSpecName(args);
      result.mode = parseMode(args);
      break;
    case 'run-task':
      result.command = 'run-task';
      result.specName = parseSpecName(args);
      result.taskId = parseTaskId(args);
      result.status = parseStatus(args);
      break;
    case 'verify':
      result.command = 'verify';
      result.specName = parseSpecName(args);
      result.platform = parsePlatform(args);
      result.skills = parseSkills(args);
      break;
    case 'refine':
      result.command = 'refine';
      result.specName = parseSpecName(args);
      result.doc = parseDoc(args);
      break;
    case 'start-group':
      result.command = 'start-group';
      result.specName = parseSpecName(args);
      result.group = parseGroup(args);
      break;
    case 'version':
    case '--version':
    case '-v':
      result.command = 'version';
      break;
    case 'help':
    case '--help':
    case '-h':
      result.command = 'help';
      break;
    default:
      // Unknown command — preserve it for error reporting
      result.command = 'help';
      result.unknownCommand = command;
      break;
  }

  return result;
}

/**
 * Parse platform from arguments
 */
function parsePlatform(args: string[]): PlatformId | undefined {
  const platformIndex = args.findIndex(a => a === '--platform' || a === '-p');
  if (platformIndex !== -1 && args[platformIndex + 1]) {
    const platform = args[platformIndex + 1] as PlatformId;
    if (PLATFORMS.includes(platform)) {
      return platform;
    }
  }
  return undefined;
}

/**
 * Parse spec name from arguments
 */
function parseSpecName(args: string[]): string | undefined {
  // Check for --spec or --name flag
  const specIndex = args.findIndex(a => a === '--spec' || a === '--name' || a === '-n');
  if (specIndex !== -1 && args[specIndex + 1]) {
    return args[specIndex + 1];
  }
  // Also check for positional argument after command
  if (args.length > 1 && !args[1].startsWith('-')) {
    return args[1];
  }
  return undefined;
}

/**
 * Parse task ID from arguments
 */
function parseTaskId(args: string[]): string | undefined {
  const taskIndex = args.findIndex(a => a === '--task' || a === '-t');
  if (taskIndex !== -1 && args[taskIndex + 1]) {
    return args[taskIndex + 1];
  }
  return undefined;
}

/**
 * Parse task status from arguments
 */
function parseStatus(args: string[]): TaskStatus | undefined {
  const statusIndex = args.findIndex(a => a === '--status' || a === '-s');
  if (statusIndex !== -1 && args[statusIndex + 1]) {
    const status = args[statusIndex + 1] as TaskStatus;
    if (TASK_STATUSES.includes(status)) {
      return status;
    }
  }
  return undefined;
}

/**
 * Parse generation mode from arguments
 */
function parseMode(args: string[]): 'requirements-first' | 'design-first' | undefined {
  const modeIndex = args.findIndex(a => a === '--mode' || a === '-m');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    const mode = args[modeIndex + 1];
    if (mode === 'requirements-first' || mode === 'design-first') {
      return mode;
    }
  }
  return undefined;
}

/**
 * Parse skills list from arguments
 */
function parseSkills(args: string[]): string[] | undefined {
  const skillsIndex = args.findIndex(a => a === '--skills');
  if (skillsIndex !== -1 && args[skillsIndex + 1]) {
    return args[skillsIndex + 1].split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return undefined;
}

/**
 * Parse document type from arguments
 */
function parseDoc(args: string[]): string | undefined {
  const docIndex = args.findIndex(a => a === '--doc' || a === '-d');
  if (docIndex !== -1 && args[docIndex + 1]) {
    return args[docIndex + 1];
  }
  return undefined;
}

/**
 * Parse group ID from arguments
 */
function parseGroup(args: string[]): string | undefined {
  const groupIndex = args.findIndex(a => a === '--group' || a === '-g');
  if (groupIndex !== -1 && args[groupIndex + 1]) {
    return args[groupIndex + 1];
  }
  return undefined;
}

/**
 * Create platform adapters map
 */
function createAdapters(): Map<PlatformId, PlatformAdapter> {
  const adapters = new Map<PlatformId, PlatformAdapter>();
  adapters.set('kiro', new KiroAdapter());
  adapters.set('claude-code', new ClaudeCodeAdapter());
  adapters.set('codex', new CodexAdapter());
  adapters.set('antigravity', new AntigravityAdapter());
  adapters.set('amazonq', new AmazonQAdapter());
  return adapters;
}

/**
 * Create file system implementation for CreateSpecCommand
 */
function createSpecFileSystem(): import('./commands/create-spec-command.js').CreateSpecFileSystem {
  return {
    exists: async (p: string) => fs.existsSync(p),
    mkdir: async (p: string) => { fs.mkdirSync(p, { recursive: true }); },
    writeFile: async (p: string, content: string) => { fs.writeFileSync(p, content, 'utf-8'); }
  };
}

/**
 * Create file system implementation for RunTaskCommand
 */
function createRunTaskFileSystem(): import('./commands/run-task-command.js').RunTaskFileSystem {
  return {
    exists: async (p: string) => fs.existsSync(p),
    readFile: async (p: string) => fs.readFileSync(p, 'utf-8')
  };
}

/**
 * Create file system implementation for WorkspaceInitCommand
 */
function createWorkspaceInitFileSystem(): import('./commands/workspace-init-command.js').WorkspaceInitFileSystem {
  return {
    exists: async (p: string) => fs.existsSync(p),
    mkdir: async (p: string) => { fs.mkdirSync(p, { recursive: true }); },
    writeFile: async (p: string, content: string) => { fs.writeFileSync(p, content, 'utf-8'); },
    readFile: async (p: string) => fs.readFileSync(p, 'utf-8'),
    readdir: async (p: string) => fs.readdirSync(p),
    isDirectory: async (p: string) => fs.existsSync(p) && fs.statSync(p).isDirectory()
  };
}

/**
 * Create file system implementation for InstallSkillsCommand
 */
function createInstallSkillsFileSystem(): import('./commands/install-skills-command.js').InstallSkillsFileSystem {
  return {
    exists: async (p: string) => fs.existsSync(p),
    mkdir: async (p: string) => { fs.mkdirSync(p, { recursive: true }); },
    writeFile: async (p: string, content: string) => { fs.writeFileSync(p, content, 'utf-8'); }
  };
}

/**
 * Get exit code based on error code (Requirements: 1.5)
 */
function getExitCode(result: CommandResult): number {
  if (result.success) {
    return EXIT_CODES.SUCCESS;
  }

  const errorCode = result.error?.code;
  
  // Validation errors (exit code 1)
  if (errorCode === ErrorCode.INVALID_SPEC_NAME ||
      errorCode === ErrorCode.INVALID_PLATFORM ||
      errorCode === ErrorCode.INVALID_TASK_STATUS ||
      errorCode === ErrorCode.INVALID_TASK_ID ||
      errorCode === ErrorCode.MISSING_ARGUMENT ||
      errorCode === ErrorCode.UNKNOWN_COMMAND) {
    return EXIT_CODES.VALIDATION_ERROR;
  }

  // Resource errors (exit code 2)
  if (errorCode === ErrorCode.SPEC_EXISTS ||
      errorCode === ErrorCode.SPEC_NOT_FOUND ||
      errorCode === ErrorCode.TASK_NOT_FOUND ||
      errorCode === ErrorCode.SKILL_NOT_FOUND) {
    return EXIT_CODES.RESOURCE_ERROR;
  }

  // File system errors (exit code 3)
  if (errorCode === ErrorCode.PATH_ESCAPE ||
      errorCode === ErrorCode.WRITE_FAILED ||
      errorCode === ErrorCode.READ_FAILED ||
      errorCode === ErrorCode.VERIFICATION_READ_ERROR) {
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  // Verification errors (exit code 1)
  if (errorCode === ErrorCode.VERIFICATION_FAILED) {
    return EXIT_CODES.VALIDATION_ERROR;
  }

  // Unknown command or internal errors (exit code 99)
  return EXIT_CODES.INTERNAL_ERROR;
}

/**
 * Output result and exit with appropriate code
 */
function outputAndExit(result: CommandResult, jsonMode: boolean): never {
  const formatter = getFormatter(jsonMode);
  const output = formatter.format(result);
  
  if (result.success) {
    console.log(output);
  } else {
    console.error(output);
  }
  
  process.exit(getExitCode(result));
}

const HELP_TEXT = `
SDD Framework CLI (Spec-Driven Development)

Usage: npx sdd <command> [options]

Commands:
  workspace-init    Initialize workspace for a target platform
  install-skills    Install framework skills to workspace
  create-spec       Create a new spec folder
  run-task          Update task status in tasks.md
  refine            Compose a refine instruction and copy to clipboard
  start-group       Compose a start-task-group instruction and copy to clipboard
  verify            Verify workspace/spec state
  help              Show this help message
  version           Show version information

Global Options:
  --json            Output results as JSON
  --verify          Run verification after command execution
  -h, --help        Show help for a command

Command: workspace-init
  Initialize workspace for a specific platform
  
  Options:
    -p, --platform <platform>  Target platform (required)
                               Values: kiro, claude-code, codex, antigravity, amazonq
  
  Example:
    npx sdd workspace-init --platform claude-code

Command: install-skills
  Install framework skills to workspace
  
  Options:
    -p, --platform <platform>  Target platform (required)
    --skills <list>            Comma-separated list of skills to install
    -f, --force                Overwrite existing skills
  
  Example:
    npx sdd install-skills --platform kiro
    npx sdd install-skills --platform kiro --skills create-spec,run-task

Command: create-spec
  Create a new spec folder with template files
  
  Options:
    <name>                     Spec name (positional, kebab-case)
    -n, --name <name>          Spec name (alternative)
    -p, --platform <platform>  Target platform (optional)
    -m, --mode <mode>          Generation mode: requirements-first, design-first
  
  Example:
    npx sdd create-spec my-feature
    npx sdd create-spec --name user-auth --mode design-first

Command: run-task
  Update task status in tasks.md
  
  Options:
    --spec <name>              Spec name (required)
    -t, --task <id>            Task ID, e.g., "1.1" (required)
    -s, --status <status>      New status (required)
                               Values: not_started, in_progress, completed, failed
  
  Example:
    npx sdd run-task --spec my-feature --task 1.1 --status in_progress

Command: refine
  Compose a refine instruction and copy to clipboard
  
  Options:
    --spec <name>              Spec name (required)
    -d, --doc <type>           Document type (required)
                               Values: requirements, design, tasks
  
  Example:
    npx sdd refine --spec my-feature --doc requirements

Command: start-group
  Compose a start-task-group instruction and copy to clipboard
  
  Options:
    --spec <name>              Spec name (required)
    -g, --group <id>           Group number (required, e.g., "1" or "2")
  
  Example:
    npx sdd start-group --spec my-feature --group 1

Command: verify
  Verify workspace or spec state
  
  Options:
    --spec <name>              Spec name to verify
    -p, --platform <platform>  Platform to verify
    --skills <list>            Comma-separated list of skills to verify
  
  Example:
    npx sdd verify --spec my-feature
    npx sdd verify --platform claude-code
    npx sdd verify --spec my-feature --json
`.trim();

/**
 * Execute workspace-init command using WorkspaceInitCommand
 * Requirements: 1.1, 1.2
 */
async function executeWorkspaceInit(parsed: ParsedArgs): Promise<CommandResult> {
  if (!parsed.platform) {
    return {
      success: false,
      command: 'workspace-init',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: '--platform is required for workspace-init command',
        details: { validPlatforms: PLATFORMS }
      }
    };
  }

  const adapters = createAdapters();
  const workspaceInitFs = createWorkspaceInitFileSystem();
  const command = new WorkspaceInitCommand(workspaceInitFs, adapters);

  return command.execute({
    platform: parsed.platform,
    force: parsed.force
  });
}

/**
 * Execute install-skills command using InstallSkillsCommand
 * Requirements: 1.1, 1.2
 */
async function executeInstallSkills(parsed: ParsedArgs): Promise<CommandResult> {
  if (!parsed.platform) {
    return {
      success: false,
      command: 'install-skills',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: '--platform is required for install-skills command',
        details: { validPlatforms: PLATFORMS }
      }
    };
  }

  const adapters = createAdapters();
  const registry = new SkillRegistry();
  const installSkillsFs = createInstallSkillsFileSystem();

  // Register all skills
  allSkills.forEach(skill => registry.register(skill));

  const command = new InstallSkillsCommand(registry, adapters, installSkillsFs);

  return command.execute({
    platform: parsed.platform,
    skills: parsed.skills,
    force: parsed.force
  });
}

/**
 * Execute create-spec command using CreateSpecCommand
 * Requirements: 1.1, 1.2
 */
async function executeCreateSpec(parsed: ParsedArgs): Promise<CommandResult> {
  if (!parsed.specName) {
    return {
      success: false,
      command: 'create-spec',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: 'Spec name is required for create-spec command',
        details: { usage: 'npx sdd create-spec <name> [--platform <platform>] [--mode <mode>]' }
      }
    };
  }

  const createSpecFs = createSpecFileSystem();
  const command = new CreateSpecCommand(createSpecFs);

  return command.execute({
    name: parsed.specName,
    platform: parsed.platform,
    mode: parsed.mode
  });
}

/**
 * Execute run-task command using RunTaskCommand
 * Requirements: 1.1, 1.2
 */
async function executeRunTask(parsed: ParsedArgs): Promise<CommandResult> {
  if (!parsed.specName) {
    return {
      success: false,
      command: 'run-task',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: '--spec is required for run-task command',
        details: { usage: 'npx sdd run-task --spec <name> --task <id> --status <status>' }
      }
    };
  }

  if (!parsed.taskId) {
    return {
      success: false,
      command: 'run-task',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: '--task is required for run-task command',
        details: { usage: 'npx sdd run-task --spec <name> --task <id> --status <status>' }
      }
    };
  }

  if (!parsed.status) {
    return {
      success: false,
      command: 'run-task',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: '--status is required for run-task command',
        details: { 
          usage: 'npx sdd run-task --spec <name> --task <id> --status <status>',
          validStatuses: TASK_STATUSES
        }
      }
    };
  }

  const runTaskFs = createRunTaskFileSystem();
  const tracker = new TaskTracker();
  const command = new RunTaskCommand(runTaskFs, tracker);

  return command.execute({
    spec: parsed.specName,
    taskId: parsed.taskId,
    status: parsed.status
  });
}

/**
 * Create file system implementation for VerifyCommand
 */
function createVerifyFileSystem(): NodeVerifyFileSystem {
  return new NodeVerifyFileSystem();
}

/**
 * Execute verify command using VerifyCommand
 * Requirements: 1.1, 1.5, 1.6, 1.7
 */
async function executeVerify(parsed: ParsedArgs): Promise<CommandResult> {
  if (!parsed.specName && !parsed.platform) {
    return {
      success: false,
      command: 'verify',
      error: {
        code: ErrorCode.MISSING_ARGUMENT,
        message: '--spec or --platform is required for verify command',
        details: { usage: 'npx sdd verify --spec <name> [--platform <platform>] [--skills s1,s2] [--json]' }
      }
    };
  }

  const verifyFs = createVerifyFileSystem();
  const command = new VerifyCommand(verifyFs);

  return command.execute({
    spec: parsed.specName,
    platform: parsed.platform,
    skills: parsed.skills,
    json: parsed.json,
  });
}

/**
 * Execute refine command using RefineCommand
 */
async function executeRefine(parsed: ParsedArgs): Promise<CommandResult> {
  const command = new RefineCommand();
  return command.execute({
    spec: parsed.specName ?? '',
    doc: parsed.doc ?? '',
    workspaceRoot: process.cwd()
  });
}

/**
 * Execute start-group command using StartGroupCommand
 */
async function executeStartGroup(parsed: ParsedArgs): Promise<CommandResult> {
  const command = new StartGroupCommand();
  return command.execute({
    spec: parsed.specName ?? '',
    group: parsed.group ?? '',
    workspaceRoot: process.cwd()
  });
}

/**
 * Run post-command verification based on the command that was executed.
 * Returns null if no verification is needed, or a failed CommandResult if verification fails.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
async function runPostVerification(
  commandName: string,
  result: CommandResult,
  parsed: ParsedArgs
): Promise<CommandResult | null> {
  const verifyFs = createVerifyFileSystem();
  const workspaceRoot = process.cwd();
  const allChecks: VerificationCheck[][] = [];
  const allWarnings: string[] = [];
  const start = Date.now();

  switch (commandName) {
    case 'create-spec': {
      // Req 2.1 — verify the created spec folder
      if (parsed.specName) {
        const sv = new SpecVerifier(verifyFs);
        const r = await sv.verify(parsed.specName, workspaceRoot);
        allChecks.push(r.checks);
        allWarnings.push(...r.warnings);
      }
      break;
    }
    case 'run-task': {
      // Req 2.2 — verify task status was updated
      if (parsed.specName && parsed.taskId && parsed.status) {
        const tv = new TaskVerifier(verifyFs);
        const checks = await tv.verifyTaskStatus(parsed.specName, parsed.taskId, parsed.status, workspaceRoot);
        allChecks.push(checks);
      }
      break;
    }
    case 'init': {
      // Req 2.3 — verify platform directory structure
      if (parsed.platform) {
        const pv = new PlatformVerifier(verifyFs);
        const checks = await pv.verify(parsed.platform, workspaceRoot);
        allChecks.push(checks);
      }
      break;
    }
    case 'install': {
      // Req 2.4 — verify skill files exist
      if (parsed.platform) {
        const skv = new SkillVerifier(verifyFs);
        const skillNames = parsed.skills ?? [];
        if (skillNames.length > 0) {
          const checks = await skv.verify(parsed.platform, skillNames, workspaceRoot);
          allChecks.push(checks);
        }
      }
      break;
    }
  }

  if (allChecks.length === 0) return null;

  const durationMs = Date.now() - start;
  const checks = mergeChecks(...allChecks);
  const data = buildVerificationData(checks, durationMs);

  if (data.passed) return null;

  // Req 2.5 — return failed result with verification errors
  return {
    success: false,
    command: result.command,
    error: {
      code: ErrorCode.VERIFICATION_FAILED,
      message: 'Command succeeded but verification failed',
      details: { verification: data as unknown as Record<string, unknown> }
    },
    ...(allWarnings.length > 0 ? { warnings: allWarnings } : {})
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  // Handle unknown commands with proper error + JSON support
  if (parsed.unknownCommand) {
    const result: CommandResult = {
      success: false,
      command: parsed.unknownCommand,
      error: {
        code: ErrorCode.UNKNOWN_COMMAND,
        message: `Unknown command: "${parsed.unknownCommand}"`,
        details: {
          validCommands: ['workspace-init', 'install-skills', 'create-spec', 'run-task', 'refine', 'start-group', 'verify', 'help', 'version']
        }
      }
    };
    outputAndExit(result, parsed.json);
  }

  // Handle help flag for any command
  if (parsed.help && parsed.command !== 'help') {
    if (parsed.json) {
      const result: CommandResult = {
        success: true,
        command: 'help',
        data: { help: HELP_TEXT }
      };
      outputAndExit(result, true);
    }
    console.log(HELP_TEXT);
    return;
  }

  let result: CommandResult;

  switch (parsed.command) {
    case 'help':
      if (parsed.json) {
        outputAndExit({ success: true, command: 'help', data: { help: HELP_TEXT } }, true);
      }
      console.log(HELP_TEXT);
      return;

    case 'version':
      if (parsed.json) {
        outputAndExit({ success: true, command: 'version', data: { version: VERSION } }, true);
      }
      console.log(`SDD Framework v${VERSION}`);
      return;

    case 'init':
      result = await executeWorkspaceInit(parsed);
      if (parsed.verify && result.success) {
        const verifyResult = await runPostVerification('init', result, parsed);
        if (verifyResult) result = verifyResult;
      }
      outputAndExit(result, parsed.json);
      break;

    case 'install':
      result = await executeInstallSkills(parsed);
      if (parsed.verify && result.success) {
        const verifyResult = await runPostVerification('install', result, parsed);
        if (verifyResult) result = verifyResult;
      }
      outputAndExit(result, parsed.json);
      break;

    case 'create-spec':
      result = await executeCreateSpec(parsed);
      if (parsed.verify && result.success) {
        const verifyResult = await runPostVerification('create-spec', result, parsed);
        if (verifyResult) result = verifyResult;
      }
      outputAndExit(result, parsed.json);
      break;

    case 'run-task':
      result = await executeRunTask(parsed);
      if (parsed.verify && result.success) {
        const verifyResult = await runPostVerification('run-task', result, parsed);
        if (verifyResult) result = verifyResult;
      }
      outputAndExit(result, parsed.json);
      break;

    case 'refine':
      result = await executeRefine(parsed);
      outputAndExit(result, parsed.json);
      break;

    case 'start-group':
      result = await executeStartGroup(parsed);
      outputAndExit(result, parsed.json);
      break;

    case 'verify':
      result = await executeVerify(parsed);
      outputAndExit(result, parsed.json);
      break;
  }
}

// Run CLI
main().catch(err => {
  const formatter = getFormatter(process.argv.includes('--json'));
  const result: CommandResult = {
    success: false,
    command: 'unknown',
    error: {
      code: ErrorCode.UNKNOWN_COMMAND,
      message: err instanceof Error ? err.message : String(err)
    }
  };
  console.error(formatter.format(result));
  process.exit(EXIT_CODES.INTERNAL_ERROR);
});
