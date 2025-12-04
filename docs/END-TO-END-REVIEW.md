# OpenSpec-Flow End-to-End Review

**Date**: 2025-12-04
**Version**: 0.2.0-alpha
**Status**: Review Document - Pending Approval

---

## Part 1: Code Quality Review

### 1.1 TypeScript & Type Safety
**Status**: EXCELLENT
- TypeScript compilation: Clean (0 errors)
- All imports use `.js` extensions (ESM compliance)
- Proper type interfaces defined in `src/types.ts`
- No commented-out code or debug statements

### 1.2 Issues Found

| Priority | File | Line | Issue | Fix |
|----------|------|------|-------|-----|
| Minor | `src/setup.ts` | 19 | Unused import `getConfigPath` | Remove from import |
| Minor | `commands/osf-help.md` | 1-3 | Missing `allowed-tools` frontmatter | Add frontmatter |
| Minor | `src/mcp/server.ts` | 567 | Version `0.2.0` should be `0.2.0-alpha` | Update string |

### 1.3 Documentation Gaps

| File | Issue |
|------|-------|
| `CLAUDE.md` | Missing `/ideate`, `/analyze`, `/split` from commands list |
| `CLAUDE.md` | MCP tools table shows 5, actual is 9 (missing scaffold_change, save_change_artifact, analyze_change, split_change) |

---

## Part 2: Functionality Review

### 2.1 MCP Tools (9 total)
All properly registered and have handlers:

| Tool | Handler | Lines |
|------|---------|-------|
| `list_changes` | `handleListChanges()` | 210 |
| `generate_work_brief` | `handleGenerateWorkBrief()` | 224 |
| `get_change_context` | `handleGetChangeContext()` | 236 |
| `analyze_deferred` | `handleAnalyzeDeferred()` | 306 |
| `create_flow_log` | `handleCreateFlowLog()` | 345 |
| `scaffold_change` | `handleScaffoldChange()` | 388 |
| `save_change_artifact` | `handleSaveChangeArtifact()` | 464 |
| `analyze_change` | `handleAnalyzeChange()` | 498 |
| `split_change` | `handleSplitChange()` | 502 |

### 2.2 Slash Commands (11 total)
All properly configured with correct MCP tool references.

### 2.3 Edge Case Handling
- Missing `openspec/changes/`: Returns empty list (graceful)
- Malformed config files: Caught, defaults applied, warning shown
- Empty change directories: Handled with fallbacks
- Invalid change IDs: Proper error messages

---

## Part 3: Gap Analysis - /archive Command

### 3.1 Current State

The archive directory is **already referenced** in the codebase:

```typescript
// src/utils/openspec.ts:24
if (!entry.isDirectory() || entry.name === 'archive') {
  continue;  // Skip archive directory
}
```

**Expected structure:**
```
openspec/
└── changes/
    ├── active-change-1/
    ├── active-change-2/
    └── archive/           <-- Already filtered from listings
        ├── archived-change-1/
        └── archived-change-2/
```

### 3.2 Missing Functionality

Currently there is **no way to**:
1. Move a completed change to archive
2. Document deferred items before archiving
3. Track why a change was archived
4. Generate archive metadata

### 3.3 Related Existing Patterns

#### Deferred Task Analysis (`analyze_deferred` tool)
```typescript
// src/mcp/server.ts:306-343
async function handleAnalyzeDeferred(params: { change_id: string }) {
  // Returns: changeId, summary (total, completed, incomplete), deferred items
}
```

#### Task Completion Detection
```typescript
// src/utils/openspec.ts:66-78
if (tasksCompleted === tasksTotal) {
  status = 'done';
} else {
  status = 'in-progress';
}
```

#### /deferred Command Workflow (commands/deferred.md)
1. Call `analyze_deferred` with change_id
2. Display completion percentages
3. Categorize incomplete items by priority
4. Offer next steps (including "Archive with documented deferrals")

---

## Part 4: /archive Command Specification

### 4.1 Proposed MCP Tool

**Name**: `archive_change`

**Input Schema**:
```typescript
{
  change_id: string;        // Required: The OpenSpec change ID
  reason: string;           // Required: 'completed' | 'deferred' | 'superseded' | 'abandoned'
  deferred_summary?: string; // Optional: Summary of deferred items
  notes?: string;           // Optional: Additional context
}
```

**Output**:
```typescript
{
  success: boolean;
  changeId: string;
  originalPath: string;
  archivePath: string;
  reason: string;
  archivedAt: string;       // ISO timestamp
  summary: {
    tasksTotal: number;
    tasksCompleted: number;
    deferredCount: number;
  };
  metadata: {
    reason: string;
    notes?: string;
    deferredItems?: string[];
  };
}
```

### 4.2 Proposed /archive Command Workflow

**File**: `commands/archive.md`

```markdown
---
description: Archive a completed or closed OpenSpec change
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, mcp__openspec-flow__analyze_deferred, mcp__openspec-flow__archive_change
---

# Archive Change: $ARGUMENTS

## Step 1: Get Change Context

Call:
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })

Display current status:
- Change title
- Task completion (X of Y completed)
- Has work brief?
- Has design doc?

## Step 2: Analyze Deferred Items

Call:
mcp__openspec-flow__analyze_deferred({ change_id: "$ARGUMENTS" })

If there are incomplete tasks:
- List each deferred item
- Ask user to confirm these will be documented
- Suggest creating follow-up changes for critical items

## Step 3: Determine Archive Reason

Ask user to select reason:
| Reason | When to Use |
|--------|-------------|
| `completed` | All tasks done, change fully implemented |
| `deferred` | Some tasks remain, documented for later |
| `superseded` | Replaced by another change |
| `abandoned` | No longer relevant, not implementing |

## Step 4: Document Deferrals (if applicable)

If reason is `deferred` or `abandoned` with incomplete tasks:
- Generate deferred-items.md with:
  - List of incomplete tasks
  - Priority assessment
  - Suggested follow-up actions
  - Context for future reference

## Step 5: Execute Archive

Call:
mcp__openspec-flow__archive_change({
  change_id: "$ARGUMENTS",
  reason: "<selected_reason>",
  deferred_summary: "<if applicable>",
  notes: "<user notes>"
})

## Step 6: Confirm Result

Display:
- Original location: `openspec/changes/{id}/`
- Archive location: `openspec/changes/archive/{id}/`
- Archive metadata created
- Completion summary

## Next Steps

- `/list-specs` - View remaining active changes
- Review `openspec/changes/archive/` for archived items
```

### 4.3 Archive Metadata Format

Create `archive-metadata.yaml` in archived change directory:

```yaml
archived_at: "2025-12-04T10:30:00Z"
reason: completed | deferred | superseded | abandoned
original_path: openspec/changes/my-change/
archived_by: openspec-flow

summary:
  tasks_total: 15
  tasks_completed: 12
  deferred_count: 3

deferred_items:
  - description: "Add error handling for edge case X"
    priority: medium
  - description: "Update documentation for new API"
    priority: low
  - description: "Performance optimization for large datasets"
    priority: low

notes: |
  Core functionality complete. Deferred items are nice-to-haves
  that can be addressed in future iterations.
```

### 4.4 Handler Implementation Outline

```typescript
// Add to src/mcp/server.ts

async function handleArchiveChange(params: {
  change_id: string;
  reason: 'completed' | 'deferred' | 'superseded' | 'abandoned';
  deferred_summary?: string;
  notes?: string;
}): Promise<unknown> {
  const { change_id, reason, deferred_summary, notes } = params;

  // 1. Load and verify change exists
  const change = loadChange(change_id);
  const changePath = join('openspec/changes', change_id);
  const archivePath = join('openspec/changes/archive', change_id);

  // 2. Get task summary
  const deferred = await handleAnalyzeDeferred({ change_id });

  // 3. Validate archive criteria
  if (reason === 'completed' && deferred.summary.incomplete > 0) {
    // Warn but allow - user confirmed
  }

  // 4. Create archive directory if needed
  mkdirSync('openspec/changes/archive', { recursive: true });

  // 5. Create archive metadata
  const metadata = {
    archived_at: new Date().toISOString(),
    reason,
    original_path: changePath,
    summary: deferred.summary,
    deferred_items: deferred.deferred,
    notes,
  };

  // 6. Write metadata file
  writeFileSync(
    join(changePath, 'archive-metadata.yaml'),
    stringifyYaml(metadata)
  );

  // 7. Move directory to archive
  renameSync(changePath, archivePath);

  // 8. Return result
  return {
    success: true,
    changeId: change_id,
    originalPath: changePath,
    archivePath,
    reason,
    archivedAt: metadata.archived_at,
    summary: deferred.summary,
    metadata,
  };
}
```

### 4.5 Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/mcp/server.ts` | Modify | Add `archive_change` to TOOLS array, add handler |
| `src/types.ts` | Modify | Add `ArchiveResult` interface |
| `commands/archive.md` | Create | New slash command |
| `src/setup.ts` | Modify | Add `archive.md` to commandsToRemove list |
| `src/index.ts` | Modify | Add `/archive` to help text |
| `commands/osf-help.md` | Modify | Add `/archive` to command table |
| `README.md` | Modify | Add `/archive` to commands table |
| `CLAUDE.md` | Modify | Add `/archive` to commands list |

### 4.6 Validation Rules

| Scenario | Behavior |
|----------|----------|
| Change not found | Error: "Change not found: {id}" |
| Already archived | Error: "Change already archived" |
| reason=completed with incomplete tasks | Warning, allow with confirmation |
| reason=deferred without documenting | Require deferred_summary |
| Archive directory doesn't exist | Create it automatically |

---

## Part 5: Recommendations Summary

### 5.1 Immediate Fixes (Before Commit)

1. **Add `allowed-tools` to osf-help.md**
2. **Remove unused import `getConfigPath` from setup.ts**
3. **Update version in server.ts to match package.json**

### 5.2 Documentation Updates

1. **Update CLAUDE.md** with complete command/tool lists
2. **Update README.md** with `/archive` after implementation

### 5.3 New Feature: /archive Command

Implement as described in Part 4 above:
- New MCP tool: `archive_change`
- New slash command: `commands/archive.md`
- Archive metadata format in YAML
- Proper deferred item documentation

---

## Part 6: Implementation Order (Suggested)

1. Fix immediate issues (3 items)
2. Update CLAUDE.md documentation
3. Implement `archive_change` MCP tool
4. Create `commands/archive.md`
5. Update help text and README
6. Test full workflow
7. Commit with descriptive message

---

## Appendix: Code References

### Key Files
- MCP Server: `src/mcp/server.ts`
- Types: `src/types.ts`
- OpenSpec Utils: `src/utils/openspec.ts`
- Setup: `src/setup.ts`
- Entry Point: `src/index.ts`

### Existing Patterns to Follow
- Tool registration: lines 32-204 of server.ts
- Handler dispatch: lines 515-550 of server.ts
- Command frontmatter: see `commands/split.md`
- File operations: see `src/utils/splitter.ts`
