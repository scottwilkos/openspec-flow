/**
 * Swarm Coordinator for Hive Orchestration
 * Manages multi-agent execution of OpenSpec changes
 */

import {
  ExecutionPlan,
  ExecutionNode,
  SwarmState,
  SwarmAgent,
  BatchExecutionResult,
} from '../types.js';
import { generateWorkBrief, saveWorkBrief } from './workbriefGenerator.js';
import { loadChange } from './openspec.js';
import * as mcpBridge from './mcpBridge.js';

/**
 * Initialize swarm for batch execution using MCP bridge
 */
export async function initializeSwarm(
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star' = 'hierarchical',
  maxAgents: number = 8
): Promise<SwarmState> {
  console.log(`🔧 Initializing swarm with ${topology} topology...`);

  const swarmState: SwarmState = {
    topology,
    agents: [],
    status: 'initializing',
  };

  try {
    // Use MCP bridge to initialize swarm via claude-flow MCP server
    const result = await mcpBridge.initializeSwarm(topology, maxAgents, 'adaptive');

    if (result.success) {
      console.log(`   ✓ Swarm initialized successfully: ${result.swarmId}`);
      swarmState.status = 'running';
      // Store swarm ID for later use
      (swarmState as any).swarmId = result.swarmId;
      return swarmState;
    } else {
      throw new Error(result.error || 'Swarm initialization failed');
    }
  } catch (error) {
    console.error('   ✗ Failed to initialize swarm:', error);
    swarmState.status = 'failed';
    throw error;
  }
}

/**
 * Spawn agent for a specific change using MCP bridge
 */
export async function spawnAgent(
  swarmState: SwarmState,
  changeId: string,
  agentType: 'task-orchestrator' | 'coder' | 'tester' | 'reviewer' | 'system-architect' = 'coder'
): Promise<SwarmAgent> {
  console.log(`   🤖 Spawning ${agentType} agent for ${changeId}...`);

  try {
    const swarmId = (swarmState as any).swarmId as string;
    const agentName = `${changeId}-agent`;
    const capabilities = [
      'implement-openspec-change',
      'follow-project-patterns',
      'architecture-compliance'
    ];

    // Use MCP bridge to spawn agent via claude-flow MCP server
    const result = await mcpBridge.spawnAgent(swarmId, agentType, agentName, capabilities);

    if (result.success) {
      const agent: SwarmAgent = {
        agentId: result.agentId,
        name: agentName,
        type: agentType,
        changeId,
        status: 'idle',
      };

      swarmState.agents.push(agent);
      console.log(`      ✓ Agent spawned: ${agent.agentId}`);

      return agent;
    } else {
      throw new Error(result.error || 'Agent spawn failed');
    }
  } catch (error) {
    console.error(`      ✗ Failed to spawn agent:`, error);
    const agent: SwarmAgent = {
      agentId: `agent-${changeId}-failed`,
      name: `${changeId}-agent`,
      type: agentType,
      changeId,
      status: 'failed',
    };
    throw error;
  }
}

/**
 * Execute a single change with an agent using MCP task orchestration
 */
export async function executeChange(
  node: ExecutionNode,
  agent: SwarmAgent,
  swarmState: SwarmState,
  waitForCompletion: boolean = false
): Promise<void> {
  console.log('');
  console.log(`📋 Executing: ${node.changeId}`);
  console.log(`   Agent: ${agent.agentId}`);
  console.log(`   Dependencies: ${node.dependsOn.length > 0 ? node.dependsOn.join(', ') : 'None'}`);

  try {
    node.status = 'in-progress';
    node.startedAt = new Date();
    node.agentId = agent.agentId;
    agent.status = 'working';

    // Step 1: Generate work brief
    console.log('   📝 Generating work brief...');
    const workBriefContent = generateWorkBrief(node.change);
    const workBriefPath = saveWorkBrief(node.change, workBriefContent);
    console.log(`      ✓ Work brief: ${workBriefPath}`);

    // Step 2: Prepare execution context
    const context = {
      changeId: node.changeId,
      workBriefPath,
      claudeMdPath: 'CLAUDE.md',
      claudeFlowMdPath: 'CLAUDE-FLOW.md',
      projectContextPath: 'docs/project-context.md',
      integrationDocsPath: 'docs/openspec-claude-flow.md',
      dependsOn: node.dependsOn,
    };

    // Step 3: Execute implementation with Claude-Flow MCP task orchestration
    console.log('   🔨 Orchestrating implementation via Claude-Flow MCP...');

    // Create detailed task prompt for Claude Code
    const taskPrompt = `
CRITICAL: You are executing OpenSpec change ${node.changeId} as part of automated batch orchestration.

CONTEXT FILES (MUST READ):
1. Work Brief: ${workBriefPath}
2. Proposal: openspec/changes/${node.changeId}/proposal.md
3. Tasks: openspec/changes/${node.changeId}/tasks.md
4. Project Context: ${context.claudeMdPath}
5. Claude-Flow Config: ${context.claudeFlowMdPath}
6. Architecture: ${context.projectContextPath}
7. Integration Docs: ${context.integrationDocsPath}

DEPENDENCIES: ${node.dependsOn.length > 0 ? node.dependsOn.join(', ') + ' (already completed)' : 'None'}

INSTRUCTIONS:
1. Read ALL context files listed above
2. Implement the change following the tasks checklist
3. Follow project patterns defined in configuration
4. Follow Claude-Flow orchestration patterns from CLAUDE-FLOW.md
5. Build and verify using project build command
6. Mark ALL tasks as [x] when complete in tasks.md
7. DO NOT pause or ask for approval - execute fully autonomously

CRITICAL SUCCESS CRITERIA:
- All tasks in tasks.md marked as [x]
- Build succeeds with 0 warnings
- All tests pass (if applicable)
- Project patterns followed correctly

Execute NOW and report results when complete.
`;

    // Use MCP bridge to orchestrate the task
    const swarmId = (swarmState as any).swarmId as string;
    const result = await mcpBridge.orchestrateTask(
      swarmId,
      taskPrompt,
      'high',
      'adaptive',
      node.dependsOn
    );

    if (result.success) {
      console.log(`   ✓ Task orchestrated: ${result.taskId}`);

      // If waitForCompletion is true, wait for the task to finish
      if (waitForCompletion) {
        console.log(`   ⏳ Waiting for task completion...`);

        const completion = await mcpBridge.waitForTaskCompletion(
          result.taskId,
          900000, // 15 minutes timeout
          30000   // 30 seconds poll interval
        );

        if (completion.success) {
          console.log(`   ✅ Task completed successfully`);
          node.status = 'completed';
          node.completedAt = new Date();
          agent.status = 'completed';
        } else {
          throw new Error(completion.error || 'Task failed to complete');
        }
      } else {
        // Mark as in-progress and return immediately
        console.log(`   ⏳ Task running asynchronously (taskId: ${result.taskId})`);
        node.status = 'in-progress';
        (node as any).taskId = result.taskId;
      }
    } else {
      throw new Error(result.error || 'Task orchestration failed');
    }

  } catch (error) {
    console.error(`   ❌ Failed to execute ${node.changeId}:`, error);
    node.status = 'failed';
    node.error = error instanceof Error ? error.message : String(error);
    agent.status = 'failed';
    throw error;
  }
}

/**
 * Execute changes in parallel batch using MCP parallel agent spawning
 */
export async function executeParallelBatch(
  batch: ExecutionNode[],
  swarmState: SwarmState,
  waitForCompletion: boolean = false
): Promise<void> {
  if (batch.length === 0) return;

  console.log('');
  console.log(`🚀 Executing parallel batch: ${batch.map((n) => n.changeId).join(', ')}`);

  // Use parallel agent spawning for better performance (10-20x faster)
  const swarmId = (swarmState as any).swarmId as string;
  const agentConfigs = batch.map((node) => ({
    type: 'coder',
    name: `${node.changeId}-agent`,
    capabilities: [
      'implement-openspec-change',
      'follow-project-patterns',
      'architecture-compliance'
    ],
    priority: 'high' as const
  }));

  console.log(`   🚀 Spawning ${batch.length} agents in parallel...`);
  const spawnResult = await mcpBridge.spawnAgentsParallel(swarmId, agentConfigs, 3, 5);

  if (!spawnResult.success) {
    throw new Error(spawnResult.error || 'Failed to spawn agents in parallel');
  }

  // Map spawned agents to SwarmAgent format
  const agents: SwarmAgent[] = spawnResult.agents.map((agentResult, index) => {
    const agent: SwarmAgent = {
      agentId: agentResult.agentId,
      name: agentResult.agentType,
      type: agentResult.agentType,
      changeId: batch[index].changeId,
      status: 'idle',
    };
    swarmState.agents.push(agent);
    return agent;
  });

  console.log(`   ✓ Spawned ${agents.length} agents`);

  // Execute all changes in parallel
  const executions = batch.map((node, index) =>
    executeChange(node, agents[index], swarmState, waitForCompletion).catch((error) => {
      console.error(`Error in parallel execution of ${node.changeId}:`, error);
      node.status = 'failed';
      node.error = error instanceof Error ? error.message : String(error);
    })
  );

  await Promise.all(executions);

  console.log('');
  console.log(`✓ Parallel batch completed`);
}

/**
 * Execute entire plan with swarm coordination
 */
export async function executeExecutionPlan(
  plan: ExecutionPlan
): Promise<BatchExecutionResult> {
  const startTime = Date.now();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HIVE ORCHESTRATION - Batch Execution');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total Changes: ${plan.changes.length}`);
  console.log(`Execution Order: ${plan.executionOrder.join(' → ')}`);
  console.log(`Parallel Batches: ${plan.parallelBatches.length}`);
  console.log('');

  // Initialize swarm
  const swarmState = await initializeSwarm('hierarchical');

  const completedChanges: string[] = [];
  const failedChanges: string[] = [];

  try {
    // Execute batches sequentially, but changes within each batch in parallel
    for (let i = 0; i < plan.parallelBatches.length; i++) {
      const batchIds = plan.parallelBatches[i];
      const batchNodes = plan.changes.filter((n) =>
        batchIds.includes(n.changeId)
      );

      console.log('');
      console.log(`───────────────────────────────────────────────────────────────`);
      console.log(`  Batch ${i + 1}/${plan.parallelBatches.length}`);
      console.log(`───────────────────────────────────────────────────────────────`);

      // Check if dependencies are met
      for (const node of batchNodes) {
        const depsReady = node.dependsOn.every((dep) =>
          completedChanges.includes(dep)
        );

        if (!depsReady) {
          console.warn(
            `Warning: ${node.changeId} dependencies not met. Blocking...`
          );
          node.status = 'blocked';
          continue;
        }

        node.status = 'ready';
      }

      // Execute ready nodes
      const readyNodes = batchNodes.filter((n) => n.status === 'ready');
      if (readyNodes.length > 0) {
        await executeParallelBatch(readyNodes, swarmState);

        // Track results
        for (const node of readyNodes) {
          if (node.status === 'completed') {
            completedChanges.push(node.changeId);
          } else if (node.status === 'failed') {
            failedChanges.push(node.changeId);
          }
        }
      }
    }

    const executionTime = Date.now() - startTime;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  BATCH EXECUTION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Completed: ${completedChanges.length} change(s)`);
    if (completedChanges.length > 0) {
      completedChanges.forEach((id) => console.log(`   - ${id}`));
    }
    console.log('');

    if (failedChanges.length > 0) {
      console.log(`❌ Failed: ${failedChanges.length} change(s)`);
      failedChanges.forEach((id) => console.log(`   - ${id}`));
      console.log('');
    }

    console.log(`⏱️  Total Time: ${(executionTime / 1000).toFixed(2)}s`);
    console.log('');

    return {
      success: failedChanges.length === 0,
      completedChanges,
      failedChanges,
      executionTime,
      summary: `Completed ${completedChanges.length}/${plan.changes.length} changes in ${(executionTime / 1000).toFixed(2)}s`,
    };
  } catch (error) {
    console.error('');
    console.error('❌ Batch execution failed:', error);
    console.error('');

    const executionTime = Date.now() - startTime;

    return {
      success: false,
      completedChanges,
      failedChanges: plan.changes
        .filter((n) => !completedChanges.includes(n.changeId))
        .map((n) => n.changeId),
      executionTime,
      summary: `Batch execution failed after ${(executionTime / 1000).toFixed(2)}s`,
    };
  }
}

/**
 * Destroy swarm and cleanup using MCP bridge
 */
export async function destroySwarm(swarmState: SwarmState): Promise<void> {
  console.log('🧹 Cleaning up swarm...');

  try {
    const swarmId = (swarmState as any).swarmId as string;

    // Use MCP bridge to destroy swarm
    const result = await mcpBridge.destroySwarm(swarmId);

    if (result.success) {
      swarmState.status = 'completed';
      console.log('   ✓ Swarm destroyed successfully');
    } else {
      throw new Error(result.error || 'Swarm destruction failed');
    }
  } catch (error) {
    console.error('   ✗ Failed to destroy swarm:', error);
    swarmState.status = 'failed';
  }
}
