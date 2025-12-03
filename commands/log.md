---
description: Create implementation flow log for an OpenSpec change
argument-hint: "<change-id>"
---

# Create Flow Log: $ARGUMENTS

## Step 1: Get Context

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

## Step 2: Gather Implementation Details

Analyze what was implemented:
- Check git status/diff for modified files
- Review work brief tasks
- Note key decisions made

## Step 3: Create Log

```
mcp__openspec-flow__create_flow_log({
  change_id: "$ARGUMENTS",
  status: "complete",
  summary: "<implementation summary>",
  files_modified: ["<files from git>"]
})
```

The log documents:
- Implementation summary
- Files modified
- Completion status
- Artifact locations

## Next Steps

- Review log for accuracy
- Create git commit
- Archive the change if complete
