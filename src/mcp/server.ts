/**
 * OpenSpec-Flow MCP Server
 * Exposes tools via Model Context Protocol (stdio transport)
 */

import { listChanges, loadChange } from '../utils/openspec.js';
import { generateWorkBrief, saveWorkBrief } from '../utils/workbriefGenerator.js';
import { loadConfig, configExists } from '../utils/configLoader.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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
];

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
