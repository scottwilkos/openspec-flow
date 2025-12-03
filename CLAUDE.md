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
| `get_change_context` | Get full context |
| `analyze_deferred` | Analyze incomplete tasks |
| `create_flow_log` | Create implementation log |

### Slash Commands

Commands in `commands/` are copied to `.claude/commands/` during setup:
- `list-specs.md`
- `work.md`
- `implement.md`
- `verify.md`
- `review.md`
- `deferred.md`
- `log.md`
- `osf-help.md`

## ESM Module Format

This project uses ESM (`"type": "module"`). All imports require `.js` extensions:
```typescript
import { loadConfig } from './utils/configLoader.js';
```
