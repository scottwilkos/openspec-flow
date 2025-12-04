# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Build Commands

```bash
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type check without emitting
npm run dev        # Watch mode compilation
npm run clean      # Remove dist/
```

## Architecture

OpenSpec-Flow bridges OpenSpec (specification-driven change management) with Claude Flow (multi-agent orchestration) via Claude Code. It provides:
1. MCP server with tools for change operations
2. Slash commands for user interaction
3. Setup/uninstall commands for installation

### Structure

```
openspec-flow/
├── src/
│   ├── index.ts           # Entry point (MCP server + CLI)
│   ├── setup.ts           # Setup/uninstall logic
│   ├── mcp/server.ts      # MCP server implementation
│   ├── types.ts           # TypeScript interfaces
│   └── utils/
│       ├── openspec.ts        # OpenSpec file readers
│       ├── workbriefGenerator.ts
│       ├── configLoader.ts
│       └── configSchema.ts
├── commands/              # Slash command files
├── dist/                  # Compiled output
└── package.json
```

### Entry Points

- `openspec-flow` (default) - Starts MCP server
- `openspec-flow setup` - Installs to .claude/
- `openspec-flow setup -g` - Installs to ~/.claude/
- `openspec-flow uninstall` - Removes installation

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_changes` | List all OpenSpec changes |
| `generate_work_brief` | Create work brief |
| `get_change_context` | Get full context (paths + summary) |
| `scaffold_change` | Create new change directory |
| `save_change_artifact` | Save proposal/tasks/design/spec files |
| `analyze_change` | Analyze size and complexity |
| `split_change` | Split into phased sub-changes |
| `analyze_deferred` | Analyze incomplete tasks |
| `create_flow_log` | Create implementation log |
| `archive_change` | Archive completed/closed change |

### Slash Commands

Commands in `commands/` are copied to `.claude/commands/` during setup:
- `ideate.md` - Create change from requirements
- `list-specs.md` - List changes
- `work.md` - Generate work brief
- `analyze.md` - Analyze complexity
- `split.md` - Split large changes
- `implement.md` - Multi-agent implementation
- `verify.md` - Multi-agent verification
- `review.md` - Multi-agent review
- `deferred.md` - Analyze incomplete tasks
- `log.md` - Create flow log
- `archive.md` - Archive completed change
- `osf-help.md` - Help reference

## ESM Module Format

This project uses ESM (`"type": "module"`). All imports require `.js` extensions:
```typescript
import { loadConfig } from './utils/configLoader.js';
```
