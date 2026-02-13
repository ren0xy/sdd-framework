/**
 * SDD Framework (Spec-Driven Development)
 * 
 * A portable abstraction layer that enables project initialization and
 * workspace management across multiple AI coding agent platforms
 * (Kiro, Claude Code, Codex, Antigravity, Amazon Q).
 * 
 * @packageDocumentation
 */

// Core types
export type {
  PlatformId,
  TaskStatus,
  SkillParameter,
  SkillMetadata,
  CanonicalSkill,
  SingleFileSkill,
  DirectorySkill,
  PlatformSkill,
  SpecConfig,
  SpecDocument,
  Task,
  TasksDocument,
  Spec,
  SpecMetadata,
  SpecLocation,
  ValidationError,
  ValidationWarning,
  ValidationResult,
  TaskUpdate,
  TransformResult,
  SkillInstallResult
} from './types.js';

// Type guards
export { isDirectorySkill, isSingleFileSkill } from './types.js';

// Platform Adapters
export type { PlatformAdapter } from './adapters/index.js';
export {
  KiroAdapter,
  ClaudeCodeAdapter,
  CodexAdapter,
  AntigravityAdapter,
  AmazonQAdapter
} from './adapters/index.js';

// Skill Registry
export { SkillRegistry } from './registry/index.js';
export type { FileSystem } from './registry/index.js';

// Skill Transformer
export { SkillTransformer } from './transformer/index.js';
export type { CreateSpecResult, FileSystemOperations } from './transformer/index.js';

// Workspace Adapter
export { WorkspaceAdapter, validateSpecConfig, validateSpecFolder, validateAllSpecs } from './workspace/index.js';
export type { WorkspaceFileSystem, SpecConfigSchema, SpecFolderSchema, ValidationFileSystem } from './workspace/index.js';

// Task Tracker
export { TaskTracker } from './tasks/index.js';
export { TaskGroupResolver } from './tasks/index.js';
export type { TaskGroup, TaskSubgroup, ParsedTask, TaskGroupStatus, RequirementsValidation } from './tasks/index.js';

// Document Generators
export { TasksGenerator } from './documents/index.js';
export type { TaskInput, TasksGeneratorOptions } from './documents/index.js';

// Canonical Skills
export {
  workspaceInitSkill,
  createSpecSkill,
  runTaskSkill,
  installSkillsSkill,
  refineSpecSkill,
  startTaskGroupSkill,
  allSkills,
  getSkillByName
} from './skills/index.js';

// Instruction Composer
export {
  composeSkillInstruction,
  registerInstructionTemplate,
  getInstructionTemplates
} from './instructions/index.js';
export type { InstructionTemplate } from './instructions/index.js';

// Commands (for extension consumption)
export { CreateSpecCommand } from './commands/create-spec-command.js';
export type { CreateSpecFileSystem, CreateSpecOptions } from './commands/create-spec-command.js';
export type { CreateSpecResult as CreateSpecCommandResult } from './commands/create-spec-command.js';

export { StartGroupCommand } from './commands/start-group-command.js';
export type { StartGroupOptions, StartGroupResult } from './commands/start-group-command.js';

