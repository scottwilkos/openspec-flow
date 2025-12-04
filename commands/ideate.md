---
description: Create a new OpenSpec change from natural language requirements
argument-hint: "<requirements>"
allowed-tools: mcp__openspec-flow__*, mcp__claude-flow__*
---

# Ideate Change: $ARGUMENTS

This command transforms natural language requirements into a structured OpenSpec change.

## Step 1: Understand Context

Before creating the change, understand the project:
- Read CLAUDE.md for project conventions
- Check existing changes with `mcp__openspec-flow__list_changes()`
- Review project config if available

## Step 2: Analyze Requirements

Based on the user's requirements:

**"$ARGUMENTS"**

Identify:
1. **Scope**: What functionality is being requested?
2. **Components**: Which parts of the codebase will be affected?
3. **Dependencies**: What existing functionality does this build on?
4. **Risks**: Any potential challenges or considerations?

## Step 3: Refine with User

Present your interpretation and ask clarifying questions:
- Is the scope correct?
- What are the acceptance criteria?
- Are there specific constraints or preferences?
- Should this include tests? Documentation?

**Wait for user confirmation before proceeding.**

## Step 4: Generate Content

Draft the proposal and tasks based on confirmed requirements.

**Proposal should include:**
- Title
- Why (motivation)
- What Changes (high-level description)
- Impact (affected areas)
- Acceptance Criteria

**Tasks should include:**
- Setup tasks (configuration, dependencies)
- Implementation tasks (core functionality)
- Testing tasks (unit tests, integration tests)
- Documentation tasks (if applicable)

## Step 5: Create OpenSpec Change

Scaffold the change directory:

```
mcp__openspec-flow__scaffold_change({
  title: "<title from proposal>",
  description: "<brief one-line description>"
})
```

Save the refined proposal:

```
mcp__openspec-flow__save_change_artifact({
  change_id: "<changeId from scaffold>",
  artifact_type: "proposal",
  content: "<full proposal markdown>"
})
```

Save the tasks:

```
mcp__openspec-flow__save_change_artifact({
  change_id: "<changeId>",
  artifact_type: "tasks",
  content: "<full tasks markdown>"
})
```

## Step 6: Summary

Present the created change:
- Change ID
- Path to change directory
- Summary of proposal
- Task count
- Next steps

## Next Steps

- Edit the generated files to refine further
- `/work <change-id>` to generate a work brief
- `/analyze <change-id>` to check sizing
- `/implement <change-id>` to begin implementation

## Notes

- For complex requirements, consider using Claude-Flow agents to analyze the codebase first
- If the generated change is too large, use `/analyze` and `/split` to decompose it
