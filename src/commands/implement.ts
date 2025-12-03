/**
 * Implement command - Run Claude-Flow implementation for a change
 */

import { loadChange } from '../utils/openspec.js';
import { generateWorkBrief, saveWorkBrief } from '../utils/workbriefGenerator.js';
import { invokeClaudeFlow, isClaudeFlowAvailable, getManualInstructions } from '../utils/claudeFlow.js';
import { join } from 'path';

export async function implementCommand(changeId: string): Promise<void> {
  console.log('');
  console.log(`Implementing OpenSpec change: ${changeId}`);
  console.log('');

  try {
    // Step 1: Load the change
    console.log('📋 Loading OpenSpec change...');
    const change = loadChange(changeId);
    console.log(`   ✓ Loaded: ${change.changeId}`);
    console.log('');

    // Step 2: Generate work brief
    console.log('📝 Generating work brief...');
    const workBriefContent = generateWorkBrief(change);
    const workBriefPath = saveWorkBrief(change, workBriefContent);
    console.log(`   ✓ Work brief saved: ${workBriefPath}`);
    console.log('');

    // Step 3: Prepare Claude-Flow inputs
    const claudeFlowInput = {
      changeId,
      workBriefPath,
      claudeMdPath: 'CLAUDE.md',
      projectContextPath: 'docs/project-context.md',
    };

    // Step 4: Check Claude-Flow availability
    if (!isClaudeFlowAvailable()) {
      console.log('⚠️  Claude-Flow configuration not found');
      console.log('');
      console.log('The work brief has been generated, but Claude-Flow');
      console.log('must be configured to run the implementation flow.');
      console.log('');
      console.log('See: claude-flow/flows/openspec-implementation.yaml');
      console.log('');
      console.log(getManualInstructions(claudeFlowInput));
      return;
    }

    // Step 5: Invoke Claude-Flow
    console.log('🤖 Invoking Claude-Flow implementation...');
    console.log('');
    console.log('   Flow: openspec-implementation');
    console.log(`   Change: ${changeId}`);
    console.log(`   Work Brief: ${workBriefPath}`);
    console.log('');

    const result = await invokeClaudeFlow(claudeFlowInput);

    if (result.success) {
      console.log('✅ Claude-Flow execution initiated successfully!');
      console.log('');
      console.log(`   Log will be written to: ${result.logPath}`);
      console.log('');
      console.log('Monitor the flow execution and review the log when complete.');
      console.log('');
    } else {
      console.error('❌ Claude-Flow execution failed:');
      console.error(`   ${result.error}`);
      console.log('');
      console.log(getManualInstructions(claudeFlowInput));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during implementation:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
