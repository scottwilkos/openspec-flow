---
description: Generate a work brief for an OpenSpec change
argument-hint: "<change-id>"
---

# Generate Work Brief: $ARGUMENTS

Generate the work brief:

```
mcp__openspec-flow__generate_work_brief({ change_id: "$ARGUMENTS" })
```

After generation, read the work brief from the returned path and summarize:
- Change overview
- Implementation tasks
- Tech stack requirements
- Constraints

Offer next steps:
- `/implement $ARGUMENTS` to start implementation
- Review specific tasks in detail
