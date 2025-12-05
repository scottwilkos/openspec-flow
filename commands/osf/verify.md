---
# openspec-flow-command: v0.3.2
description: Verify an OpenSpec implementation via claude-flow multi-agent swarm
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, Bash(npx claude-flow@alpha *)
---

# Verify Change: $ARGUMENTS

## How This Command Works

This command delegates ALL verification work to claude-flow. You are the **orchestrator** - your job is to:

1. Gather context from openspec-flow MCP tools
2. Capture memory baseline (for verification)
3. Invoke claude-flow to spawn a multi-agent swarm that performs verification
4. Verify completion via memory state comparison
5. Report the verification results to the user

**You do NOT run builds or tests directly. The claude-flow swarm does all verification work.**

claude-flow agents have full file system access. They will read the change context, run builds, execute tests, and validate that all tasks have been properly implemented.

---

## Step 1: Get Change Context

First, retrieve the change context to get file paths and current status:

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

This returns:
- `paths.root` - The change directory (e.g., `openspec/changes/005-feature-name/`)
- `paths.workBrief` - Path to work-brief.md
- `paths.tasks` - Path to tasks.md
- `summary.taskCount` - Total number of tasks
- `summary.tasksComplete` - Number of completed tasks
- `summary.percentComplete` - Current completion percentage
- `config.project.build` - Build command for the project
- `config.project.test` - Test command for the project

**Store the `paths.root` value - you will need it for Step 3.**

---

## Step 2: Capture Memory Baseline

Before running the swarm, capture the current memory state so you can verify what work was done:

```bash
npx claude-flow@alpha memory list
```

Note the current entries (or lack thereof). After the swarm completes, you'll compare to see what verification was performed.

---

## Step 3: Invoke claude-flow to Verify

Now invoke claude-flow to spawn a multi-agent swarm that will verify the implementation.

**Run this exact command via Bash**, replacing `<CHANGE_DIR>` with the `paths.root` value from Step 1:

```bash
npx claude-flow@alpha swarm "Verify OpenSpec change $ARGUMENTS. All context is in <CHANGE_DIR> - read work-brief.md and tasks.md. Verify: 1) Project builds successfully, 2) All tests pass, 3) Each task in tasks.md has been implemented correctly, 4) Code follows patterns defined in the work brief. IMPORTANT: If you find completed work that is not marked in tasks.md, update tasks.md to mark it complete by changing [ ] to [x]. Report any failures or gaps." --strategy testing --max-agents 4 --parallel --monitor
```

**Timeout**: Use a 60-minute timeout for the Bash command. Verification may take time for large test suites.

**Example with actual path:**
```bash
npx claude-flow@alpha swarm "Verify OpenSpec change 005-add-two-factor-auth. All context is in openspec/changes/005-add-two-factor-auth/ - read work-brief.md and tasks.md. Verify: 1) Project builds successfully, 2) All tests pass, 3) Each task in tasks.md has been implemented correctly, 4) Code follows patterns defined in the work brief. IMPORTANT: If you find completed work that is not marked in tasks.md, update tasks.md to mark it complete by changing [ ] to [x]. Report any failures or gaps." --strategy testing --max-agents 4 --parallel --monitor
```

**What this does:**
- `swarm` - Spawns a coordinated multi-agent team
- `--strategy testing` - Configures agents for testing and verification work
- `--max-agents 4` - Uses 4 agents for comprehensive verification
- `--parallel` - Enables concurrent execution
- `--monitor` - Real-time progress monitoring with cleaner output

**What the agents will do:**
1. Navigate to the change directory
2. Read `work-brief.md` to understand the expected implementation
3. Read `tasks.md` to see all tasks that should be complete
4. Run the project build command and check for errors
5. Run the test suite and check for failures
6. Validate each task has corresponding implementation
7. **Mark verified tasks complete in tasks.md if not already marked** (change `[ ]` to `[x]`)
8. Check that code follows architecture patterns
9. Report any discrepancies or failures

**IMPORTANT**: This command spawns claude-flow agents that do the actual verification.
**When the Bash command returns, the swarm has completed.** Proceed immediately to Step 4.

**OUTPUT WARNING**: The swarm output may be hundreds of lines of JSON. This is expected. **DO NOT** run build, test, or other commands yourself to "get cleaner data." Instead, take time to parse and summarize the swarm output - it contains all the information you need.

---

## Step 4: Verify Completion

After the swarm completes, verify work was done by checking the memory state:

```bash
npx claude-flow@alpha memory list
```

**Success indicators:**
- New memory entries with `status: "completed"` for verification tasks
- Entries showing build and test results

**Failure indicators:**
- No new memory entries since baseline
- Entries with `status: "failed"` or error messages

If the swarm failed or was incomplete, check the swarm output for errors before proceeding.

---

## Step 5: Report Verification Results

**IMPORTANT: Extract results from the swarm output. DO NOT re-run builds, tests, or file searches yourself.**

The swarm already performed all verification. Your job is to summarize what it found - look at the swarm's output for build results, test results, and task verification details.

Provide a summary to the user:

**Verification Results: $ARGUMENTS**

| Check | Status | Details |
|-------|--------|---------|
| Build | Pass/Fail | Any build errors |
| Tests | Pass/Fail | X passed, Y failed, Z skipped |
| Task Completion | X/Y | Tasks verified as complete |
| Pattern Compliance | Pass/Fail | Architecture pattern adherence |

**Build Output:**
```
<Include relevant build output or "Build successful">
```

**Test Results:**
```
<Include test summary or "All tests passed">
```

**Task Verification:**
| Task | Status | Notes |
|------|--------|-------|
| Task 1 description | ✅/❌ | Implementation notes |
| Task 2 description | ✅/❌ | Implementation notes |
| ... | ... | ... |

**Issues Found:**
- List any problems discovered (or "No issues found")

**Recommendations:**
- Suggestions for fixing any failures

---

## Next Steps

Based on verification results, suggest appropriate follow-up:

**If all checks pass:**
- `/osf:review $ARGUMENTS` - Proceed to code review
- `/osf:archive $ARGUMENTS` - Archive if ready for completion

**If there are failures:**
- `/osf:implement $ARGUMENTS` - Re-run implementation to fix issues
- `/osf:deferred $ARGUMENTS` - Check for incomplete tasks
- Address specific failures before proceeding

---

## Troubleshooting

**If build fails:**
- Check that all dependencies are installed
- Verify the build command in `.openspec-flow/config/project.yaml`
- Look for syntax errors or missing files

**If tests fail:**
- Review test output for specific failures
- Check if tests need updating for new functionality
- Verify test configuration is correct

**If tasks appear incomplete:**
- Compare tasks.md against actual implementation
- Check if code exists but tasks weren't marked complete
- Re-run `/osf:implement $ARGUMENTS` if work is missing

**If claude-flow fails to start:**
- Ensure claude-flow is installed: `npx claude-flow@alpha --version`
- Check that the change directory exists
