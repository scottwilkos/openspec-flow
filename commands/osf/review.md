---
# openspec-flow-command: v0.2.4
description: Review an OpenSpec implementation via Claude Flow orchestration
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__*, mcp__claude-flow__*
---

# Review Change: $ARGUMENTS

This command orchestrates code review through Claude Flow's multi-agent system.

## Step 1: Get Change Context

Get the change context (paths, summary, config):

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

The response includes file paths. Agents will read these files as needed during review.

## Step 2: Initialize Review Swarm

Initialize a swarm for coordinated review:

```
mcp__claude-flow__swarm_init({
  topology: "star",
  maxAgents: 4,
  config: {
    name: "review-$ARGUMENTS",
    description: "Review swarm for $ARGUMENTS"
  }
})
```

## Step 3: Spawn Review Agents

Spawn specialized agents for different review aspects:

```
mcp__claude-flow__agent_spawn({
  type: "reviewer",
  name: "requirements-reviewer",
  config: { focus: "requirements-compliance" }
})

mcp__claude-flow__agent_spawn({
  type: "reviewer",
  name: "architecture-reviewer",
  config: { focus: "architecture-patterns" }
})

mcp__claude-flow__agent_spawn({
  type: "reviewer",
  name: "security-reviewer",
  config: { focus: "security-audit" }
})

mcp__claude-flow__agent_spawn({
  type: "reviewer",
  name: "quality-reviewer",
  config: { focus: "code-quality" }
})
```

## Step 4: Orchestrate Review

Run the review workflow with the following checklist:

```
mcp__claude-flow__task_orchestrate({
  task: "Review implementation of $ARGUMENTS. Read work brief at <workBrief path> and proposal at <proposal path>.\n\nRequirements:\n- All tasks from work brief addressed\n- Spec requirements met\n- No missing functionality\n\nArchitecture:\n- Follows project patterns from config\n- Correct layer separation\n- No violations\n\nSecurity:\n- No OWASP vulnerabilities\n- Proper input validation\n- Secure data handling\n\nCode Quality:\n- Proper error handling\n- No magic values\n- Appropriate logging",
  strategy: "parallel",
  config: {
    collectAllResults: true,
    continueOnFailure: true
  }
})
```

## Step 5: Collect Results

Get review results from all agents:

```
mcp__claude-flow__task_results({ taskId: "<taskId from step 4>" })
```

## Step 6: Report

Aggregate review findings:
- Passed checks
- Failed checks with specific issues
- Security concerns
- Architecture violations
- Recommendations

## Step 7: Cleanup Swarm

Destroy the swarm when done:

```
mcp__claude-flow__swarm_destroy()
```

## Next Steps

- `/osf:verify $ARGUMENTS` for E2E testing
- `/osf:deferred $ARGUMENTS` for incomplete items
- Address critical issues before merge
