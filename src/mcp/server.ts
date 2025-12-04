/**
 * OpenSpec-Flow MCP Server
 * Exposes tools via Model Context Protocol (stdio transport)
 */

import { listChanges, loadChange } from '../utils/openspec.js';
import { generateWorkBrief, saveWorkBrief } from '../utils/workbriefGenerator.js';
import { loadConfig, configExists } from '../utils/configLoader.js';
import { analyzeChange, slugify } from '../utils/analyzer.js';
import { splitChange } from '../utils/splitter.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { PhaseDefinition } from '../types.js';

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
];

const OPENSPEC_ROOT = 'openspec';
const CHANGES_DIR = join(OPENSPEC_ROOT, 'changes');

// Tool handlers
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
  const change = loadChange(params.change_id);
  const workBriefContent = generateWorkBrief(change);
  const outputPath = saveWorkBrief(change, workBriefContent);

  return {
    success: true,
    path: outputPath,
    changeId: params.change_id,
  };
}

async function handleGetChangeContext(params: { change_id: string }): Promise<unknown> {
  const change = loadChange(params.change_id);

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
  let title = params.change_id;
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
    changeId: params.change_id,
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
  const change = loadChange(params.change_id);

  if (!change.tasks) {
    throw new Error(`No tasks.md found for change: ${params.change_id}`);
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
    changeId: params.change_id,
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
  const change = loadChange(params.change_id);

  const timestamp = new Date().toISOString();
  const status = params.status || 'complete';
  const summary = params.summary || 'Implementation completed';
  const filesModified = params.files_modified || [];

  const flowLog = `# Flow Log: ${params.change_id}

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
    changeId: params.change_id,
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
  const changePath = join(CHANGES_DIR, params.change_id);

  if (!existsSync(changePath)) {
    throw new Error(`Change not found: ${params.change_id}`);
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
    changeId: params.change_id,
    artifactType: params.artifact_type,
    path: filePath,
  };
}

async function handleAnalyzeChange(params: { change_id: string }): Promise<unknown> {
  return analyzeChange(params.change_id);
}

async function handleSplitChange(params: {
  change_id: string;
  phases: Array<{ description: string; task_indices: number[] }>;
}): Promise<unknown> {
  // Convert API format to internal format
  const phases: PhaseDefinition[] = params.phases.map((p) => ({
    description: p.description,
    taskIndices: p.task_indices,
  }));

  return splitChange(params.change_id, phases);
}

function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
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
              version: '0.2.0',
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
