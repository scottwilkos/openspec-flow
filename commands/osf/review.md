---
# openspec-flow-command: v0.3.0
description: Review an OpenSpec implementation via claude-flow multi-agent swarm
argument-hint: "<change-id>"
allowed-tools: mcp__openspec-flow__get_change_context, Bash(npx claude-flow@alpha *)
---

# Review Change: $ARGUMENTS

## How This Command Works

This command delegates ALL code review work to claude-flow. You are the **orchestrator** - your job is to:

1. Gather context from openspec-flow MCP tools
2. Invoke claude-flow to spawn a multi-agent swarm that performs code review
3. Wait for the swarm to complete
4. Report the review findings to the user

**You do NOT read or analyze code directly. The claude-flow swarm does all review work.**

claude-flow agents operate in **read-only analysis mode** - they can read code, analyze patterns, and generate reports, but they cannot modify any files. This ensures a safe, non-destructive review process.

---

## Step 1: Get Change Context

First, retrieve the change context to understand what was implemented:

```
mcp__openspec-flow__get_change_context({ change_id: "$ARGUMENTS" })
```

This returns:
- `paths.root` - The change directory (e.g., `openspec/changes/005-feature-name/`)
- `paths.workBrief` - Path to work-brief.md
- `paths.proposal` - Path to proposal.md with requirements
- `paths.tasks` - Path to tasks.md
- `paths.design` - Path to design.md (if exists)
- `summary.taskCount` - Total number of tasks
- `summary.percentComplete` - Completion percentage

**Store the `paths.root` value - you will need it for Step 2.**

---

## Step 2: Invoke claude-flow to Review

Now invoke claude-flow to spawn a multi-agent swarm that will review the implementation.

**Run this exact command via Bash**, replacing `<CHANGE_DIR>` with the `paths.root` value from Step 1:

```bash
npx claude-flow@alpha swarm "Review OpenSpec change $ARGUMENTS. All context is in <CHANGE_DIR> - read work-brief.md and proposal.md for requirements. Perform comprehensive code review checking: 1) Requirements compliance - all proposal requirements met, 2) Architecture patterns - follows project conventions, 3) Security - no OWASP vulnerabilities, proper input validation, secure data handling, 4) Code quality - error handling, no magic values, appropriate logging, clean code. Generate detailed findings report." --strategy analysis --max-agents 4 --read-only
```

**Example with actual path:**
```bash
npx claude-flow@alpha swarm "Review OpenSpec change 005-add-two-factor-auth. All context is in openspec/changes/005-add-two-factor-auth/ - read work-brief.md and proposal.md for requirements. Perform comprehensive code review checking: 1) Requirements compliance - all proposal requirements met, 2) Architecture patterns - follows project conventions, 3) Security - no OWASP vulnerabilities, proper input validation, secure data handling, 4) Code quality - error handling, no magic values, appropriate logging, clean code. Generate detailed findings report." --strategy analysis --max-agents 4 --read-only
```

**What this does:**
- `swarm` - Spawns a coordinated multi-agent team
- `--strategy analysis` - Configures agents for code analysis and review
- `--max-agents 4` - Uses 4 specialized review agents
- `--read-only` - **Critical**: Prevents any code modifications during review

**What the agents will do:**
1. Navigate to the change directory
2. Read `work-brief.md` to understand the implementation requirements
3. Read `proposal.md` to understand the business requirements
4. Read `design.md` for architectural decisions (if exists)
5. Analyze the implemented code against requirements
6. Check for security vulnerabilities (OWASP Top 10)
7. Verify architecture pattern compliance
8. Assess code quality and maintainability
9. Generate comprehensive findings report

**The `--read-only` flag ensures agents CANNOT modify any files** - they can only read and analyze.

**IMPORTANT**: This command spawns claude-flow agents that do the actual review.
Wait for the swarm to complete before proceeding to Step 3.

---

## Step 3: Report Review Findings

After the swarm completes, provide a comprehensive review summary to the user:

**Code Review Results: $ARGUMENTS**

### Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Requirements Compliance | ✅/⚠️/❌ | X issues |
| Architecture Patterns | ✅/⚠️/❌ | X issues |
| Security | ✅/⚠️/❌ | X issues |
| Code Quality | ✅/⚠️/❌ | X issues |

**Overall Assessment**: Ready for merge / Needs attention / Requires rework

---

### Requirements Compliance

**Status**: ✅ All requirements met / ⚠️ Minor gaps / ❌ Critical gaps

| Requirement | Status | Notes |
|-------------|--------|-------|
| Requirement 1 from proposal | ✅/❌ | Implementation details |
| Requirement 2 from proposal | ✅/❌ | Implementation details |
| ... | ... | ... |

**Findings:**
- List specific compliance issues or "All requirements properly implemented"

---

### Architecture Patterns

**Status**: ✅ Compliant / ⚠️ Minor deviations / ❌ Violations

**Patterns Checked:**
- Layer separation (presentation, business, data)
- Dependency injection usage
- Repository/service patterns
- Error handling patterns
- Configuration management

**Findings:**
- List any pattern violations or "All patterns correctly followed"

---

### Security Review

**Status**: ✅ Secure / ⚠️ Minor concerns / ❌ Vulnerabilities found

**OWASP Top 10 Checks:**
| Vulnerability | Status | Notes |
|---------------|--------|-------|
| Injection (SQL, Command, etc.) | ✅/❌ | Details |
| Broken Authentication | ✅/❌ | Details |
| Sensitive Data Exposure | ✅/❌ | Details |
| XML External Entities (XXE) | ✅/❌ | Details |
| Broken Access Control | ✅/❌ | Details |
| Security Misconfiguration | ✅/❌ | Details |
| Cross-Site Scripting (XSS) | ✅/❌ | Details |
| Insecure Deserialization | ✅/❌ | Details |
| Using Components with Vulnerabilities | ✅/❌ | Details |
| Insufficient Logging | ✅/❌ | Details |

**Findings:**
- List specific security concerns or "No security issues identified"

---

### Code Quality

**Status**: ✅ High quality / ⚠️ Acceptable / ❌ Needs improvement

**Quality Checks:**
- Error handling completeness
- Magic numbers/strings usage
- Code documentation
- Logging appropriateness
- Test coverage
- Code complexity
- Naming conventions

**Findings:**
- List specific quality issues or "Code quality is excellent"

---

### Recommendations

**Critical (must fix before merge):**
1. List critical issues that block merge

**Important (should fix):**
1. List important improvements

**Nice to have (future consideration):**
1. List minor suggestions

---

## Next Steps

Based on review results, suggest appropriate follow-up:

**If review passes:**
- `/osf:archive $ARGUMENTS` - Archive the completed change
- Proceed with merge/deployment

**If there are issues:**
- `/osf:implement $ARGUMENTS` - Address critical issues
- `/osf:verify $ARGUMENTS` - Re-verify after fixes
- Then re-run `/osf:review $ARGUMENTS`

---

## Troubleshooting

**If review seems incomplete:**
- Ensure the change directory has all required files
- Check that work-brief.md and proposal.md exist
- Verify the swarm completed without errors

**If security review flags false positives:**
- Review the specific findings in context
- Document exceptions in design.md if intentional

**If claude-flow fails to start:**
- Ensure claude-flow is installed: `npx claude-flow@alpha --version`
- Check that the change directory exists

**Note on read-only mode:**
The `--read-only` flag is intentional and critical. Review agents should never modify code.
If modifications are needed, use `/osf:implement $ARGUMENTS` instead.
