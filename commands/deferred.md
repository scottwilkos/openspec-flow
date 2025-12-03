---
description: Analyze incomplete tasks for an OpenSpec change
argument-hint: "<change-id>"
---

# Analyze Deferred Items: $ARGUMENTS

Analyze incomplete tasks:

```
mcp__openspec-flow__analyze_deferred({ change_id: "$ARGUMENTS" })
```

Display the results showing:
- Total tasks vs completed
- Percentage complete
- List of incomplete items

Categorize deferred items by:
- **Critical**: Blocks other work, security-related
- **High**: Core functionality
- **Medium**: Nice-to-have
- **Low**: Documentation, future enhancement

Offer next steps:
- Create follow-up changes for critical items
- Re-prioritize remaining tasks
- Archive with documented deferrals
