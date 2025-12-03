---
description: Review an OpenSpec implementation against requirements
argument-hint: "<change-id>"
---

# Review Change: $ARGUMENTS

## Step 1: Get Context

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

## Step 2: Review Checklist

Check the implementation against:

**Requirements**
- [ ] All tasks from work brief addressed
- [ ] Spec requirements met
- [ ] No missing functionality

**Architecture**
- [ ] Follows project patterns (from CLAUDE.md)
- [ ] Correct layer separation
- [ ] No architecture violations

**Code Quality**
- [ ] Proper error handling
- [ ] No magic strings/numbers
- [ ] Appropriate logging

**Constraints**
- [ ] Project constraints respected
- [ ] No security issues

## Step 3: Report

Provide review summary:
- Passed checks
- Failed checks with specific issues
- Recommendations

## Next Steps

- `/verify $ARGUMENTS` for E2E testing
- `/deferred $ARGUMENTS` for incomplete items
