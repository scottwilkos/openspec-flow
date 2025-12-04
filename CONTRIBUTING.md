# Contributing to OpenSpec-Flow

Thank you for your interest in contributing to OpenSpec-Flow. This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm
- Claude Code (for testing slash commands)

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/scottwilkos/openspec-flow.git
cd openspec-flow

# Install dependencies
npm install

# Build
npm run build

# Link for local testing
npm link

# In a test project
npm link openspec-flow
openspec-flow setup
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type check without emitting |
| `npm run dev` | Watch mode compilation |
| `npm run clean` | Remove `dist/` directory |

## Project Structure

```
openspec-flow/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── setup.ts           # Setup/uninstall logic
│   ├── mcp/server.ts      # MCP server and tool handlers
│   ├── types.ts           # TypeScript interfaces
│   └── utils/             # Utility modules
├── commands/osf/          # Slash command templates
├── dist/                  # Compiled output (git-ignored)
└── package.json
```

## How to Contribute

### Reporting Issues

- Check existing issues before creating a new one
- Include reproduction steps
- Include Node.js and npm versions
- Include relevant error messages

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run typecheck` to ensure no type errors
5. Run `npm run build` to verify compilation
6. Commit with a descriptive message
7. Push to your fork
8. Open a Pull Request

### Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation if adding new features
- Add or update slash commands in `commands/osf/` as needed
- Ensure MCP tool schemas match handler implementations

## Code Style

- TypeScript with strict mode
- ESM modules (use `.js` extensions in imports)
- Prefer explicit types over inference for public APIs
- Keep functions focused and small

## Adding New Features

### Adding a New MCP Tool

1. Add tool schema to `TOOLS` array in `src/mcp/server.ts`
2. Add case in `handleToolCall()` switch statement
3. Implement handler function
4. Update README.md with new tool documentation

### Adding a New Slash Command

1. Create `commands/osf/<command>.md`
2. Include the marker comment: `# openspec-flow-command: v<version>`
3. Define frontmatter (description, allowed-tools, argument-hint)
4. Write command instructions
5. Update README.md with new command

## Questions

For questions about contributing, open a GitHub issue with the "question" label.
