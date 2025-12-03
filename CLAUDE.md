# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run typecheck      # Type check without emitting
npm run dev            # Watch mode compilation
npm run clean          # Remove dist/
```

## Architecture Overview

OpenSpec-Flow is a CLI tool that bridges OpenSpec change management with Claude-Flow multi-agent automation. It reads OpenSpec proposals/tasks, generates work briefs, and orchestrates implementation via swarm-based agent execution.

### Core Flow

1. **OpenSpec Reading** (`src/utils/openspec.ts`) - Reads from `openspec/changes/<CHANGE_ID>/` structure (proposal.md, tasks.md, design.md)
2. **Work Brief Generation** (`src/utils/workbriefGenerator.ts`) - Creates implementation context documents
3. **Flow Execution** (`src/utils/flowExecutor.ts`) - Executes YAML flow definitions with multi-phase orchestration
4. **Swarm Coordination** (`src/utils/swarmCoordinator.ts`) - Manages parallel agent execution via MCP bridge

### Key Abstractions

- **FlowDefinition** - YAML-based workflow with phases, inputs, outputs, and dependencies
- **ExecutionPlan** - Dependency-resolved execution order with parallel batches
- **SwarmState** - Multi-agent coordination state (hierarchical/mesh/ring/star topologies)
- **MCP Bridge** (`src/utils/mcpBridge.ts`) - Interface to Claude-Flow MCP server for agent spawning and task orchestration

### Configuration System

Configuration lives in `.openspec-flow/config/` with split YAML files:
- `project.yaml` - Project name, build/test/run commands
- `tech-stack.yaml` - Runtime, database, messaging, storage
- `paths.yaml` - Solution paths, source directories
- `patterns.yaml` - Architecture patterns
- `constraints.yaml` - Project constraints

Loaded via `src/utils/configLoader.ts` with caching and computed values.

### Template System

Templates in `assets/templates/` use `{{ variable }}` interpolation:
- `commands/` - Slash command templates
- `prompts/` - System prompts for flow phases (planner, implementer, reviewer, verifier, summarizer)
- `flows/` - Flow definition templates

### CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize configuration for a project |
| `list` | List all OpenSpec changes |
| `work <id>` | Generate work brief |
| `implement <id>` | Execute implementation flow |
| `batch <ids...>` | Execute multiple changes with hive orchestration |
| `verify <id>` | Run E2E testing and documentation check |
| `deferred <id>` | Generate deferred items report |

### Type System

Core types in `src/types.ts`:
- Change types: `OpenSpecChange`, `ChangeListItem`, `TaskItem`
- Execution types: `ExecutionPlan`, `ExecutionNode`, `ChangeExecutionStatus`
- Swarm types: `SwarmState`, `SwarmAgent`, `BatchExecutionResult`

## ESM Module Format

This project uses ESM (`"type": "module"`). All imports require `.js` extensions:
```typescript
import { loadConfig } from './utils/configLoader.js';
```
