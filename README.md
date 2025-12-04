# OpenSpec-Flow

[![Version](https://img.shields.io/badge/version-0.2.0--alpha-blue.svg)](https://github.com/scottwilkos/openspec-flow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **Alpha Software**: APIs may change between versions.

Bridges [OpenSpec](https://openspec.dev/) (specification-driven change management) with [Claude Flow](https://github.com/anthropics/claude-flow) (multi-agent orchestration) via Claude Code. Provides MCP tools and slash commands for automated implementation workflows.

## Installation

```bash
npm install -g openspec-flow
openspec-flow setup
```

For project-local installation:
```bash
npm install -D openspec-flow
npx openspec-flow setup
```

### Required: Claude-Flow MCP

The `/implement`, `/verify`, and `/review` commands require Claude-Flow for multi-agent orchestration:

```bash
claude mcp add claude-flow -- npx @anthropic/claude-flow@alpha mcp start
```

Or add to your `.claude/mcp.json`:
```json
{
  "mcpServers": {
    "claude-flow": {
      "command": "npx",
      "args": ["@anthropic/claude-flow@alpha", "mcp", "start"]
    }
  }
}
```

## What It Does

The `setup` command:
1. Installs slash commands to `.claude/commands/`
2. Configures the MCP server in `.mcp.json` (project) or `~/.claude.json` (global)
3. Checks for claude-flow dependency

## Commands

| Command | Description | Requires Claude-Flow |
|---------|-------------|---------------------|
| `/ideate <req>` | Create new change from requirements | Optional |
| `/list-specs` | List all OpenSpec changes with status | No |
| `/work <id>` | Generate work brief for a change | No |
| `/analyze <id>` | Analyze change size/complexity | No |
| `/split <id>` | Split large change into phases | No |
| `/implement <id>` | Implement via multi-agent swarm | **Yes** |
| `/verify <id>` | Verify implementation via agents | **Yes** |
| `/review <id>` | Review against requirements | **Yes** |
| `/deferred <id>` | Analyze incomplete tasks | No |
| `/log <id>` | Create implementation flow log | No |
| `/archive <id>` | Archive completed/closed change | No |
| `/osf-help` | Help and command reference | No |

## Architecture

```
User: /implement CHANGE-001
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Slash Command (allowed-tools restricted)           │
│  - Can ONLY use: mcp__openspec-flow__*              │
│                  mcp__claude-flow__*                │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  OpenSpec-Flow MCP                                  │
│  - get_change_context → reads spec, tasks, config   │
│  - generate_work_brief → creates implementation doc │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Claude-Flow MCP                                    │
│  - swarm_init → create agent swarm                  │
│  - agent_spawn → spawn coder/tester/reviewer/etc    │
│  - task_orchestrate → coordinate work               │
│  - task_results → collect outcomes                  │
│  - swarm_destroy → cleanup when done                │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Spawned Agents (via claude-flow)                   │
│  - Agents use Read/Edit/Write/Bash for actual work  │
│  - Orchestrated by claude-flow                      │
└─────────────────────────────────────────────────────┘
```

## Workflow

```
1. /ideate "feature"     Create new change from requirements
   OR manually create openspec/changes/<id>/

2. /list-specs           List available changes
3. /analyze CHANGE-001   Check size/complexity
4. /split CHANGE-001     Split if too large (optional)
5. /work CHANGE-001      Generate work brief
6. /implement CHANGE-001 Implement via agent swarm
7. /verify CHANGE-001    Verify via test agents
8. /review CHANGE-001    Review via review agents
9. /deferred CHANGE-001  Check incomplete items
10. /log CHANGE-001      Document implementation
11. /archive CHANGE-001  Archive when done
```

## MCP Tools

The MCP server exposes these tools:

| Tool | Description |
|------|-------------|
| `list_changes` | List all OpenSpec changes |
| `generate_work_brief` | Create work brief for a change |
| `get_change_context` | Get file paths and summary |
| `scaffold_change` | Create new change directory |
| `save_change_artifact` | Save/update change files |
| `analyze_change` | Analyze size and complexity |
| `split_change` | Split into phased sub-changes |
| `analyze_deferred` | Analyze incomplete tasks |
| `create_flow_log` | Create implementation log |
| `archive_change` | Archive completed/closed change |

## OpenSpec Structure

OpenSpec-Flow reads from the standard OpenSpec directory structure:

```
openspec/
└── changes/
    ├── <CHANGE-ID>/
    │   ├── proposal.md     # Change proposal
    │   ├── tasks.md        # Implementation checklist
    │   ├── design.md       # Optional design docs
    │   ├── work-brief.md   # Generated by /work
    │   └── flow-log.md     # Generated by /log
    └── archive/            # Archived changes
        └── <CHANGE-ID>/
            ├── ...
            └── archive-metadata.yaml
```

## Configuration (Optional)

Project configuration in `.openspec-flow/config/`:

```
.openspec-flow/config/
├── project.yaml      # Project name, build/test commands
├── tech-stack.yaml   # Runtime, database, etc.
├── paths.yaml        # Source directories
├── patterns.yaml     # Architecture patterns
└── constraints.yaml  # Project constraints
```

## Uninstall

```bash
openspec-flow uninstall
```

## Requirements

- Node.js >= 18.0.0
- Claude Code
- Claude-Flow MCP (for `/implement`, `/verify`, `/review`)

## License

[MIT](LICENSE) - Scott Wilkos

## Related

- [OpenSpec](https://openspec.dev/) - Specification-driven change management
- [Claude Flow](https://github.com/anthropics/claude-flow) - Multi-agent orchestration
- [Claude Code](https://claude.ai/code) - AI-powered development
