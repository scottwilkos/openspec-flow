#!/usr/bin/env node

/**
 * OpenSpec-Flow
 * Claude Code plugin for OpenSpec change management
 *
 * Usage:
 *   openspec-flow          - Start MCP server (default, used by Claude Code)
 *   openspec-flow setup    - Install slash commands and configure MCP
 *   openspec-flow setup --global  - Install globally to ~/.claude/
 *   openspec-flow uninstall - Remove installed commands and MCP config
 */

import { startMCPServer } from './mcp/server.js';
import { runSetup, runUninstall } from './setup.js';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'setup':
    const isGlobal = args.includes('--global') || args.includes('-g');
    runSetup(isGlobal);
    break;

  case 'uninstall':
    const uninstallGlobal = args.includes('--global') || args.includes('-g');
    runUninstall(uninstallGlobal);
    break;

  case '--help':
  case '-h':
    console.log(`
openspec-flow - Bridges OpenSpec + Claude Flow via Claude Code

Usage:
  openspec-flow              Start MCP server (used by Claude Code)
  openspec-flow setup        Install to current project
                             - Commands: .claude/commands/
                             - MCP config: .mcp.json
  openspec-flow setup -g     Install globally
                             - Commands: ~/.claude/commands/
                             - MCP config: ~/.claude.json
  openspec-flow uninstall    Remove from current project
  openspec-flow uninstall -g Remove global installation

After setup, use slash commands in Claude Code:
  /list-specs       List all OpenSpec changes
  /work <id>        Generate work brief
  /implement <id>   Run implementation via claude-flow
  /verify <id>      E2E verification via claude-flow
  /review <id>      Code review via claude-flow
  /deferred <id>    Analyze incomplete tasks
`);
    break;

  default:
    // Default: start MCP server
    startMCPServer();
}
