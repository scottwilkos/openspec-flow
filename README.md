# OpenSpec-Flow

[![Version](https://img.shields.io/badge/version-0.1.4--alpha-blue.svg)](https://github.com/scottwilkos/openspec-flow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

> **Alpha Software**: This project is in early development. APIs may change between versions.

CLI tool that bridges [OpenSpec](https://openspec.dev/) change management with [Claude-Flow](https://github.com/ruvnet/claude-flow) multi-agent automation for AI-powered development workflows.

## Overview

OpenSpec-Flow automates the implementation of specification-driven changes by:

- Reading OpenSpec proposals, tasks, and specifications
- Generating comprehensive work briefs with project context
- Orchestrating implementation via Claude-Flow swarm-based agents
- Producing detailed flow logs with audit trails

## Installation

```bash
# Via npm (when published)
npm install -g openspec-flow

# Or from source
git clone https://github.com/scottwilkos/openspec-flow.git
cd openspec-flow
npm install
npm run build
npm link
```

## Quick Start

```bash
# Initialize configuration for your project
openspec-flow init

# List all OpenSpec changes
openspec-flow list

# Generate work brief for a change
openspec-flow work <CHANGE_ID>

# Run full implementation flow
openspec-flow implement <CHANGE_ID>
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize openspec-flow configuration for the current project |
| `list` | List all OpenSpec changes with status and task progress |
| `work <id>` | Generate a work brief for the specified change |
| `implement <id>` | Execute the full Claude-Flow implementation flow |
| `batch <ids...>` | Execute multiple changes with hive orchestration |
| `verify <id>` | Run E2E testing and documentation verification |
| `deferred <id>` | Analyze tasks and generate deferred items report |

### Command Details

#### `openspec-flow init`

Initializes configuration by detecting your project's tech stack and creating config files in `.openspec-flow/config/`.

```bash
openspec-flow init
openspec-flow init --name "My Project" --description "Project description"
openspec-flow init --force  # Overwrite existing config
```

#### `openspec-flow list`

Displays all changes from `openspec/changes/` with:
- Change ID
- Title (from proposal.md)
- Status (TODO / IN PROGRESS / DONE)
- Task completion (X/Y completed)

#### `openspec-flow work <CHANGE_ID>`

Generates a work brief at `openspec/changes/<CHANGE_ID>/work-brief.md` containing:
- Change summary from proposal
- Task checklist
- Impacted specifications
- Architecture context
- Tech stack references
- Project constraints

#### `openspec-flow implement <CHANGE_ID>`

Executes the full implementation flow:
1. Generates work brief
2. Initializes Claude-Flow swarm
3. Runs multi-phase flow (plan, implement, review, verify)
4. Produces flow log at `openspec/changes/<CHANGE_ID>/flow-log.md`

#### `openspec-flow batch <CHANGE_IDS...>`

Executes multiple changes with dependency resolution and parallel agent spawning:

```bash
openspec-flow batch CHANGE-001 CHANGE-002 CHANGE-003
```

Features:
- Automatic dependency graph resolution
- Parallel execution of independent changes
- Hierarchical swarm coordination

## Configuration

Configuration is stored in `.openspec-flow/config/` with split YAML files:

```
.openspec-flow/config/
├── project.yaml      # Project name, build/test/run commands
├── tech-stack.yaml   # Runtime, database, messaging, storage
├── paths.yaml        # Solution paths, source directories
├── patterns.yaml     # Architecture patterns
└── constraints.yaml  # Project constraints
```

## Integration

### OpenSpec

Reads from standard OpenSpec directory structure:

```
openspec/
├── changes/
│   └── <CHANGE_ID>/
│       ├── proposal.md
│       ├── tasks.md
│       └── design.md (optional)
└── specs/
    └── <CAPABILITY>/
        └── spec.md
```

Learn more at [openspec.dev](https://openspec.dev/).

### Claude-Flow

Uses Claude-Flow for multi-agent orchestration via MCP (Model Context Protocol). Supports:
- Swarm topologies: hierarchical, mesh, ring, star
- Agent types: task-orchestrator, coder, tester, reviewer, system-architect
- YAML-based flow definitions with phases and dependencies

Learn more at [github.com/ruvnet/claude-flow](https://github.com/ruvnet/claude-flow).

## Project Structure

```
openspec-flow/
├── src/
│   ├── commands/          # CLI command implementations
│   ├── utils/             # Core utilities
│   │   ├── openspec.ts        # OpenSpec file readers
│   │   ├── workbriefGenerator.ts
│   │   ├── flowExecutor.ts    # YAML flow execution
│   │   ├── swarmCoordinator.ts
│   │   ├── mcpBridge.ts       # Claude-Flow MCP interface
│   │   └── configLoader.ts
│   ├── types.ts           # TypeScript interfaces
│   └── index.ts           # CLI entry point
├── assets/templates/      # Command, prompt, and flow templates
├── package.json
└── tsconfig.json
```

## Development

```bash
# Build
npm run build

# Type check
npm run typecheck

# Watch mode
npm run dev

# Clean
npm run clean
```

## Requirements

- Node.js >= 18.0.0
- [OpenSpec](https://openspec.dev/) (optional peer dependency)
- [Claude-Flow](https://github.com/ruvnet/claude-flow) MCP server (for implementation flows)

## License

[MIT](LICENSE) - Scott Wilkos

## Related Projects

- [OpenSpec](https://openspec.dev/) - Specification-driven change management
- [Claude-Flow](https://github.com/ruvnet/claude-flow) - Multi-agent orchestration framework
