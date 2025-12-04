---
# openspec-flow-command: v0.2.4
description: List all OpenSpec changes with status and task completion
allowed-tools: mcp__openspec-flow__list_changes
---

# List OpenSpec Changes

Call the MCP tool to list all changes:

```
mcp__openspec-flow__list_changes()
```

Display results as a table:
| Change ID | Title | Status | Progress |
|-----------|-------|--------|----------|

Offer next steps:
- `/osf:work <id>` to generate work brief
- `/osf:implement <id>` to start implementation
