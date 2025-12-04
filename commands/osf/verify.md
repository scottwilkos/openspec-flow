---
# openspec-flow-command: v0.2.4
description: Verify an OpenSpec implementation via Claude Flow orchestration
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__*, mcp__claude-flow__*
---

# Verify Change: $ARGUMENTS

This command orchestrates verification through Claude Flow's multi-agent system.

## Step 1: Get Change Context

Get the change context (paths, summary, config):

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

The response includes file paths. Agents will read these files as needed during verification.

## Step 2: Initialize Verification Swarm

Initialize a swarm for coordinated verification:

```
mcp__claude-flow__swarm_init({
  topology: "mesh",
  maxAgents: 3,
  config: {
    name: "verify-$ARGUMENTS",
    description: "Verification swarm for $ARGUMENTS"
  }
})
```

## Step 3: Spawn Verification Agents

Spawn specialized agents for verification tasks:

```
mcp__claude-flow__agent_spawn({
  type: "tester",
  name: "build-verifier",
  config: { focus: "build-verification" }
})

mcp__claude-flow__agent_spawn({
  type: "tester",
  name: "test-runner",
  config: { focus: "test-execution" }
})

mcp__claude-flow__agent_spawn({
  type: "reviewer",
  name: "requirements-checker",
  config: { focus: "requirements-validation" }
})
```

## Step 4: Orchestrate Verification

Run the verification workflow:

```
mcp__claude-flow__task_orchestrate({
  task: "Verify implementation of $ARGUMENTS:\n1. Run build and check for errors\n2. Execute test suite\n3. Read tasks at <tasks path> and validate each is complete\n4. Read proposal at <proposal path> and check requirements are met",
  strategy: "parallel",
  config: {
    collectAllResults: true,
    continueOnFailure: true
  }
})
```

## Step 5: Collect Results

Get verification results from all agents:

```
mcp__claude-flow__task_results({ taskId: "<taskId from step 4>" })
```

## Step 6: Report

Provide a verification summary based on results:
- Build status (pass/fail)
- Test results
- Tasks verified
- Requirements coverage
- Gaps identified

## Step 7: Cleanup Swarm

Destroy the swarm when done:

```
mcp__claude-flow__swarm_destroy()
```

## Next Steps

- `/osf:review $ARGUMENTS` for detailed code review
- `/osf:deferred $ARGUMENTS` to analyze incomplete items
- Address any critical gaps before closing
