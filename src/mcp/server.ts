/**
 * OpenSpec-Flow MCP Server
 * Exposes tools via Model Context Protocol (stdio transport)
 */

import { listChanges, loadChange, resolveChangeId } from '../utils/openspec.js';
import { generateWorkBrief, saveWorkBrief } from '../utils/workbriefGenerator.js';
import { loadConfig, configExists } from '../utils/configLoader.js';
import { analyzeChange, slugify } from '../utils/analyzer.js';
import { splitChange } from '../utils/splitter.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { PhaseDefinition, ArchiveReason, ArchiveMetadata, ArchiveResult, ChangeIdResolution } from '../types.js';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

const TOOLS = [
  {
    name: 'get_proposal_workflow',
    description: 'Get the OpenSpec proposal workflow instructions. Reads from .claude/commands/openspec/proposal.md if it exists, providing the canonical workflow for creating OpenSpec changes.',
    inputSchema: {
      type: 'object',
      properties: {
        custom_path: {
          type: 'string',
          description: 'Optional custom path to the proposal workflow file. Defaults to .claude/commands/openspec/proposal.md',
        },
      },
      required: [],
    },
  },
  {
    name: 'resolve_change_id',
    description: 'Resolve a partial change ID to the full ID. Returns exact match, resolved match, ambiguous matches, or not found with suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        partial_id: {
          type: 'string',
          description: 'Full or partial change ID to resolve',
        },
      },
      required: ['partial_id'],
    },
  },
  {
    name: 'list_changes',
    description: 'List all OpenSpec changes with their status and task completion',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'generate_work_brief',
    description: 'Generate a comprehensive work brief for an OpenSpec change',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID',
        },
      },
      required: ['change_id'],
    },
  },
  {
    name: 'get_change_context',
    description: 'Get context for an OpenSpec change: file paths, summary, and config. Agents should Read files as needed.',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID',
        },
      },
      required: ['change_id'],
    },
  },
  {
    name: 'analyze_deferred',
    description: 'Analyze incomplete tasks for an OpenSpec change and generate a deferred items report',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID',
        },
      },
      required: ['change_id'],
    },
  },
  {
    name: 'create_flow_log',
    description: 'Create an implementation flow log for an OpenSpec change',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID',
        },
        status: {
          type: 'string',
          enum: ['complete', 'incomplete', 'failed'],
          description: 'Implementation status',
        },
        summary: {
          type: 'string',
          description: 'Implementation summary',
        },
        files_modified: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files modified during implementation',
        },
      },
      required: ['change_id'],
    },
  },
  {
    name: 'scaffold_change',
    description: 'Create a new OpenSpec change directory structure with initialized files',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Human-readable title for the change (used to generate ID)',
        },
        description: {
          type: 'string',
          description: 'Brief one-line description of the change',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'save_change_artifact',
    description: 'Save or update an artifact file for an OpenSpec change',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID',
        },
        artifact_type: {
          type: 'string',
          enum: ['proposal', 'tasks', 'design', 'spec'],
          description: 'Type of artifact to save',
        },
        content: {
          type: 'string',
          description: 'Full markdown content of the artifact',
        },
        spec_path: {
          type: 'string',
          description: 'For spec artifacts, the relative path under specs/ (e.g., "api/auth/spec.md")',
        },
      },
      required: ['change_id', 'artifact_type', 'content'],
    },
  },
  {
    name: 'analyze_change',
    description: 'Analyze an OpenSpec change for size, complexity, and splitting recommendation',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID',
        },
      },
      required: ['change_id'],
    },
  },
  {
    name: 'split_change',
    description: 'Split a large OpenSpec change into phased sub-changes',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID to split',
        },
        phases: {
          type: 'array',
          description: 'Phase definitions for the split',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Phase description',
              },
              task_indices: {
                type: 'array',
                items: { type: 'number' },
                description: 'Task indices (1-based) to include in this phase',
              },
            },
            required: ['description', 'task_indices'],
          },
        },
      },
      required: ['change_id', 'phases'],
    },
  },
  {
    name: 'archive_change',
    description: 'Archive a completed or closed OpenSpec change using the OpenSpec CLI. Requires openspec CLI to be installed.',
    inputSchema: {
      type: 'object',
      properties: {
        change_id: {
          type: 'string',
          description: 'The OpenSpec change ID to archive',
        },
        reason: {
          type: 'string',
          enum: ['completed', 'deferred', 'superseded', 'abandoned'],
          description: 'Reason for archiving: completed (all done), deferred (some tasks remain), superseded (replaced by another), abandoned (no longer needed)',
        },
        skip_specs: {
          type: 'boolean',
          description: 'Skip merging spec updates (for tooling-only changes)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or context for the archive',
        },
      },
      required: ['change_id', 'reason'],
    },
  },
];

const OPENSPEC_ROOT = 'openspec';
const CHANGES_DIR = join(OPENSPEC_ROOT, 'changes');

// Helper type for handlers that return ambiguous results
interface AmbiguousResponse {
  status: 'ambiguous';
  inputId: string;
  matches: string[];
  message: string;
}

/**
 * Check if a command exists in PATH
 */
function checkCommandExists(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to handle change ID resolution for handlers.
 * Returns the resolved ID, or throws for not_found, or returns ambiguous response.
 */
function resolveOrThrow(partialId: string): string | AmbiguousResponse {
  const resolution = resolveChangeId(partialId);

  switch (resolution.status) {
    case 'exact':
    case 'resolved':
      return resolution.changeId!;

    case 'ambiguous':
      return {
        status: 'ambiguous',
        inputId: partialId,
        matches: resolution.matches!,
        message: `Multiple changes match "${partialId}". Please specify which one.`,
      };

    case 'not_found':
      const msg = `Change not found: ${partialId}`;
      if (resolution.suggestions && resolution.suggestions.length > 0) {
        throw new Error(
          msg + `\n\nSimilar changes:\n` + resolution.suggestions.map((s) => `  - ${s}`).join('\n')
        );
      }
      throw new Error(msg);
  }
}

// Tool handlers
async function handleGetProposalWorkflow(params: { custom_path?: string }): Promise<unknown> {
  const defaultPaths = [
    '.claude/commands/openspec/proposal.md',
    'commands/openspec/proposal.md',
    '.claude/commands/proposal.md',
  ];

  const searchPaths = params.custom_path ? [params.custom_path, ...defaultPaths] : defaultPaths;

  for (const path of searchPaths) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');

      // Extract the workflow content (between OPENSPEC:START and OPENSPEC:END if present)
      const openspecMatch = content.match(/<!-- OPENSPEC:START -->([\s\S]*?)<!-- OPENSPEC:END -->/);
      const workflowContent = openspecMatch ? openspecMatch[1].trim() : content;

      return {
        found: true,
        path,
        workflow: workflowContent,
        instructions: 'Follow these OpenSpec proposal workflow steps. After completing, run `openspec validate <id> --strict` to validate.',
      };
    }
  }

  // No workflow file found - return embedded default workflow
  return {
    found: false,
    searchedPaths: searchPaths,
    workflow: `**Guardrails**
- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Identify any vague or ambiguous details and ask the necessary follow-up questions before editing files.

**Steps**
1. Review project context, run \`openspec list\` and \`openspec list --specs\`, and inspect related code or docs to ground the proposal in current behaviour.
2. Choose a unique verb-led \`change-id\` and scaffold \`proposal.md\`, \`tasks.md\`, and \`design.md\` (when needed) under \`openspec/changes/<id>/\`.
3. Map the change into concrete capabilities or requirements, breaking multi-scope efforts into distinct spec deltas.
4. Capture architectural reasoning in \`design.md\` when the solution spans multiple systems or introduces new patterns.
5. Draft spec deltas in \`changes/<id>/specs/<capability>/spec.md\` using \`## ADDED|MODIFIED|REMOVED Requirements\` with at least one \`#### Scenario:\` per requirement.
6. Draft \`tasks.md\` as an ordered list of small, verifiable work items.
7. Validate with \`openspec validate <id> --strict\` and resolve every issue before sharing the proposal.

**Reference**
- Use \`openspec show <id> --json --deltas-only\` or \`openspec show <spec> --type spec\` to inspect details when validation fails.
- Search existing requirements with \`rg -n "Requirement:|Scenario:" openspec/specs\` before writing new ones.`,
    instructions: 'No project-specific workflow found. Using default OpenSpec workflow. After completing, run `openspec validate <id> --strict` to validate.',
  };
}

async function handleResolveChangeId(params: { partial_id: string }): Promise<ChangeIdResolution> {
  return resolveChangeId(params.partial_id);
}

async function handleListChanges(): Promise<unknown> {
  const changes = listChanges();
  return {
    changes: changes.map((c) => ({
      changeId: c.changeId,
      title: c.title,
      status: c.status,
      tasksCompleted: c.tasksCompleted,
      tasksTotal: c.tasksTotal,
      path: c.path,
    })),
  };
}

async function handleGenerateWorkBrief(params: { change_id: string }): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const change = loadChange(resolved);
  const workBriefContent = generateWorkBrief(change);
  const outputPath = saveWorkBrief(change, workBriefContent);

  return {
    success: true,
    path: outputPath,
    changeId: resolved,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
  };
}

async function handleGetChangeContext(params: { change_id: string }): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const change = loadChange(resolved);

  // Build file paths
  const proposalPath = join(change.path, 'proposal.md');
  const tasksPath = join(change.path, 'tasks.md');
  const designPath = join(change.path, 'design.md');
  const workBriefPath = join(change.path, 'work-brief.md');

  // Parse tasks to get summary counts
  let taskCount = 0;
  let tasksComplete = 0;
  if (change.tasks) {
    const lines = change.tasks.split('\n');
    lines.forEach((line) => {
      if (line.match(/^\s*-\s*\[x\]/i)) {
        taskCount++;
        tasksComplete++;
      } else if (line.match(/^\s*-\s*\[\s*\]/i)) {
        taskCount++;
      }
    });
  }

  // Extract title from proposal (first H1)
  let title = resolved;
  if (change.proposal) {
    const titleMatch = change.proposal.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }
  }

  // Load config if exists (config is small, always include)
  let config = null;
  if (configExists()) {
    config = loadConfig();
  }

  return {
    changeId: resolved,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
    title,
    paths: {
      root: change.path,
      proposal: existsSync(proposalPath) ? proposalPath : null,
      tasks: existsSync(tasksPath) ? tasksPath : null,
      design: existsSync(designPath) ? designPath : null,
      workBrief: existsSync(workBriefPath) ? workBriefPath : null,
      specs: change.specs.length > 0 ? change.specs : null,
    },
    summary: {
      taskCount,
      tasksComplete,
      percentComplete: taskCount > 0 ? Math.round((tasksComplete / taskCount) * 100) : 0,
      hasWorkBrief: existsSync(workBriefPath),
      hasDesign: existsSync(designPath),
      specCount: change.specs.length,
    },
    config: config
      ? {
          project: config.project,
          tech: config.tech,
          patterns: config.patterns,
          constraints: config.constraints,
        }
      : null,
    instructions: 'Use the Read tool to load file contents as needed. Start with the work brief for implementation tasks.',
  };
}

async function handleAnalyzeDeferred(params: { change_id: string }): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const change = loadChange(resolved);

  if (!change.tasks) {
    throw new Error(`No tasks.md found for change: ${resolved}`);
  }

  const lines = change.tasks.split('\n');
  const tasks: Array<{ description: string; completed: boolean; line: number }> = [];

  lines.forEach((line, index) => {
    const completedMatch = line.match(/^\s*-\s*\[x\]\s*(.+)/i);
    const incompleteMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)/i);

    if (completedMatch) {
      tasks.push({ description: completedMatch[1], completed: true, line: index + 1 });
    } else if (incompleteMatch) {
      tasks.push({ description: incompleteMatch[1], completed: false, line: index + 1 });
    }
  });

  const completed = tasks.filter((t) => t.completed);
  const incomplete = tasks.filter((t) => !t.completed);

  return {
    changeId: resolved,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
    summary: {
      total: tasks.length,
      completed: completed.length,
      incomplete: incomplete.length,
      percentComplete: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0,
    },
    deferred: incomplete.map((t) => ({
      description: t.description,
      line: t.line,
    })),
  };
}

async function handleCreateFlowLog(params: {
  change_id: string;
  status?: string;
  summary?: string;
  files_modified?: string[];
}): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const change = loadChange(resolved);

  const timestamp = new Date().toISOString();
  const status = params.status || 'complete';
  const summary = params.summary || 'Implementation completed';
  const filesModified = params.files_modified || [];

  const flowLog = `# Flow Log: ${resolved}

**Generated**: ${timestamp}
**Status**: ${status.charAt(0).toUpperCase() + status.slice(1)}

## Summary

${summary}

## Files Modified

${filesModified.length > 0 ? filesModified.map((f) => `- ${f}`).join('\n') : '- None recorded'}

## Artifacts

- Work Brief: ${change.path}/work-brief.md
- Proposal: ${change.path}/proposal.md
- Tasks: ${change.path}/tasks.md
`;

  const flowLogPath = join(change.path, 'flow-log.md');
  writeFileSync(flowLogPath, flowLog, 'utf-8');

  return {
    success: true,
    path: flowLogPath,
    changeId: resolved,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
  };
}

async function handleScaffoldChange(params: { title: string; description?: string }): Promise<unknown> {
  // Generate change ID from title
  const slug = slugify(params.title);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let changeId = `${slug}-${date}`;

  // Handle collisions
  let counter = 0;
  while (existsSync(join(CHANGES_DIR, changeId))) {
    counter++;
    changeId = `${slug}-${date}-${counter}`;
  }

  // Create directory structure
  const changePath = join(CHANGES_DIR, changeId);
  mkdirSync(changePath, { recursive: true });

  // Create placeholder files
  const proposalContent = `# ${params.title}

${params.description ? `> ${params.description}` : ''}

## Why

<!-- Motivation and business/technical justification -->

## What Changes

<!-- High-level description of the change -->

## Impact

<!-- Affected components, dependencies, breaking changes -->

## Acceptance Criteria

- [ ] <!-- criterion 1 -->
- [ ] <!-- criterion 2 -->

---
*Generated by /ideate on ${new Date().toISOString()}*
`;

  const tasksContent = `# Tasks: ${params.title}

## Setup

- [ ] <!-- setup task -->

## Implementation

- [ ] <!-- implementation task -->

## Testing

- [ ] <!-- test task -->

## Documentation

- [ ] <!-- documentation task -->

---
*Generated by /ideate on ${new Date().toISOString()}*
`;

  writeFileSync(join(changePath, 'proposal.md'), proposalContent, 'utf-8');
  writeFileSync(join(changePath, 'tasks.md'), tasksContent, 'utf-8');

  return {
    success: true,
    changeId,
    path: changePath,
    files: ['proposal.md', 'tasks.md'],
  };
}

async function handleSaveChangeArtifact(params: {
  change_id: string;
  artifact_type: 'proposal' | 'tasks' | 'design' | 'spec';
  content: string;
  spec_path?: string;
}): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const changePath = join(CHANGES_DIR, resolved);

  if (!existsSync(changePath)) {
    throw new Error(`Change not found: ${resolved}`);
  }

  let filePath: string;

  if (params.artifact_type === 'spec') {
    if (!params.spec_path) {
      throw new Error('spec_path required for spec artifacts');
    }
    filePath = join(changePath, 'specs', params.spec_path);
    mkdirSync(dirname(filePath), { recursive: true });
  } else {
    filePath = join(changePath, `${params.artifact_type}.md`);
  }

  writeFileSync(filePath, params.content, 'utf-8');

  return {
    success: true,
    changeId: resolved,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
    artifactType: params.artifact_type,
    path: filePath,
  };
}

async function handleAnalyzeChange(params: { change_id: string }): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const result = analyzeChange(resolved);
  return {
    ...result,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
  };
}

async function handleSplitChange(params: {
  change_id: string;
  phases: Array<{ description: string; task_indices: number[] }>;
}): Promise<unknown> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  // Convert API format to internal format
  const phases: PhaseDefinition[] = params.phases.map((p) => ({
    description: p.description,
    taskIndices: p.task_indices,
  }));

  const result = splitChange(resolved, phases);
  return {
    ...result,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
  };
}

async function handleArchiveChange(params: {
  change_id: string;
  reason: ArchiveReason;
  skip_specs?: boolean;
  notes?: string;
}): Promise<(ArchiveResult & { resolvedChangeId: string; wasResolved: boolean }) | AmbiguousResponse> {
  const resolved = resolveOrThrow(params.change_id);
  if (typeof resolved !== 'string') return resolved; // Ambiguous

  const { reason, skip_specs, notes } = params;

  // 1. Verify change exists
  const changePath = join(CHANGES_DIR, resolved);
  if (!existsSync(changePath)) {
    throw new Error(`Change not found: ${resolved}`);
  }

  // 2. Require OpenSpec CLI
  if (!checkCommandExists('openspec')) {
    throw new Error(
      'OpenSpec CLI required for archiving.\n' +
        'Install: npm install -g @anthropic/openspec'
    );
  }

  // 3. Build CLI args and call openspec archive
  const args = ['archive', resolved, '--yes'];
  if (skip_specs) {
    args.push('--skip-specs');
  }

  try {
    execSync(`openspec ${args.join(' ')}`, {
      stdio: 'pipe',
      cwd: process.cwd(),
    });
  } catch (error) {
    const execError = error as { stderr?: Buffer; message?: string };
    const stderr = execError.stderr?.toString() || execError.message || String(error);
    throw new Error(`OpenSpec archive failed: ${stderr}`);
  }

  // 4. Find the archived path (CLI uses YYYY-MM-DD-{id} format)
  const archiveDir = join(CHANGES_DIR, 'archive');
  const datePrefix = new Date().toISOString().slice(0, 10);
  let archivePath = join(archiveDir, `${datePrefix}-${resolved}`);

  // If exact date match not found, search for any matching archive
  if (!existsSync(archivePath)) {
    const entries = existsSync(archiveDir) ? readdirSync(archiveDir) : [];
    const match = entries.find((e) => e.endsWith(`-${resolved}`));
    if (match) {
      archivePath = join(archiveDir, match);
    }
  }

  // 5. Load change info for summary (from archived path now)
  const archivedAt = new Date().toISOString();
  const tasks: Array<{ description: string; completed: boolean }> = [];

  const archivedTasksPath = join(archivePath, 'tasks.md');
  if (existsSync(archivedTasksPath)) {
    const tasksContent = readFileSync(archivedTasksPath, 'utf-8');
    const lines = tasksContent.split('\n');
    lines.forEach((line) => {
      const completedMatch = line.match(/^\s*-\s*\[x\]\s*(.+)/i);
      const incompleteMatch = line.match(/^\s*-\s*\[\s*\]\s*(.+)/i);

      if (completedMatch) {
        tasks.push({ description: completedMatch[1], completed: true });
      } else if (incompleteMatch) {
        tasks.push({ description: incompleteMatch[1], completed: false });
      }
    });
  }

  const completed = tasks.filter((t) => t.completed);
  const incomplete = tasks.filter((t) => !t.completed);

  // 6. Create openspec-flow metadata (on top of what CLI created)
  const metadata: ArchiveMetadata = {
    archivedAt,
    reason,
    originalPath: changePath,
    archivedBy: 'openspec-flow',
    summary: {
      tasksTotal: tasks.length,
      tasksCompleted: completed.length,
      deferredCount: incomplete.length,
    },
  };

  if (incomplete.length > 0) {
    metadata.deferredItems = incomplete.map((t) => ({
      description: t.description,
    }));
  }

  if (notes) {
    metadata.notes = notes;
  }

  // 7. Write our metadata file as YAML
  const metadataYaml = `# openspec-flow archive metadata
archived_at: "${metadata.archivedAt}"
reason: ${metadata.reason}
original_path: ${metadata.originalPath}
archived_by: ${metadata.archivedBy}

summary:
  tasks_total: ${metadata.summary.tasksTotal}
  tasks_completed: ${metadata.summary.tasksCompleted}
  deferred_count: ${metadata.summary.deferredCount}
${metadata.deferredItems && metadata.deferredItems.length > 0 ? `
deferred_items:
${metadata.deferredItems.map((item) => `  - description: "${item.description.replace(/"/g, '\\"')}"`).join('\n')}
` : ''}${metadata.notes ? `
notes: |
  ${metadata.notes.split('\n').join('\n  ')}
` : ''}`;

  writeFileSync(join(archivePath, 'archive-metadata.yaml'), metadataYaml, 'utf-8');

  // 8. Return result
  return {
    success: true,
    changeId: resolved,
    resolvedChangeId: resolved,
    wasResolved: resolved !== params.change_id,
    originalPath: changePath,
    archivePath,
    reason,
    archivedAt,
    summary: metadata.summary,
    metadata,
  };
}

function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_proposal_workflow':
      return handleGetProposalWorkflow(args as { custom_path?: string });
    case 'resolve_change_id':
      return handleResolveChangeId(args as { partial_id: string });
    case 'list_changes':
      return handleListChanges();
    case 'generate_work_brief':
      return handleGenerateWorkBrief(args as { change_id: string });
    case 'get_change_context':
      return handleGetChangeContext(args as { change_id: string });
    case 'analyze_deferred':
      return handleAnalyzeDeferred(args as { change_id: string });
    case 'create_flow_log':
      return handleCreateFlowLog(args as {
        change_id: string;
        status?: string;
        summary?: string;
        files_modified?: string[];
      });
    case 'scaffold_change':
      return handleScaffoldChange(args as { title: string; description?: string });
    case 'save_change_artifact':
      return handleSaveChangeArtifact(args as {
        change_id: string;
        artifact_type: 'proposal' | 'tasks' | 'design' | 'spec';
        content: string;
        spec_path?: string;
      });
    case 'analyze_change':
      return handleAnalyzeChange(args as { change_id: string });
    case 'split_change':
      return handleSplitChange(args as {
        change_id: string;
        phases: Array<{ description: string; task_indices: number[] }>;
      });
    case 'archive_change':
      return handleArchiveChange(args as {
        change_id: string;
        reason: ArchiveReason;
        skip_specs?: boolean;
        notes?: string;
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'openspec-flow',
              version: '0.2.8-alpha',
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS },
        };

      case 'tools/call':
        const toolParams = params as { name: string; arguments?: Record<string, unknown> };
        const result = await handleToolCall(toolParams.name, toolParams.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function startMCPServer(): Promise<void> {
  const readline = await import('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const sendResponse = (response: MCPResponse) => {
    process.stdout.write(JSON.stringify(response) + '\n');
  };

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await handleRequest(request);
      sendResponse(response);
    } catch {
      sendResponse({
        jsonrpc: '2.0',
        id: null as unknown as number,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      });
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
