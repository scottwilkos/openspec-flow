/**
 * YAML Flow Executor
 * Executes .claude/flows/*.yaml flow definitions with multi-phase orchestration
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import * as mcpBridge from './mcpBridge.js';

// ============================================================================
// Types
// ============================================================================

export interface FlowDefinition {
  name: string;
  description: string;
  version: string;
  inputs: Record<string, FlowInput>;
  outputs: Record<string, FlowOutput>;
  phases: FlowPhase[];
  error_handling?: ErrorHandling;
  logging?: LoggingConfig;
  metadata?: Record<string, any>;
}

export interface FlowInput {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
}

export interface FlowOutput {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
}

export interface FlowPhase {
  name: string;
  description: string;
  agent_type: string;
  system_prompt_file?: string;
  depends_on?: string[];
  inputs: Record<string, string>[];
  outputs: Record<string, string>[];
}

export interface ErrorHandling {
  on_phase_failure?: {
    log_error?: boolean;
    continue_to_summarizer?: boolean;
    mark_incomplete?: boolean;
    retry_count?: number;
  };
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  output_dir: string;
  flow_log_file: string;
}

export interface FlowExecutionContext {
  flowDefinition: FlowDefinition;
  inputs: Record<string, any>;
  phaseOutputs: Map<string, Record<string, any>>;
  swarmId: string;
  agentIds: Map<string, string>;
  startTime: Date;
  errors: FlowError[];
}

export interface FlowError {
  phase: string;
  error: string;
  timestamp: Date;
}

export interface FlowExecutionResult {
  success: boolean;
  outputs: Record<string, any>;
  errors: FlowError[];
  executionTime: number;
  flowLogPath?: string;
}

// ============================================================================
// Flow Loading
// ============================================================================

/**
 * Load YAML flow definition from file
 */
export function loadFlowDefinition(flowPath: string): FlowDefinition {
  if (!existsSync(flowPath)) {
    throw new Error(`Flow definition not found: ${flowPath}`);
  }

  const yamlContent = readFileSync(flowPath, 'utf-8');
  const flow = yaml.parse(yamlContent) as FlowDefinition;

  // Validate flow structure
  if (!flow.name || !flow.phases || flow.phases.length === 0) {
    throw new Error('Invalid flow definition: missing required fields (name, phases)');
  }

  return flow;
}

/**
 * Load system prompt file for a phase
 */
function loadSystemPrompt(promptFilePath: string): string {
  const fullPath = join(process.cwd(), '.claude', 'flows', promptFilePath);

  if (!existsSync(fullPath)) {
    console.warn(`Warning: System prompt file not found: ${fullPath}`);
    return '';
  }

  return readFileSync(fullPath, 'utf-8');
}

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Interpolate variables in a string (e.g., "{{ inputs.change_id }}")
 */
function interpolateVariables(
  template: string,
  context: FlowExecutionContext,
  inputs: Record<string, any>
): string {
  let result = template;

  // Replace {{ inputs.* }}
  const inputMatches = template.matchAll(/{{\s*inputs\.(\w+)\s*}}/g);
  for (const match of inputMatches) {
    const inputName = match[1];
    const value = inputs[inputName] || context.inputs[inputName] || '';
    result = result.replace(match[0], String(value));
  }

  // Replace {{ phases.*.outputs.* }}
  const phaseMatches = template.matchAll(/{{\s*phases\.(\w+)\.outputs\.(\w+)\s*}}/g);
  for (const match of phaseMatches) {
    const phaseName = match[1];
    const outputName = match[2];
    const phaseOutputs = context.phaseOutputs.get(phaseName);
    const value = phaseOutputs?.[outputName] || '';
    result = result.replace(match[0], String(value));
  }

  return result;
}

/**
 * Interpolate all inputs for a phase
 */
function interpolatePhaseInputs(
  phase: FlowPhase,
  context: FlowExecutionContext
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const inputObj of phase.inputs) {
    for (const [key, value] of Object.entries(inputObj)) {
      result[key] = interpolateVariables(value, context, {});
    }
  }

  return result;
}

// ============================================================================
// Phase Execution
// ============================================================================

/**
 * Execute a single phase
 */
async function executePhase(
  phase: FlowPhase,
  context: FlowExecutionContext
): Promise<Record<string, any>> {
  console.log('');
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  Phase: ${phase.name.padEnd(50)}  ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log('');
  console.log(`Description: ${phase.description}`);
  console.log(`Agent Type: ${phase.agent_type}`);
  console.log('');

  try {
    // Step 1: Load system prompt if specified
    let systemPrompt = '';
    if (phase.system_prompt_file) {
      console.log(`📄 Loading system prompt: ${phase.system_prompt_file}`);
      systemPrompt = loadSystemPrompt(phase.system_prompt_file);
      console.log(`   ✓ Loaded ${systemPrompt.length} characters`);
    }

    // Step 2: Interpolate phase inputs
    console.log('📥 Preparing phase inputs...');
    const phaseInputs = interpolatePhaseInputs(phase, context);
    console.log(`   ✓ Inputs prepared:`, Object.keys(phaseInputs));

    // Step 3: Spawn agent for this phase
    console.log(`🤖 Spawning ${phase.agent_type} agent for ${phase.name}...`);
    const agentName = `${phase.name}-agent`;
    const agentResult = await mcpBridge.spawnAgent(
      context.swarmId,
      phase.agent_type as any,
      agentName,
      ['execute-flow-phase', 'follow-system-prompt']
    );

    if (!agentResult.success) {
      throw new Error(agentResult.error || 'Failed to spawn agent');
    }

    context.agentIds.set(phase.name, agentResult.agentId);
    console.log(`   ✓ Agent spawned: ${agentResult.agentId}`);

    // Step 4: Build task prompt for the phase
    const taskPrompt = buildPhaseTaskPrompt(phase, phaseInputs, systemPrompt, context);

    // Step 5: Orchestrate task execution
    console.log('🔨 Orchestrating phase execution...');
    const taskResult = await mcpBridge.orchestrateTask(
      context.swarmId,
      taskPrompt,
      'high',
      'adaptive',
      phase.depends_on || []
    );

    if (!taskResult.success) {
      throw new Error(taskResult.error || 'Task orchestration failed');
    }

    console.log(`   ✓ Task orchestrated: ${taskResult.taskId}`);

    // Step 6: Wait for task completion
    console.log('⏳ Waiting for phase completion...');
    const completion = await mcpBridge.waitForTaskCompletion(
      taskResult.taskId,
      900000, // 15 minutes
      30000   // 30 seconds poll interval
    );

    if (!completion.success) {
      throw new Error(completion.error || 'Phase execution failed');
    }

    console.log('✅ Phase completed successfully');

    // Step 7: Extract outputs (in real implementation, would parse from results)
    // For now, simulate outputs based on phase definition
    const outputs = simulatePhaseOutputs(phase, completion.results);
    context.phaseOutputs.set(phase.name, outputs);

    console.log('📤 Phase outputs:', Object.keys(outputs));
    console.log('');

    return outputs;

  } catch (error) {
    console.error(`❌ Phase ${phase.name} failed:`, error);

    const flowError: FlowError = {
      phase: phase.name,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date()
    };

    context.errors.push(flowError);

    // Handle error according to flow configuration
    const errorHandling = context.flowDefinition.error_handling;
    if (errorHandling?.on_phase_failure?.log_error) {
      console.log('📝 Error logged to context');
    }

    if (errorHandling?.on_phase_failure?.continue_to_summarizer) {
      console.log('⚠️  Continuing to summarizer phase...');
      return {}; // Return empty outputs to allow continuation
    }

    throw error;
  }
}

/**
 * Build task prompt for a phase
 */
function buildPhaseTaskPrompt(
  phase: FlowPhase,
  inputs: Record<string, any>,
  systemPrompt: string,
  context: FlowExecutionContext
): string {
  const lines: string[] = [];

  lines.push(`# Phase: ${phase.name}`);
  lines.push('');
  lines.push(`**Description**: ${phase.description}`);
  lines.push(`**Agent Type**: ${phase.agent_type}`);
  lines.push('');

  if (systemPrompt) {
    lines.push('---');
    lines.push('');
    lines.push('# System Prompt');
    lines.push('');
    lines.push(systemPrompt);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('# Phase Inputs');
  lines.push('');

  for (const [key, value] of Object.entries(inputs)) {
    lines.push(`**${key}**: ${value}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('# Expected Outputs');
  lines.push('');

  for (const outputObj of phase.outputs) {
    for (const [key, type] of Object.entries(outputObj)) {
      lines.push(`- **${key}** (${type})`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('# Instructions');
  lines.push('');
  lines.push('1. Execute the phase following the system prompt');
  lines.push('2. Use the provided inputs');
  lines.push('3. Generate all expected outputs');
  lines.push('4. Follow project patterns and constraints');
  lines.push('5. Report results when complete');
  lines.push('');

  return lines.join('\n');
}

/**
 * Simulate phase outputs (in real implementation, would parse from actual results)
 */
function simulatePhaseOutputs(
  phase: FlowPhase,
  results: any
): Record<string, any> {
  const outputs: Record<string, any> = {};

  // Extract outputs from phase definition
  for (const outputObj of phase.outputs) {
    for (const [key, type] of Object.entries(outputObj)) {
      // In real implementation, would extract from actual task results
      // For now, provide placeholder values
      switch (type) {
        case 'string':
          outputs[key] = `${phase.name}_${key}_output`;
          break;
        case 'array':
          outputs[key] = [];
          break;
        case 'object':
          outputs[key] = {};
          break;
        case 'boolean':
          outputs[key] = true;
          break;
        default:
          outputs[key] = null;
      }
    }
  }

  return outputs;
}

// ============================================================================
// Flow Execution
// ============================================================================

/**
 * Execute a complete flow definition
 */
export async function executeFlow(
  flowPath: string,
  inputs: Record<string, any>
): Promise<FlowExecutionResult> {
  const startTime = Date.now();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  YAML FLOW EXECUTOR');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Load flow definition
    console.log(`📄 Loading flow definition: ${flowPath}`);
    const flowDefinition = loadFlowDefinition(flowPath);
    console.log(`   ✓ Flow loaded: ${flowDefinition.name} v${flowDefinition.version}`);
    console.log(`   📝 ${flowDefinition.description}`);
    console.log(`   🔢 ${flowDefinition.phases.length} phases`);
    console.log('');

    // Step 2: Validate inputs
    console.log('🔍 Validating inputs...');
    validateFlowInputs(flowDefinition, inputs);
    console.log('   ✓ All required inputs provided');
    console.log('');

    // Step 3: Initialize swarm
    console.log('🔧 Initializing swarm...');
    const swarmResult = await mcpBridge.initializeSwarm('hierarchical', 8, 'adaptive');

    if (!swarmResult.success) {
      throw new Error(swarmResult.error || 'Failed to initialize swarm');
    }

    console.log(`   ✓ Swarm initialized: ${swarmResult.swarmId}`);
    console.log('');

    // Step 4: Create execution context
    const context: FlowExecutionContext = {
      flowDefinition,
      inputs,
      phaseOutputs: new Map(),
      swarmId: swarmResult.swarmId,
      agentIds: new Map(),
      startTime: new Date(),
      errors: []
    };

    // Step 5: Execute phases in dependency order
    console.log('🚀 Executing phases...');
    console.log('');

    for (const phase of flowDefinition.phases) {
      // Check dependencies are met
      if (phase.depends_on && phase.depends_on.length > 0) {
        console.log(`   Dependencies: ${phase.depends_on.join(', ')}`);
        for (const dep of phase.depends_on) {
          if (!context.phaseOutputs.has(dep)) {
            throw new Error(`Phase ${phase.name} depends on ${dep} which has not completed`);
          }
        }
      }

      await executePhase(phase, context);
    }

    // Step 6: Generate flow log
    console.log('📝 Generating flow log...');
    const flowLogPath = generateFlowLog(context, flowDefinition, inputs);
    console.log(`   ✓ Flow log: ${flowLogPath}`);
    console.log('');

    // Step 7: Destroy swarm
    console.log('🧹 Cleaning up swarm...');
    await mcpBridge.destroySwarm(swarmResult.swarmId);
    console.log('   ✓ Swarm destroyed');
    console.log('');

    const executionTime = Date.now() - startTime;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FLOW EXECUTION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Success: All ${flowDefinition.phases.length} phases completed`);
    console.log(`⏱️  Total Time: ${(executionTime / 1000).toFixed(2)}s`);
    console.log(`📄 Flow Log: ${flowLogPath}`);
    console.log('');

    // Extract final outputs
    const outputs: Record<string, any> = {
      flow_log: flowLogPath,
      execution_time: executionTime,
      phases_completed: flowDefinition.phases.length
    };

    return {
      success: true,
      outputs,
      errors: context.errors,
      executionTime,
      flowLogPath
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;

    console.error('');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  FLOW EXECUTION FAILED');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('');
    console.error('❌ Error:', error);
    console.error(`⏱️  Failed after: ${(executionTime / 1000).toFixed(2)}s`);
    console.error('');

    return {
      success: false,
      outputs: {},
      errors: [{
        phase: 'flow-execution',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      }],
      executionTime
    };
  }
}

/**
 * Validate flow inputs
 */
function validateFlowInputs(
  flowDefinition: FlowDefinition,
  inputs: Record<string, any>
): void {
  for (const [name, inputDef] of Object.entries(flowDefinition.inputs)) {
    if (inputDef.required && !(name in inputs)) {
      throw new Error(`Required input missing: ${name}`);
    }
  }
}

/**
 * Generate flow log markdown file
 */
function generateFlowLog(
  context: FlowExecutionContext,
  flowDefinition: FlowDefinition,
  inputs: Record<string, any>
): string {
  const lines: string[] = [];

  lines.push(`# Flow Log: ${flowDefinition.name}`);
  lines.push('');
  lines.push(`**Version**: ${flowDefinition.version}`);
  lines.push(`**Executed**: ${context.startTime.toISOString()}`);
  lines.push(`**Duration**: ${((Date.now() - context.startTime.getTime()) / 1000).toFixed(2)}s`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Flow Description');
  lines.push('');
  lines.push(flowDefinition.description);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Inputs');
  lines.push('');

  for (const [key, value] of Object.entries(inputs)) {
    lines.push(`- **${key}**: ${value}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Phases Executed');
  lines.push('');

  for (const phase of flowDefinition.phases) {
    const outputs = context.phaseOutputs.get(phase.name);
    const agentId = context.agentIds.get(phase.name);

    lines.push(`### ${phase.name}`);
    lines.push('');
    lines.push(`**Description**: ${phase.description}`);
    lines.push(`**Agent Type**: ${phase.agent_type}`);
    lines.push(`**Agent ID**: ${agentId || 'N/A'}`);
    lines.push('');

    if (outputs && Object.keys(outputs).length > 0) {
      lines.push('**Outputs**:');
      for (const [key, value] of Object.entries(outputs)) {
        lines.push(`- **${key}**: ${JSON.stringify(value)}`);
      }
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');

  if (context.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');

    for (const error of context.errors) {
      lines.push(`### ${error.phase}`);
      lines.push('');
      lines.push(`**Time**: ${error.timestamp.toISOString()}`);
      lines.push(`**Error**: ${error.error}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Phases**: ${flowDefinition.phases.length} total`);
  lines.push(`- **Completed**: ${context.phaseOutputs.size}`);
  lines.push(`- **Errors**: ${context.errors.length}`);
  lines.push(`- **Status**: ${context.errors.length === 0 ? '✅ Success' : '⚠️ Completed with errors'}`);
  lines.push('');

  const content = lines.join('\n');

  // Save to file
  const outputDir = interpolateVariables(
    flowDefinition.logging?.output_dir || 'openspec/changes/{{ inputs.change_id }}/',
    context,
    inputs
  );

  const flowLogFile = flowDefinition.logging?.flow_log_file || 'flow-log.md';
  const flowLogPath = join(process.cwd(), outputDir, flowLogFile);

  writeFileSync(flowLogPath, content, 'utf-8');

  return flowLogPath;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  loadFlowDefinition,
  executeFlow,
  interpolateVariables
};
