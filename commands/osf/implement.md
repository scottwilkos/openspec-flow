---
# openspec-flow-command: v0.3.0
description: Implement an OpenSpec change via claude-flow multi-agent swarm
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, mcp__openspec-flow__generate_work_brief, mcp__openspec-flow__create_flow_log, Bash(npx claude-flow@alpha *)
---

# Implement Change: $ARGUMENTS

## How This Command Works

This command delegates ALL implementation work to claude-flow. You are the **orchestrator** - your job is to:

1. Gather context from openspec-flow MCP tools
2. Ensure a work brief exists for the change
3. Invoke claude-flow to spawn a multi-agent swarm that does the actual implementation
4. Wait for the swarm to complete
5. Document the results in a flow log

**You do NOT implement code directly. The claude-flow swarm does all implementation work.**

claude-flow agents have full file system access. They will read the work brief, understand the tasks, and implement the changes according to the specifications.

---

## Step 1: Get Change Context

First, retrieve the change context to get file paths and verify the change exists:

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

This returns:
- `paths.root` - The change directory (e.g., `openspec/changes/005-feature-name/`)
- `paths.workBrief` - Path to work-brief.md (may be null if not generated)
- `paths.proposal` - Path to proposal.md
- `paths.tasks` - Path to tasks.md
- `summary.hasWorkBrief` - Whether a work brief exists
- `summary.taskCount` - Number of tasks to implement
- `summary.percentComplete` - Current completion percentage

**Store the `paths.root` value - you will need it for Step 3.**

---

## Step 2: Ensure Work Brief Exists

If `summary.hasWorkBrief` is `false`, generate the work brief first:

```
mcp__openspec-flow__generate_work_brief({ change_id: "$ARGUMENTS" })
```

The work brief is critical - it contains:
- Summary of why and what changes
- Complete task checklist from tasks.md
- Technology stack context
- Architecture patterns and constraints
- Appendices with CLAUDE-FLOW.md configuration

**The work brief is the primary context document that claude-flow agents will read.**

---

## Step 3: Invoke claude-flow to Implement

Now invoke claude-flow to spawn a multi-agent swarm that will implement the change.

**Run this exact command via Bash**, replacing `<CHANGE_DIR>` with the `paths.root` value from Step 1:

```bash
npx claude-flow@alpha swarm "Implement OpenSpec change $ARGUMENTS. All context is in <CHANGE_DIR> - read work-brief.md first, then implement all tasks from tasks.md. Follow the technology stack and patterns defined in the work brief. Build and test after implementation." --strategy development --max-agents 8 --parallel
```

**Example with actual path:**
```bash
npx claude-flow@alpha swarm "Implement OpenSpec change 005-add-two-factor-auth. All context is in openspec/changes/005-add-two-factor-auth/ - read work-brief.md first, then implement all tasks from tasks.md. Follow the technology stack and patterns defined in the work brief. Build and test after implementation." --strategy development --max-agents 8 --parallel
```

**What this does:**
- `swarm` - Spawns a coordinated multi-agent team
- `--strategy development` - Configures agents for development work (coding, testing)
- `--max-agents 8` - Allows up to 8 parallel agents for complex changes
- `--parallel` - Enables concurrent execution (2.8-4.4x speedup)

**What the agents will do:**
1. Navigate to the change directory
2. Read `work-brief.md` to understand the full context
3. Read `tasks.md` to see all implementation tasks
4. Read `proposal.md` and `design.md` for requirements and design decisions
5. Read spec deltas in `specs/` subdirectory
6. Implement each task following project patterns
7. Run build and tests to verify

**IMPORTANT**: This command spawns claude-flow agents that do the actual implementation.
Wait for the swarm to complete before proceeding to Step 4.

---

## Step 4: Create Flow Log

After the swarm completes, document what was implemented:

```
mcp__openspec-flow__create_flow_log({
  change_id: "$ARGUMENTS",
  status: "complete",
  summary: "<Describe what the swarm implemented - list key components, features, and any notable decisions>",
  files_modified: ["<List the files that were created or modified by the swarm>"]
})
```

If the swarm encountered errors or incomplete tasks, use `status: "incomplete"` and describe what failed.

---

## Step 5: Report Results

Provide a summary to the user:

**Implementation Complete: $ARGUMENTS**

| Aspect | Details |
|--------|---------|
| Change | $ARGUMENTS |
| Status | Complete/Incomplete |
| Tasks Implemented | X of Y |
| Files Modified | List key files |
| Build Status | Pass/Fail |
| Test Status | Pass/Fail |

**Key Changes:**
- Bullet points of what was implemented

**Issues Encountered:**
- Any problems or deferred items (or "None")

---

## Next Steps

After implementation, suggest these follow-up commands:

- `/osf:verify $ARGUMENTS` - Run build and test verification via claude-flow
- `/osf:review $ARGUMENTS` - Multi-agent code review for quality, security, and architecture
- `/osf:deferred $ARGUMENTS` - Check for any incomplete tasks

---

## Troubleshooting

**If claude-flow fails to start:**
- Ensure claude-flow is installed: `npx claude-flow@alpha --version`
- Check that the change directory exists and has a work-brief.md

**If agents don't read the work brief:**
- Verify the path in the swarm command matches `paths.root` exactly
- Ensure work-brief.md was generated in Step 2

**If implementation is incomplete:**
- Check the flow log for errors
- Run `/osf:deferred $ARGUMENTS` to see remaining tasks
- Re-run `/osf:implement $ARGUMENTS` to continue
