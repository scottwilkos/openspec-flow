---
description: Implement an OpenSpec change
argument-hint: "<change-id>"
---

# Implement Change: $ARGUMENTS

## Step 1: Get Context

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

If no work brief exists, generate one first:
```
mcp__openspec-flow__generate_work_brief({ change_id: "$ARGUMENTS" })
```

## Step 2: Implement

Read the work brief and implement each task:
1. Follow the task checklist in order
2. Respect project patterns and constraints
3. Run build verification after each major change

## Step 3: Document

After implementation, create a flow log:
```
mcp__openspec-flow__create_flow_log({
  change_id: "$ARGUMENTS",
  status: "complete",
  summary: "<summary of what was implemented>",
  files_modified: ["<list of modified files>"]
})
```

## Next Steps

- `/verify $ARGUMENTS` for E2E testing
- `/deferred $ARGUMENTS` to check incomplete items
