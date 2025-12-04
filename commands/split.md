---
description: Split a large OpenSpec change into phased sub-changes
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__analyze_change, mcp__openspec-flow__split_change
---

# Split Change: $ARGUMENTS

Decompose a large OpenSpec change into manageable phased sub-changes.

## Step 1: Analyze the Change

First, analyze to get sizing and suggested phase boundaries:

```
mcp__openspec-flow__analyze_change({ change_id: "$ARGUMENTS" })
```

## Step 2: Review Suggested Phases

Display the suggested phase breakdown:

| Phase | Description | Tasks | Count |
|-------|-------------|-------|-------|
| 1 | Description | [indices] | N |
| 2 | Description | [indices] | N |

## Step 3: Confirm with User

Ask the user to confirm or modify:
- Are the phase boundaries appropriate?
- Should any tasks be moved between phases?
- Are the phase descriptions accurate?

**Wait for user confirmation before proceeding.**

## Step 4: Execute Split

Create the phased sub-changes:

```
mcp__openspec-flow__split_change({
  change_id: "$ARGUMENTS",
  phases: [
    { description: "Phase 1 description", task_indices: [1, 2, 3, ...] },
    { description: "Phase 2 description", task_indices: [4, 5, 6, ...] }
  ]
})
```

## Step 5: Display Results

Show the created phases:

| Phase | Change ID | Tasks | Depends On |
|-------|-----------|-------|------------|
| 1 | $ARGUMENTS-phase1 | N | - |
| 2 | $ARGUMENTS-phase2 | M | phase1 |
| 3 | $ARGUMENTS-phase3 | P | phase2 |

Confirm:
- Original change marked as split
- phases.yaml manifest created
- Each phase is a standalone OpenSpec change

## Next Steps

Implement phases in order:
1. `/work $ARGUMENTS-phase1` to generate work brief
2. `/implement $ARGUMENTS-phase1` to implement first phase
3. After phase1 complete, proceed to phase2
4. Continue until all phases complete

## Notes

- Original change is preserved (not deleted) for audit trail
- Each phase depends on the previous phase
- The phases.yaml manifest tracks the split relationship
