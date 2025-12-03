# OpenSpec-Flow Integration - Internal Notes

**Date**: 2025-11-15
**Purpose**: Integration of OpenSpec change management with Claude-Flow automation

## Discovery Summary

### Repository State
- **Phase**: Pre-implementation / Planning
- **No existing code projects**: No .csproj, .sln, or package.json detected
- **Existing structure**:
  - ✓ `openspec/` - OpenSpec change management system
  - ✓ `CLAUDE.md` - Claude Code orchestration document
  - ✓ `docs/project-context.md` - Comprehensive tech stack and requirements
  - ✓ `.claude-flow/` - Claude-Flow runtime directory with metrics

### Technology Stack (from project-context.md)
The AppName project will be built with:
- **.NET 10 (LTS)** with Minimal APIs, C# 14
- **.NET Aspire** for orchestration
- **PostgreSQL 15+** with EF Core
- **RabbitMQ** (dev) / **Azure Service Bus** (prod)
- **Azure Blob Storage** (Azurite for local)
- **Outbox/Inbox patterns** for reliable event handling
- **DDD + Vertical Slice Architecture**

## Tooling Decision

**Choice**: Node.js + TypeScript

**Rationale**:
1. No existing tooling infrastructure in the repo
2. Node/TS is lightweight and common for CLI tools
3. Easy integration with npm scripts
4. Fast iteration for automation/glue code
5. Good support for file system operations and markdown parsing
6. Claude-Flow integration can use local file-based workflows

**Structure**:
```
tooling/openspec-flow/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── commands/         # Command implementations
│   │   ├── list.ts       # List changes
│   │   ├── work.ts       # Generate work brief
│   │   └── implement.ts  # Run Claude-Flow implementation
│   ├── utils/            # Utilities
│   │   ├── openspec.ts   # OpenSpec file readers
│   │   ├── workbriefGenerator.ts  # Work brief creation
│   │   └── claudeFlow.ts # Claude-Flow invocation
│   └── types.ts          # TypeScript interfaces
├── package.json
├── tsconfig.json
└── INTERNAL-NOTES.md (this file)
```

## Integration Points

### 1. OpenSpec Structure (READ-ONLY)
- `openspec/changes/<CHANGE_ID>/proposal.md`
- `openspec/changes/<CHANGE_ID>/tasks.md`
- `openspec/changes/<CHANGE_ID>/design.md` (optional)
- `openspec/specs/<CAPABILITY>/spec.md`

### 2. Generated Artifacts (WRITE)
- `openspec/changes/<CHANGE_ID>/work-brief.md` - Generated context for Claude-Flow
- `openspec/changes/<CHANGE_ID>/flow-log.md` - Implementation log from Claude-Flow

### 3. Context Documents (READ-ONLY)
- `CLAUDE.md` - High-level Claude Code guidance
- `docs/project-context.md` - Tech stack and architecture

### 4. Claude-Flow Configuration
- `claude-flow/flows/openspec-implementation.yaml` - Flow definition
- `claude-flow/prompts/` - System prompts for phases

## Work Brief Template

The work brief generation will include:
- **Header**: Change ID, timestamp
- **Summary**: From proposal.md
- **Tasks**: Individual tasks with checkboxes
- **Impacted Specs**: Referenced spec files
- **Architecture Context**: .NET 10/Aspire/PostgreSQL/RabbitMQ/Blob/Outbox-Inbox
- **Tech Stack References**: Direct links to project-context.md
- **Constraints**: From CLAUDE.md

## Claude-Flow Phases

Planned flow: `openspec-implementation`

1. **Context Loader**: Load work brief, CLAUDE.md, project-context.md
2. **Planner**: Create implementation plan (.NET 10, EF Core, Aspire, messaging)
3. **Implementer**: Execute changes (code, migrations, config)
4. **Reviewer**: Verify against spec and architecture
5. **Summarizer**: Write flow-log.md

## Future Enhancements (Out of Scope for Initial Implementation)
- [ ] Parse task status from tasks.md (TODO/DONE markers)
- [ ] Auto-update task completion status
- [ ] GitHub Actions integration
- [ ] JSON output mode for programmatic use
- [ ] Spec dependency graph analysis
- [ ] Integration with OpenSpec archive command

## Assumptions
- OpenSpec CLI already exists and is properly configured
- Claude-Flow is installed and accessible
- User will manually create OpenSpec changes using OpenSpec CLI
- Flow execution is synchronous (no background job queue)
