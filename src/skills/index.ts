/**
 * Canonical Skill Definitions
 * 
 * This module exports all canonical skill definitions for the
 * Context Engineering Framework.
 */

export { workspaceInitSkill } from './workspace-init.js';
export { createSpecSkill } from './create-spec.js';
export { runTaskSkill } from './run-task.js';
export { installSkillsSkill } from './install-skills.js';
export { refineSpecSkill } from './refine-spec.js';
export { startTaskGroupSkill } from './start-task-group.js';
export { analyzeTaskFailureSkill } from './analyze-task-failure.js';

import { workspaceInitSkill } from './workspace-init.js';
import { createSpecSkill } from './create-spec.js';
import { runTaskSkill } from './run-task.js';
import { installSkillsSkill } from './install-skills.js';
import { refineSpecSkill } from './refine-spec.js';
import { startTaskGroupSkill } from './start-task-group.js';
import { analyzeTaskFailureSkill } from './analyze-task-failure.js';
import { CanonicalSkill } from '../types.js';

/**
 * All canonical skills available in the framework
 */
export const allSkills: CanonicalSkill[] = [
  workspaceInitSkill,
  createSpecSkill,
  runTaskSkill,
  installSkillsSkill,
  refineSpecSkill,
  startTaskGroupSkill,
  analyzeTaskFailureSkill
];

/**
 * Get a skill by name
 */
export function getSkillByName(name: string): CanonicalSkill | undefined {
  return allSkills.find(skill => skill.name === name);
}
