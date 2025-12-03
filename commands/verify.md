---
description: Verify an OpenSpec implementation
argument-hint: "<change-id>"
---

# Verify Change: $ARGUMENTS

## Step 1: Get Context

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

## Step 2: Build Verification

Run the project build command and verify:
- No compilation errors
- No type errors
- Tests pass

## Step 3: Requirements Check

Review the tasks from the change context:
- Check each task marked complete is actually implemented
- Verify requirements from proposal are met
- Identify any gaps

## Step 4: Report

Provide a verification summary:
- Build status (pass/fail)
- Tasks verified
- Gaps identified
- Recommendations

## Next Steps

- `/deferred $ARGUMENTS` to analyze incomplete items
- Address any critical gaps before closing
