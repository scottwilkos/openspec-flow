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

  case '--version':
  case '-V':
    console.log('0.2.8-alpha');
    break;

  case '--help':
  case '-h':
    console.log(`
openspec-flow - Bridges OpenSpec + Claude Flow via Claude Code

Usage:
  openspec-flow              Start MCP server (used by Claude Code)
  openspec-flow setup        Full setup (auto-detects project, installs commands)
                             - Detects tech stack and generates config
                             - Installs commands to .claude/commands/
                             - Configures MCP in .mcp.json
  openspec-flow setup -g     Install globally (skip project detection)
                             - Commands: ~/.claude/commands/
                             - MCP config: ~/.claude.json
  openspec-flow uninstall    Remove from current project
  openspec-flow uninstall -g Remove global installation

After setup, use slash commands in Claude Code:
  /osf:ideate <req>   Create OpenSpec from requirements
  /osf:list           List all OpenSpec changes
  /osf:work <id>      Generate work brief
  /osf:analyze <id>   Analyze change complexity
  /osf:split <id>     Split large change into phases
  /osf:implement <id> Run implementation via claude-flow
  /osf:verify <id>    E2E verification via claude-flow
  /osf:review <id>    Code review via claude-flow
  /osf:deferred <id>  Analyze incomplete tasks
  /osf:log <id>       Create implementation flow log
  /osf:archive <id>   Archive completed/closed change
  /osf:help           Command reference
`);
    break;

  default:
    // Default: start MCP server
    startMCPServer();
}
