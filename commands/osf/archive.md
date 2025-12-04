---
# openspec-flow-command: v0.2.4
description: Archive a completed or closed OpenSpec change
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, mcp__openspec-flow__analyze_deferred, mcp__openspec-flow__archive_change
---

# Archive Change: $ARGUMENTS

Archive an OpenSpec change to `openspec/changes/archive/`.

## Step 1: Get Change Context

Call `mcp__openspec-flow__get_change_context` with change_id: "$ARGUMENTS"

Display:
- Change title
- Task completion (X of Y tasks completed)
- Has work brief?
- Has design doc?

## Step 2: Analyze Deferred Items

Call `mcp__openspec-flow__analyze_deferred` with change_id: "$ARGUMENTS"

If there are incomplete tasks:
- List each incomplete task
- Ask user to confirm these will be documented as deferred
- Suggest creating follow-up changes for critical items

## Step 3: Determine Archive Reason

Ask the user to select an archive reason:

| Reason | When to Use |
|--------|-------------|
| `completed` | All tasks done, change fully implemented |
| `deferred` | Some tasks remain, documented for later |
| `superseded` | Replaced by another change |
| `abandoned` | No longer relevant, not implementing |

## Step 4: Document Deferrals (if applicable)

If reason is `deferred` or `abandoned` with incomplete tasks:
- Generate a summary of deferred items
- Include priority assessment if possible
- Document context for future reference

## Step 5: Execute Archive

Call `mcp__openspec-flow__archive_change` with:
- change_id: "$ARGUMENTS"
- reason: <selected_reason>
- skip_specs: <true if no spec deltas to merge>
- notes: <any additional context>

## Step 6: Confirm Result

Display:
- Original location: `openspec/changes/{id}/`
- Archive location: `openspec/changes/archive/YYYY-MM-DD-{id}/`
- Archive metadata created
- Completion summary (X of Y tasks completed)

## Next Steps

After archiving:
- `/osf:list` - View remaining active changes
- Review `openspec/changes/archive/` for archived items
