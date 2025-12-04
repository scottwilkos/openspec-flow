---
# openspec-flow-command: v0.2.9
description: Verify an OpenSpec implementation via Claude Flow swarm
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, mcp__claude-flow__*
---

# Verify Change: $ARGUMENTS

## CRITICAL RESTRICTIONS - READ THIS FIRST

**YOU ARE STRICTLY FORBIDDEN FROM:**
- Using Read tool to read source code files
- Using Write, Edit, or Update tools to modify ANY files
- Using Bash tool to run ANY commands
- Using Task tool to spawn agents
- Using Glob or Grep to search the codebase
- Running tests or builds yourself
- Making ANY changes to the codebase directly

**YOUR ONLY ROLE IS ORCHESTRATION:**
1. Get change context via openspec-flow MCP
2. Initialize the claude-flow swarm
3. Spawn agents and orchestrate verification
4. WAIT for the swarm to complete
5. Report results

**THE CLAUDE-FLOW SWARM DOES ALL VERIFICATION WORK.**
**YOU DO NOT RUN TESTS OR BUILDS. PERIOD.**

**IF YOU VIOLATE THESE RULES, THE VERIFICATION FAILS.**

---

## Step 1: Get Change Context

Get the change context (paths, summary, config):

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

The response includes file paths. The swarm agents will read these files during verification.

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

**STOP HERE. DO NOT PROCEED TO RUN TESTS YOURSELF.**

The swarm will now execute verification. You must wait.

## Step 5: Wait for Swarm Completion

Poll for task completion:

```
mcp__claude-flow__task_results({ taskId: "<taskId from step 4>" })
```

- If status is "pending" or "in_progress": poll again after a moment
- If status is "complete": proceed to Step 6
- If status is "failed": report the error and stop

**YOU ARE ONLY POLLING. DO NOT RUN ANY COMMANDS.**
**DO NOT USE Read/Write/Edit/Bash/Task TOOLS.**

## Step 6: Verify You Did Not Bypass the Swarm

Before proceeding, confirm ALL of these:
- [ ] You did NOT use Read tool on source files
- [ ] You did NOT use Bash to run tests or builds
- [ ] You did NOT use Task tool
- [ ] ALL verification was done by the claude-flow swarm

**If you violated ANY of these, STOP immediately and report:**
"Error: Bypassed swarm orchestration. Verification aborted."

## Step 7: Report

Provide a verification summary based on swarm results:
- Build status (pass/fail)
- Test results
- Tasks verified
- Requirements coverage
- Gaps identified

## Step 8: Cleanup Swarm

Destroy the swarm when done:

```
mcp__claude-flow__swarm_destroy()
```

## Next Steps

- `/osf:review $ARGUMENTS` for detailed code review
- `/osf:deferred $ARGUMENTS` to analyze incomplete items
- Address any critical gaps before closing
