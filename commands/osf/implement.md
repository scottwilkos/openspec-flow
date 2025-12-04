---
# openspec-flow-command: v0.2.4
description: Implement an OpenSpec change via Claude Flow orchestration
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__*, mcp__claude-flow__*
---

# Implement Change: $ARGUMENTS

This command orchestrates implementation through Claude Flow's multi-agent system.

## Step 1: Get Change Context

Get the change context (paths, summary, config):

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

If no work brief exists (`hasWorkBrief: false`), generate one first:
```
mcp__openspec-flow__generate_work_brief({ change_id: "$ARGUMENTS" })
```

The response includes file paths. Agents will read these files as needed during orchestration.

## Step 2: Initialize Agent Swarm

Initialize a hierarchical swarm for coordinated implementation:

```
mcp__claude-flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 5,
  config: {
    name: "implement-$ARGUMENTS",
    description: "Implementation swarm for $ARGUMENTS"
  }
})
```

## Step 3: Spawn Implementation Agents

Spawn specialized agents for the implementation:

```
mcp__claude-flow__agent_spawn({
  type: "coder",
  name: "implementer",
  config: { focus: "implementation" }
})

mcp__claude-flow__agent_spawn({
  type: "tester",
  name: "verifier",
  config: { focus: "unit-tests" }
})
```

## Step 4: Orchestrate Implementation

Pass the work brief path and instructions to the swarm:

```
mcp__claude-flow__task_orchestrate({
  task: "Implement change $ARGUMENTS. Read the work brief at <workBrief path from step 1> and complete all tasks. Follow project patterns from config.",
  strategy: "sequential",
  config: {
    validateBetweenSteps: true,
    stopOnFailure: true
  }
})
```

## Step 5: Collect Results

Get the implementation results from all agents:

```
mcp__claude-flow__task_results({ taskId: "<taskId from step 4>" })
```

## Step 6: Create Flow Log

Document the implementation:

```
mcp__openspec-flow__create_flow_log({
  change_id: "$ARGUMENTS",
  status: "complete",
  summary: "<summary from results>",
  files_modified: ["<files from results>"]
})
```

## Step 7: Cleanup Swarm

Destroy the swarm when done:

```
mcp__claude-flow__swarm_destroy()
```

## Next Steps

- `/osf:verify $ARGUMENTS` for E2E verification
- `/osf:review $ARGUMENTS` for requirements review
- `/osf:deferred $ARGUMENTS` to check incomplete items
