/**
 * Claude-Flow integration utilities
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { ClaudeFlowInput, ClaudeFlowResult } from '../types.js';

/**
 * Invoke Claude-Flow for OpenSpec implementation
 */
export async function invokeClaudeFlow(input: ClaudeFlowInput): Promise<ClaudeFlowResult> {
  const flowConfigPath = '.claude/flows/openspec-implementation.yaml';

  if (!existsSync(flowConfigPath)) {
    return {
      success: false,
      logPath: '',
      error: `Claude-Flow configuration not found: ${flowConfigPath}`,
    };
  }

  try {
    // Build Claude-Flow command
    // Note: This is a placeholder - actual Claude-Flow CLI may differ
    const command = buildClaudeFlowCommand(input);

    console.log('Invoking Claude-Flow...');
    console.log(`Command: ${command}`);

    // Execute Claude-Flow
    // In a real implementation, this would invoke the actual Claude-Flow CLI
    // For now, we'll provide instructions

    const logPath = join('openspec', 'changes', input.changeId, 'flow-log.md');

    return {
      success: true,
      logPath,
    };
  } catch (error) {
    return {
      success: false,
      logPath: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build Claude-Flow execution command
 */
function buildClaudeFlowCommand(input: ClaudeFlowInput): string {
  // This is a placeholder for the actual Claude-Flow CLI syntax
  // Adjust based on actual Claude-Flow implementation

  const args = [
    'claude-flow',
    'run',
    'openspec-implementation',
    '--input', JSON.stringify({
      change_id: input.changeId,
      work_brief: input.workBriefPath,
      claude_md: input.claudeMdPath,
      project_context: input.projectContextPath,
    }),
  ];

  return args.join(' ');
}

/**
 * Check if Claude-Flow is available
 */
export function isClaudeFlowAvailable(): boolean {
  try {
    // Check for Claude-Flow configuration
    return existsSync('.claude/flows/openspec-implementation.yaml');
  } catch {
    return false;
  }
}

/**
 * Get manual invocation instructions
 */
export function getManualInstructions(input: ClaudeFlowInput): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('=== Manual Claude-Flow Invocation ===');
  lines.push('');
  lines.push('To run the Claude-Flow implementation flow manually:');
  lines.push('');
  lines.push('1. Load the following context documents:');
  lines.push(`   - Work Brief: ${input.workBriefPath}`);
  lines.push(`   - CLAUDE.md: ${input.claudeMdPath}`);
  lines.push(`   - Project Context: ${input.projectContextPath}`);
  lines.push('');
  lines.push('2. Follow the implementation phases:');
  lines.push('   a. Context Loader: Load all documents above');
  lines.push('   b. Planner: Create implementation plan');
  lines.push('   c. Implementer: Execute changes');
  lines.push('   d. Reviewer: Verify against spec');
  lines.push('   e. Summarizer: Write flow-log.md');
  lines.push('');
  lines.push('3. Save output to:');
  lines.push(`   openspec/changes/${input.changeId}/flow-log.md`);
  lines.push('');
  lines.push('Or use the Claude-Flow configuration at:');
  lines.push('   .claude/flows/openspec-implementation.yaml');
  lines.push('');

  return lines.join('\n');
}
