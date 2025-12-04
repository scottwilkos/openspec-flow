---
# openspec-flow-command: v0.2.9
description: Implement an OpenSpec change via Claude Flow swarm
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, mcp__openspec-flow__generate_work_brief, mcp__openspec-flow__create_flow_log, mcp__claude-flow__*
---

# Implement Change: $ARGUMENTS

## CRITICAL RESTRICTIONS - READ THIS FIRST

**YOU ARE STRICTLY FORBIDDEN FROM:**
- Using Read tool to read source code files
- Using Write, Edit, or Update tools to modify ANY files
- Using Bash tool to run ANY commands
- Using Task tool to spawn agents
- Using Glob or Grep to search the codebase
- Implementing ANY code yourself
- Making ANY changes to the codebase directly

**YOUR ONLY ROLE IS ORCHESTRATION:**
1. Get change context via openspec-flow MCP
2. Initialize the claude-flow swarm
3. Spawn agents and orchestrate the task
4. WAIT for the swarm to complete
5. Report results and create flow log

**THE CLAUDE-FLOW SWARM DOES ALL IMPLEMENTATION WORK.**
**YOU DO NOT TOUCH THE CODE. PERIOD.**

**IF YOU VIOLATE THESE RULES, THE IMPLEMENTATION FAILS.**

---

## Step 1: Get Change Context

Get the change context (paths, summary, config):

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

If no work brief exists (`hasWorkBrief: false`), generate one first:
```
mcp__openspec-flow__generate_work_brief({ change_id: "$ARGUMENTS" })
```

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

**STOP HERE. DO NOT PROCEED TO IMPLEMENT ANYTHING YOURSELF.**

The swarm will now execute the implementation. You must wait.

## Step 5: Wait for Swarm Completion

Poll for task completion:

```
mcp__claude-flow__task_results({ taskId: "<taskId from step 4>" })
```

- If status is "pending" or "in_progress": poll again after a moment
- If status is "complete": proceed to Step 6
- If status is "failed": report the error and stop

**YOU ARE ONLY POLLING. DO NOT IMPLEMENT ANYTHING.**
**DO NOT USE Read/Write/Edit/Bash/Task TOOLS.**

## Step 6: Verify You Did Not Bypass the Swarm

Before proceeding, confirm ALL of these:
- [ ] You did NOT use Read tool on source files
- [ ] You did NOT use Write/Edit/Update tools
- [ ] You did NOT use Bash tool
- [ ] You did NOT use Task tool
- [ ] You did NOT implement any code yourself
- [ ] ALL implementation was done by the claude-flow swarm

**If you violated ANY of these, STOP immediately and report:**
"Error: Bypassed swarm orchestration. Implementation aborted."

## Step 7: Create Flow Log

Document the implementation:

```
mcp__openspec-flow__create_flow_log({
  change_id: "$ARGUMENTS",
  status: "complete",
  summary: "<summary from swarm results>",
  files_modified: ["<files from results>"]
})
```

## Step 8: Cleanup Swarm

Destroy the swarm when done:

```
mcp__claude-flow__swarm_destroy()
```

## Next Steps

- `/osf:verify $ARGUMENTS` for E2E verification
- `/osf:review $ARGUMENTS` for requirements review
- `/osf:deferred $ARGUMENTS` to check incomplete items
