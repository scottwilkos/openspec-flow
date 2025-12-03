/**
 * Batch command - Execute multiple OpenSpec changes with hive orchestration
 */

import { loadChange } from '../utils/openspec.js';
import {
  buildExecutionPlan,
  validateExecutionPlan,
} from '../utils/dependencyResolver.js';
import { executeExecutionPlan } from '../utils/swarmCoordinator.js';
import { OpenSpecChange } from '../types.js';

export async function batchCommand(changeIds: string[]): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  OpenSpec Hive Orchestration - Batch Execution');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  if (changeIds.length === 0) {
    console.error('❌ Error: No change IDs provided');
    console.log('');
    console.log('Usage: npm run openspec-flow:batch -- <change-id-1> <change-id-2> ...');
    console.log('');
    console.log('Example:');
    console.log('  npm run openspec-flow:batch -- 0.2.1 0.2.2 0.2.3');
    console.log('');
    process.exit(1);
  }

  try {
    // Step 1: Load all changes
    console.log('📋 Loading OpenSpec changes...');
    const changes: OpenSpecChange[] = [];

    for (const changeId of changeIds) {
      try {
        const change = loadChange(changeId);
        changes.push(change);
        console.log(`   ✓ Loaded: ${change.changeId}`);
      } catch (error) {
        console.error(
          `   ✗ Failed to load ${changeId}:`,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }

    console.log('');

    // Step 2: Build execution plan with dependency resolution
    console.log('🔍 Analyzing dependencies...');
    const plan = buildExecutionPlan(changes);

    console.log(`   ✓ Execution order: ${plan.executionOrder.join(' → ')}`);
    console.log(`   ✓ Parallel batches: ${plan.parallelBatches.length}`);

    // Display parallel batches
    plan.parallelBatches.forEach((batch, index) => {
      if (batch.length > 1) {
        console.log(`      Batch ${index + 1}: [${batch.join(', ')}] (parallel)`);
      } else {
        console.log(`      Batch ${index + 1}: ${batch[0]} (sequential)`);
      }
    });

    console.log('');

    // Step 3: Validate execution plan
    console.log('✓ Validating execution plan...');
    const validation = validateExecutionPlan(plan);

    if (!validation.valid) {
      console.error('❌ Execution plan validation failed:');
      validation.errors.forEach((error) => console.error(`   - ${error}`));
      console.log('');
      console.log('Please ensure all dependencies are included in the batch.');
      process.exit(1);
    }

    console.log('   ✓ Execution plan valid');
    console.log('');

    // Step 4: Display summary and confirm
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  Execution Summary');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('');
    console.log(`Total Changes: ${plan.changes.length}`);
    console.log('');

    for (const node of plan.changes) {
      console.log(`📦 ${node.changeId}`);
      if (node.dependsOn.length > 0) {
        console.log(`   Dependencies: ${node.dependsOn.join(', ')}`);
      } else {
        console.log(`   Dependencies: None (can start immediately)`);
      }
    }

    console.log('');

    // Step 5: Execute the plan
    console.log('🚀 Starting batch execution...');
    console.log('');

    const result = await executeExecutionPlan(plan);

    // Step 6: Display results
    if (result.success) {
      console.log('✅ Batch execution completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Review implementation logs for each change');
      console.log('2. Run tests: dotnet test');
      console.log('3. Archive completed changes');
      console.log('');
    } else {
      console.error('❌ Batch execution completed with errors');
      console.log('');
      console.log('Please review failed changes and retry:');
      result.failedChanges.forEach((id) => {
        console.log(`   npm run openspec-flow:implement -- ${id}`);
      });
      console.log('');
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Batch execution failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.log('');
    process.exit(1);
  }
}
