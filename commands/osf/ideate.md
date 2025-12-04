---
# openspec-flow-command: v0.2.4
description: Create a new OpenSpec change from natural language requirements
argument-hint: "<requirements>"
allowed-tools: mcp__openspec-flow__get_proposal_workflow, mcp__openspec-flow__list_changes, Bash, Read, Write, Edit, Glob, Grep
---

# Ideate Change: $ARGUMENTS

This command creates a new OpenSpec change by leveraging the project's OpenSpec proposal workflow.

**IMPORTANT: This command ONLY creates the specification. Do NOT implement, code, or execute any changes.**

## Step 1: Load OpenSpec Proposal Workflow

First, get the proposal workflow instructions:

```
mcp__openspec-flow__get_proposal_workflow()
```

This returns the project's OpenSpec proposal workflow (from `.claude/commands/openspec/proposal.md` if available, or a default workflow).

## Step 2: Gather Context

Before creating the change, understand the project:
- Run `openspec list` to see existing changes
- Run `openspec list --specs` to see existing specs
- Read CLAUDE.md for project conventions
- Explore relevant parts of the codebase

## Step 3: Execute the Proposal Workflow

Follow the workflow steps returned in Step 1 to create the OpenSpec change for:

**"$ARGUMENTS"**

The workflow will guide you to:
1. Choose a unique verb-led change-id
2. Create proposal.md, tasks.md, and design.md (when needed)
3. Draft spec deltas if applicable
4. Validate with `openspec validate <id> --strict`

**IMPORTANT**: If the workflow includes a step to ask clarifying questions or refine with the user, **STOP AND WAIT** for the user to respond before proceeding.

## Step 4: Validate

After creating the change files, validate:

```bash
openspec validate <change-id> --strict
```

Resolve any validation issues before proceeding.

## Step 5: Summary and STOP

Present the created change:
- Change ID
- Path to change directory
- Summary of what was created
- Validation status

**YOUR TASK IS COMPLETE. STOP HERE.**

**Do NOT:**
- Implement any code changes
- Run /osf:work, /osf:implement, /osf:verify, or any other commands
- Delete, modify, or create any files outside the openspec/changes/ directory
- Execute the tasks you just created

Tell the user what commands they can run next if they want to proceed:
- `/osf:work <change-id>` to generate a work brief
- `/osf:analyze <change-id>` to check sizing
- `/osf:implement <change-id>` to begin implementation
