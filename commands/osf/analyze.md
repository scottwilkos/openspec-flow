---
# openspec-flow-command: v0.2.4
description: Analyze an OpenSpec change for size and complexity
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__analyze_change
---

# Analyze Change: $ARGUMENTS

Analyze the change for size, complexity, and splitting recommendations.

## Step 1: Run Analysis

```
mcp__openspec-flow__analyze_change({ change_id: "$ARGUMENTS" })
```

## Step 2: Display Results

Present the analysis in a clear format:

### Metrics Summary

| Metric | Value |
|--------|-------|
| Tasks | X total (Y completed) |
| Token Estimate | ~N tokens |
| Spec Deltas | X files |
| Has Design | Yes/No |

### Sizing Assessment

Display the sizing level with appropriate indicator:
- **GREEN** - Small, implement directly
- **YELLOW** - Medium, consider splitting
- **RED** - Large, splitting recommended

Include the recommendation text from the analysis.

### Complexity Factors

List any detected complexity factors:
- Factor name: evidence found

### Suggested Phase Boundaries

If the sizing is yellow or red, display the suggested phases:

| Phase | Description | Tasks |
|-------|-------------|-------|
| 1 | Phase description | [task indices] |
| 2 | Phase description | [task indices] |

## Next Steps

Based on the sizing level, suggest:

**If GREEN:**
- `/osf:work $ARGUMENTS` to generate work brief
- `/osf:implement $ARGUMENTS` to begin implementation

**If YELLOW:**
- Consider `/osf:split $ARGUMENTS` to decompose into phases
- Or proceed with `/osf:implement $ARGUMENTS` if manageable

**If RED:**
- Use `/osf:split $ARGUMENTS` to decompose into phases
- Implement each phase separately
