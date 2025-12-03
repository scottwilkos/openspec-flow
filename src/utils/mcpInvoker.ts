/**
 * MCP Invoker - Generates Claude Code Task prompts for real MCP execution
 *
 * This module generates prompts that Claude Code can execute using the Task tool,
 * which will in turn use the real claude-flow MCP tools.
 */

import { join } from 'path';
import { writeFileSync } from 'fs';

// ============================================================================
// Types
// ============================================================================

export interface PhaseDefinition {
  name: string;
  description: string;
  agentType: 'researcher' | 'architect' | 'coder' | 'reviewer' | 'documenter';
  systemPromptPath?: string;
  inputs: Record<string, string>;
  outputs: string[];
  dependsOn?: string[];
}

export interface FlowExecutionPrompt {
  flowName: string;
  changeId: string;
  phases: PhaseDefinition[];
  contextFiles: string[];
  swarmTopology: 'hierarchical' | 'mesh' | 'ring' | 'star';
  fullPrompt: string;
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Generate a complete Task tool prompt for Claude Code execution
 */
export function generateFlowExecutionPrompt(
  changeId: string,
  workBriefPath: string,
  flowDefinitionPath: string
): FlowExecutionPrompt {
  const prompt = buildRealMCPPrompt(changeId, workBriefPath, flowDefinitionPath);

  return {
    flowName: 'openspec-implementation',
    changeId,
    phases: [
      {
        name: 'context-loader',
        description: 'Load all context documents into shared memory',
        agentType: 'researcher',
        systemPromptPath: '.claude/prompts/openspec-flow/context-loader.md',
        inputs: { work_brief: workBriefPath, claude_md: 'CLAUDE.md' },
        outputs: ['context_summary', 'key_requirements', 'tech_stack'],
      },
      {
        name: 'planner',
        description: 'Create detailed implementation plan',
        agentType: 'architect',
        systemPromptPath: '.claude/prompts/openspec-flow/planner.md',
        inputs: { change_id: changeId },
        outputs: ['implementation_plan', 'files_to_create', 'files_to_modify'],
        dependsOn: ['context-loader'],
      },
      {
        name: 'implementer',
        description: 'Execute implementation plan',
        agentType: 'coder',
        systemPromptPath: '.claude/prompts/openspec-flow/implementer.md',
        inputs: { change_id: changeId },
        outputs: ['files_modified', 'migrations_created', 'tests_written'],
        dependsOn: ['planner'],
      },
      {
        name: 'reviewer',
        description: 'Review implementation against spec',
        agentType: 'reviewer',
        systemPromptPath: '.claude/prompts/openspec-flow/reviewer.md',
        inputs: { work_brief: workBriefPath },
        outputs: ['review_passed', 'issues_found', 'recommendations'],
        dependsOn: ['implementer'],
      },
      {
        name: 'summarizer',
        description: 'Generate flow log and documentation',
        agentType: 'documenter',
        systemPromptPath: '.claude/prompts/openspec-flow/summarizer.md',
        inputs: { change_id: changeId },
        outputs: ['flow_log_path', 'summary'],
        dependsOn: ['reviewer'],
      },
    ],
    contextFiles: [
      workBriefPath,
      'CLAUDE.md',
      'docs/project-context.md',
      `openspec-flow/changes/${changeId}/proposal.md`,
      `openspec-flow/changes/${changeId}/tasks.md`,
    ],
    swarmTopology: 'hierarchical',
    fullPrompt: prompt,
  };
}

/**
 * Build the actual prompt that uses real MCP tools
 */
function buildRealMCPPrompt(
  changeId: string,
  workBriefPath: string,
  flowDefinitionPath: string
): string {
  return `
# OpenSpec Implementation Flow Execution
# Change: ${changeId}

You are executing a multi-phase OpenSpec implementation using claude-flow MCP tools.
This is a REAL implementation - you MUST use the actual MCP tools, not simulations.

## STEP 1: Initialize Claude-Flow Swarm

Use the MCP tool to initialize a hierarchical swarm:

Tool: mcp__claude-flow__swarm_init
Parameters:
  topology: "hierarchical"
  maxAgents: 8
  strategy: "adaptive"

## STEP 2: Read All Context

Read these files to understand the implementation:

1. Work Brief: ${workBriefPath}
2. Proposal: openspec-flow/changes/${changeId}/proposal.md
3. Tasks: openspec-flow/changes/${changeId}/tasks.md
4. CLAUDE.md (project patterns)
5. docs/project-context.md (architecture context)

## STEP 3: Execute Each Phase

For each phase, spawn an agent and orchestrate the task:

### Phase 1: Context Loader
- Read: .claude/prompts/openspec-flow/context-loader.md
- Agent: researcher
- Task: Load and summarize all context documents
- Output: Context summary for downstream phases

### Phase 2: Planner
- Read: .claude/prompts/openspec-flow/planner.md
- Agent: system-architect
- Task: Create detailed implementation plan
- Output: Files to create/modify, migrations needed

### Phase 3: Implementer
- Read: .claude/prompts/openspec-flow/implementer.md
- Agent: coder
- Task: Execute the implementation plan
- IMPORTANT: Actually write the code following the tasks.md checklist
- Output: List of modified files

### Phase 4: Reviewer
- Read: .claude/prompts/openspec-flow/reviewer.md
- Agent: reviewer
- Task: Review implementation against spec
- Output: Review passed/failed, issues found

### Phase 5: Summarizer
- Read: .claude/prompts/openspec-flow/summarizer.md
- Agent: documenter
- Task: Generate flow log
- Output: Flow log written to openspec-flow/changes/${changeId}/flow-log.md

## STEP 4: Verify Implementation

After implementation:
1. Run: dotnet build (must succeed with 0 warnings)
2. Run: dotnet test (all tests must pass)
3. Verify all tasks in tasks.md are marked [x]

## STEP 5: Destroy Swarm

Use the MCP tool to cleanup:

Tool: mcp__claude-flow__swarm_destroy
Parameters:
  swarmId: <swarm_id_from_step_1>

## SUCCESS CRITERIA

- All 5 phases completed successfully
- All tasks in tasks.md marked as [x]
- dotnet build succeeds with 0 warnings
- Flow log written to openspec-flow/changes/${changeId}/flow-log.md

## IMPORTANT

- This is NOT a simulation - use real MCP tool calls
- Actually write and modify files as needed
- Follow project patterns defined in configuration
- Do NOT skip any phase or shortcut the process

Execute this flow NOW and report results when complete.
`.trim();
}

/**
 * Generate a Task tool invocation for Claude Code
 */
export function generateTaskToolInvocation(
  changeId: string,
  workBriefPath: string
): { subagent_type: string; description: string; prompt: string } {
  const prompt = buildRealMCPPrompt(
    changeId,
    workBriefPath,
    '.claude/flows/openspec-flow/implementation.yaml'
  );

  return {
    subagent_type: 'sparc-coord',
    description: `Implement OpenSpec ${changeId}`,
    prompt,
  };
}

/**
 * Save the execution prompt to a file for manual execution
 */
export function saveExecutionPrompt(
  changeId: string,
  prompt: FlowExecutionPrompt
): string {
  const outputPath = join(
    process.cwd(),
    'openspec-flow',
    'changes',
    changeId,
    'execution-prompt.md'
  );

  const content = `# OpenSpec Implementation Prompt
# Generated: ${new Date().toISOString()}
# Change: ${changeId}

## Instructions

Execute this prompt in Claude Code to implement the change using claude-flow MCP tools.

You can either:
1. Copy the prompt below into Claude Code
2. Use the Task tool with subagent_type="sparc-coord"

---

${prompt.fullPrompt}
`;

  writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

export default {
  generateFlowExecutionPrompt,
  generateTaskToolInvocation,
  saveExecutionPrompt,
};
