---
# openspec-flow-command: v0.2.9
description: Review an OpenSpec implementation via Claude Flow swarm
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, mcp__claude-flow__*
---

# Review Change: $ARGUMENTS

## CRITICAL RESTRICTIONS - READ THIS FIRST

**YOU ARE STRICTLY FORBIDDEN FROM:**
- Using Read tool to read source code files
- Using Write, Edit, or Update tools to modify ANY files
- Using Bash tool to run ANY commands
- Using Task tool to spawn agents
- Using Glob or Grep to search the codebase
- Reviewing code yourself
- Making ANY changes to the codebase directly

**YOUR ONLY ROLE IS ORCHESTRATION:**
1. Get change context via openspec-flow MCP
2. Initialize the claude-flow swarm
3. Spawn agents and orchestrate review
4. WAIT for the swarm to complete
5. Report results

**THE CLAUDE-FLOW SWARM DOES ALL REVIEW WORK.**
**YOU DO NOT READ OR ANALYZE CODE. PERIOD.**

**IF YOU VIOLATE THESE RULES, THE REVIEW FAILS.**

---

## Step 1: Get Change Context

Get the change context (paths, summary, config):

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

The response includes file paths. The swarm agents will read these files during review.

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

**STOP HERE. DO NOT PROCEED TO REVIEW CODE YOURSELF.**

The swarm will now execute the review. You must wait.

## Step 5: Wait for Swarm Completion

Poll for task completion:

```
mcp__claude-flow__task_results({ taskId: "<taskId from step 4>" })
```

- If status is "pending" or "in_progress": poll again after a moment
- If status is "complete": proceed to Step 6
- If status is "failed": report the error and stop

**YOU ARE ONLY POLLING. DO NOT READ ANY CODE.**
**DO NOT USE Read/Write/Edit/Bash/Task TOOLS.**

## Step 6: Verify You Did Not Bypass the Swarm

Before proceeding, confirm ALL of these:
- [ ] You did NOT use Read tool on source files
- [ ] You did NOT use Grep/Glob to search code
- [ ] You did NOT use Task tool
- [ ] ALL review was done by the claude-flow swarm

**If you violated ANY of these, STOP immediately and report:**
"Error: Bypassed swarm orchestration. Review aborted."

## Step 7: Report

Aggregate review findings from swarm results:
- Passed checks
- Failed checks with specific issues
- Security concerns
- Architecture violations
- Recommendations

## Step 8: Cleanup Swarm

Destroy the swarm when done:

```
mcp__claude-flow__swarm_destroy()
```

## Next Steps

- `/osf:verify $ARGUMENTS` for E2E testing
- `/osf:deferred $ARGUMENTS` for incomplete items
- Address critical issues before merge
