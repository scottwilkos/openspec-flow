/**
 * Dependency Resolver for OpenSpec Changes
 * Parses proposals to extract dependencies and build execution plan
 */

import {
  OpenSpecChange,
  ChangeDependency,
  ExecutionNode,
  ExecutionPlan,
} from '../types.js';

/**
 * Extract dependencies from a proposal file
 */
export function extractDependencies(change: OpenSpecChange): ChangeDependency {
  const dependency: ChangeDependency = {
    changeId: change.changeId,
    dependsOn: [],
    followedBy: [],
  };

  if (!change.proposal) {
    return dependency;
  }

  try {
    const proposalContent = change.proposal;

    // Parse "Dependencies" section
    const dependenciesMatch = proposalContent.match(
      /\*\*Dependencies\*\*:?\s*([\s\S]*?)(?=\n\n##|\n\*\*[^*]|$)/i
    );

    if (dependenciesMatch) {
      const depSection = dependenciesMatch[1];

      // Look for "Requires: X" or "Depends on: X" (with or without bullet points and bold)
      const requiresMatches = depSection.matchAll(
        /(?:-\s+)?\*?\*?(?:Requires|Depends on)\*?\*?:?\s+([0-9.a-z-]+)/gi
      );
      for (const match of requiresMatches) {
        const depId = match[1].trim();
        if (depId && depId !== 'None') {
          dependency.dependsOn.push(depId);
        }
      }

      // Look for "Followed by: X"
      const followedByMatches = depSection.matchAll(
        /(?:-\s+)?\*?\*?Followed by\*?\*?:?\s+([0-9.a-z-]+)/gi
      );
      for (const match of followedByMatches) {
        const followId = match[1].trim();
        if (followId) {
          dependency.followedBy.push(followId);
        }
      }
    }

    // Also check "Related Changes" section
    const relatedMatch = proposalContent.match(
      /## Related Changes\s*([\s\S]*?)(?=\n##|$)/i
    );

    if (relatedMatch) {
      const relatedSection = relatedMatch[1];

      // Look for dependency indicators
      const requiresMatches = relatedSection.matchAll(
        /(?:-\s+)?\*?\*?(?:Depends on|Requires)\*?\*?:?\s+([0-9.a-z-]+)/gi
      );
      for (const match of requiresMatches) {
        const depId = match[1].trim();
        if (depId && !dependency.dependsOn.includes(depId)) {
          dependency.dependsOn.push(depId);
        }
      }

      const followedByMatches = relatedSection.matchAll(
        /(?:-\s+)?\*?\*?Followed by\*?\*?:?\s+([0-9.a-z-]+)/gi
      );
      for (const match of followedByMatches) {
        const followId = match[1].trim();
        if (followId && !dependency.followedBy.includes(followId)) {
          dependency.followedBy.push(followId);
        }
      }
    }
  } catch (error) {
    console.warn(
      `Warning: Could not parse dependencies for ${change.changeId}:`,
      error instanceof Error ? error.message : String(error)
    );
  }

  return dependency;
}

/**
 * Build execution plan with topological sort
 */
export function buildExecutionPlan(changes: OpenSpecChange[]): ExecutionPlan {
  // Extract all dependencies
  const dependencies = changes.map(extractDependencies);

  // Create execution nodes
  const nodes: ExecutionNode[] = changes.map((change) => {
    const dep = dependencies.find((d) => d.changeId === change.changeId);
    return {
      changeId: change.changeId,
      change,
      dependsOn: dep?.dependsOn || [],
      status: 'pending',
    };
  });

  // Topological sort to determine execution order
  const executionOrder = topologicalSort(nodes);

  // Identify parallel batches (nodes that can run concurrently)
  const parallelBatches = identifyParallelBatches(nodes, executionOrder);

  return {
    changes: nodes,
    executionOrder,
    parallelBatches,
  };
}

/**
 * Topological sort using Kahn's algorithm
 */
function topologicalSort(nodes: ExecutionNode[]): string[] {
  const sorted: string[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.changeId, n]));
  const inDegree = new Map<string, number>();

  // Calculate in-degree for each node
  for (const node of nodes) {
    if (!inDegree.has(node.changeId)) {
      inDegree.set(node.changeId, 0);
    }
    for (const dep of node.dependsOn) {
      if (nodeMap.has(dep)) {
        inDegree.set(dep, (inDegree.get(dep) || 0));
        inDegree.set(node.changeId, (inDegree.get(node.changeId) || 0) + 1);
      }
    }
  }

  // Find nodes with no dependencies
  const queue: string[] = [];
  for (const [changeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(changeId);
    }
  }

  // Process nodes
  while (queue.length > 0) {
    const changeId = queue.shift()!;
    sorted.push(changeId);

    // Find nodes that depend on this one
    for (const node of nodes) {
      if (node.dependsOn.includes(changeId)) {
        const newDegree = (inDegree.get(node.changeId) || 0) - 1;
        inDegree.set(node.changeId, newDegree);
        if (newDegree === 0) {
          queue.push(node.changeId);
        }
      }
    }
  }

  // Check for cycles
  if (sorted.length !== nodes.length) {
    throw new Error(
      'Circular dependency detected in OpenSpec changes. Cannot create execution plan.'
    );
  }

  return sorted;
}

/**
 * Identify changes that can run in parallel
 */
function identifyParallelBatches(
  nodes: ExecutionNode[],
  executionOrder: string[]
): string[][] {
  const batches: string[][] = [];
  const nodeMap = new Map(nodes.map((n) => [n.changeId, n]));
  const completed = new Set<string>();

  for (const changeId of executionOrder) {
    const node = nodeMap.get(changeId);
    if (!node) continue;

    // Check if all dependencies are completed
    const canRun = node.dependsOn.every((dep) => completed.has(dep));

    if (canRun) {
      // Find or create batch
      let addedToBatch = false;
      for (const batch of batches) {
        // Can add to this batch if no dependencies within the batch
        const hasConflict = batch.some((batchChangeId) => {
          const batchNode = nodeMap.get(batchChangeId);
          return (
            batchNode?.dependsOn.includes(changeId) ||
            node.dependsOn.includes(batchChangeId)
          );
        });

        if (!hasConflict) {
          batch.push(changeId);
          addedToBatch = true;
          break;
        }
      }

      if (!addedToBatch) {
        batches.push([changeId]);
      }
    }

    completed.add(changeId);
  }

  return batches;
}

/**
 * Validate execution plan (check for missing dependencies)
 */
export function validateExecutionPlan(plan: ExecutionPlan): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const changeIds = new Set(plan.changes.map((n) => n.changeId));

  for (const node of plan.changes) {
    for (const dep of node.dependsOn) {
      if (!changeIds.has(dep)) {
        errors.push(
          `Change ${node.changeId} depends on ${dep}, but ${dep} is not in the batch.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
