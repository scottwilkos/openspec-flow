/**
 * OpenSpec file system utilities
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import { OpenSpecChange, ChangeListItem, TaskItem } from '../types.js';

const OPENSPEC_ROOT = 'openspec';
const CHANGES_DIR = join(OPENSPEC_ROOT, 'changes');

/**
 * List all OpenSpec changes
 */
export function listChanges(): ChangeListItem[] {
  if (!existsSync(CHANGES_DIR)) {
    return [];
  }

  const entries = readdirSync(CHANGES_DIR, { withFileTypes: true });
  const changes: ChangeListItem[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'archive') {
      continue;
    }

    const changePath = join(CHANGES_DIR, entry.name);
    const changeId = entry.name;

    try {
      const item = analyzeChange(changeId, changePath);
      changes.push(item);
    } catch (error) {
      console.warn(`Warning: Could not analyze change ${changeId}:`, error);
    }
  }

  return changes;
}

/**
 * Analyze a single change directory
 */
function analyzeChange(changeId: string, changePath: string): ChangeListItem {
  const proposalPath = join(changePath, 'proposal.md');
  const tasksPath = join(changePath, 'tasks.md');

  // Extract title from proposal or tasks
  let title = changeId;
  if (existsSync(proposalPath)) {
    const proposal = readFileSync(proposalPath, 'utf-8');
    const firstHeading = proposal.match(/^#\s+(.+)$/m);
    if (firstHeading) {
      title = firstHeading[1].trim();
    }
  }

  // Analyze tasks
  let tasksTotal = 0;
  let tasksCompleted = 0;
  let status: ChangeListItem['status'] = 'unknown';

  if (existsSync(tasksPath)) {
    const tasks = readFileSync(tasksPath, 'utf-8');
    const taskLines = tasks.match(/^-\s+\[[ x]\]/gm) || [];
    tasksTotal = taskLines.length;
    tasksCompleted = taskLines.filter(line => line.includes('[x]')).length;

    if (tasksTotal > 0) {
      if (tasksCompleted === 0) {
        status = 'todo';
      } else if (tasksCompleted === tasksTotal) {
        status = 'done';
      } else {
        status = 'in-progress';
      }
    }
  }

  return {
    changeId,
    title,
    status,
    tasksTotal,
    tasksCompleted,
    path: changePath,
  };
}

/**
 * Load a specific change
 */
export function loadChange(changeId: string): OpenSpecChange {
  const changePath = join(CHANGES_DIR, changeId);

  if (!existsSync(changePath) || !statSync(changePath).isDirectory()) {
    throw new Error(`Change not found: ${changeId}`);
  }

  const proposalPath = join(changePath, 'proposal.md');
  const tasksPath = join(changePath, 'tasks.md');
  const designPath = join(changePath, 'design.md');

  const change: OpenSpecChange = {
    changeId,
    path: changePath,
    specs: [],
  };

  if (existsSync(proposalPath)) {
    change.proposal = readFileSync(proposalPath, 'utf-8');
  }

  if (existsSync(tasksPath)) {
    change.tasks = readFileSync(tasksPath, 'utf-8');
  }

  if (existsSync(designPath)) {
    change.design = readFileSync(designPath, 'utf-8');
  }

  // Find spec deltas
  const specsDir = join(changePath, 'specs');
  if (existsSync(specsDir)) {
    change.specs = findSpecFiles(specsDir);
  }

  return change;
}

/**
 * Recursively find spec.md files
 */
function findSpecFiles(dir: string): string[] {
  const specs: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      specs.push(...findSpecFiles(fullPath));
    } else if (entry.name === 'spec.md') {
      specs.push(fullPath);
    }
  }

  return specs;
}

/**
 * Parse tasks from tasks.md content
 */
export function parseTasks(tasksContent: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  const lines = tasksContent.split('\n');
  let taskCounter = 0;

  for (const line of lines) {
    const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
    if (taskMatch) {
      taskCounter++;
      tasks.push({
        id: `task-${taskCounter}`,
        description: taskMatch[2].trim(),
        completed: taskMatch[1] === 'x',
      });
    }
  }

  return tasks;
}

/**
 * Load project context
 */
export function loadProjectContext(): string {
  const contextPath = join('docs', 'project-context.md');
  if (!existsSync(contextPath)) {
    throw new Error('project-context.md not found');
  }
  return readFileSync(contextPath, 'utf-8');
}

/**
 * Load CLAUDE.md
 */
export function loadClaudeMd(): string {
  const claudePath = 'CLAUDE.md';
  if (!existsSync(claudePath)) {
    throw new Error('CLAUDE.md not found');
  }
  return readFileSync(claudePath, 'utf-8');
}
