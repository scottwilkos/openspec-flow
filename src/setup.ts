/**
 * Setup and uninstall functions for openspec-flow
 * Handles installation of slash commands and MCP configuration
 *
 * MCP Config Locations (per Claude Code docs):
 * - Project-scoped: .mcp.json at project root
 * - User-scoped: ~/.claude.json
 *
 * Commands Location:
 * - .claude/commands/ (both project and global)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Package root is one level up from dist/
const PACKAGE_ROOT = join(__dirname, '..');

interface McpConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    type?: string;
  }>;
}

/**
 * Get the commands directory for installation
 */
function getCommandsDir(isGlobal: boolean): string {
  if (isGlobal) {
    return join(homedir(), '.claude', 'commands');
  }
  return join(process.cwd(), '.claude', 'commands');
}

/**
 * Get the MCP config path
 * - Project: .mcp.json at project root
 * - Global: ~/.claude.json
 */
function getMcpConfigPath(isGlobal: boolean): string {
  if (isGlobal) {
    return join(homedir(), '.claude.json');
  }
  return join(process.cwd(), '.mcp.json');
}

/**
 * Check if claude-flow is configured in any MCP config
 */
function checkClaudeFlowConfigured(): boolean {
  const locations = [
    join(process.cwd(), '.mcp.json'),
    join(homedir(), '.claude.json'),
  ];

  for (const path of locations) {
    if (existsSync(path)) {
      try {
        const config = JSON.parse(readFileSync(path, 'utf-8')) as McpConfig;
        if (config.mcpServers) {
          // Check for any claude-flow variant (claude-flow, claude-flow@alpha, etc.)
          const hasClaudeFlow = Object.keys(config.mcpServers).some(
            key => key.startsWith('claude-flow')
          );
          if (hasClaudeFlow) return true;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
  return false;
}

/**
 * Run the setup process
 */
export function runSetup(isGlobal: boolean): void {
  const commandsDir = getCommandsDir(isGlobal);
  const mcpConfigPath = getMcpConfigPath(isGlobal);
  const location = isGlobal ? 'global' : 'project';

  console.log(`\nOpenSpec-Flow Setup`);
  console.log(`Installing to ${location}...\n`);

  // Clean up old installations first
  cleanupOldInstallation(isGlobal);

  // Create commands directory
  if (!existsSync(commandsDir)) {
    mkdirSync(commandsDir, { recursive: true });
    console.log(`Created ${commandsDir}`);
  }

  // Copy slash commands
  const sourceCommandsDir = join(PACKAGE_ROOT, 'commands');
  if (existsSync(sourceCommandsDir)) {
    const commands = readdirSync(sourceCommandsDir).filter(f => f.endsWith('.md'));
    for (const cmd of commands) {
      const src = join(sourceCommandsDir, cmd);
      const dest = join(commandsDir, cmd);
      copyFileSync(src, dest);
      console.log(`  Installed /${cmd.replace('.md', '')}`);
    }
  } else {
    console.error(`Warning: Commands directory not found at ${sourceCommandsDir}`);
  }

  // Configure MCP server
  configureMcp(mcpConfigPath);

  console.log(`
Setup complete!

Usage in Claude Code:
  /list-specs       List all OpenSpec changes
  /work <id>        Generate work brief for a change
  /implement <id>   Run multi-agent implementation
  /verify <id>      E2E verification
  /review <id>      Code review against requirements
  /deferred <id>    Analyze incomplete tasks

The MCP server provides these tools automatically:
  - list_changes
  - generate_work_brief
  - get_change_context
  - analyze_deferred
  - create_flow_log
`);

  // Check for required claude-flow dependency
  if (!checkClaudeFlowConfigured()) {
    console.log(`
REQUIRED: Claude-Flow MCP

The /implement, /verify, and /review commands require Claude-Flow for
multi-agent orchestration. Install it with:

  claude mcp add claude-flow -- npx claude-flow@alpha mcp start

Or add to your .mcp.json (project) or ~/.claude.json (global):

  {
    "mcpServers": {
      "claude-flow": {
        "command": "npx",
        "args": ["claude-flow@alpha", "mcp", "start"]
      }
    }
  }

Without claude-flow, only /list-specs, /work, /deferred, and /log will work.
`);
  } else {
    console.log(`Claude-Flow detected - full orchestration available.`);
  }
}

/**
 * Configure MCP server in the appropriate config file
 */
function configureMcp(mcpConfigPath: string): void {
  let config: McpConfig = {};

  // Load existing config if present
  if (existsSync(mcpConfigPath)) {
    try {
      config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
    } catch {
      console.warn('Warning: Could not parse existing config, creating new one');
    }
  }

  // Ensure mcpServers object exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Add or update openspec-flow server
  config.mcpServers['openspec-flow'] = {
    command: 'npx',
    args: ['openspec-flow'],
  };

  writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`\nConfigured MCP server in ${mcpConfigPath}`);
}

/**
 * Clean up old installations (pre-0.2.0)
 */
function cleanupOldInstallation(isGlobal: boolean): void {
  const dotClaudeDir = isGlobal
    ? join(homedir(), '.claude')
    : join(process.cwd(), '.claude');

  // Remove old namespaced commands directory
  const oldNamespacedDir = join(dotClaudeDir, 'commands', 'openspec-flow');
  if (existsSync(oldNamespacedDir)) {
    rmSync(oldNamespacedDir, { recursive: true });
    console.log(`Removed old namespaced commands: ${oldNamespacedDir}`);
  }

  // Remove old individual commands that may have been installed
  const oldCommands = [
    'openspec-flow:list.md',
    'openspec-flow:work.md',
    'openspec-flow:implement.md',
    'openspec-flow:verify.md',
    'openspec-flow:deferred.md',
    'openspec-flow:review.md',
    'openspec-flow:log.md',
    'openspec-flow:help.md',
  ];

  const commandsDir = join(dotClaudeDir, 'commands');
  if (existsSync(commandsDir)) {
    for (const cmd of oldCommands) {
      const cmdPath = join(commandsDir, cmd);
      if (existsSync(cmdPath)) {
        rmSync(cmdPath);
        console.log(`Removed old command: ${cmd}`);
      }
    }
  }

  // Remove old .claude/mcp.json if it exists (wrong location)
  const oldMcpPath = join(dotClaudeDir, 'mcp.json');
  if (existsSync(oldMcpPath)) {
    try {
      const config = JSON.parse(readFileSync(oldMcpPath, 'utf-8')) as McpConfig;
      if (config.mcpServers && config.mcpServers['openspec-flow']) {
        delete config.mcpServers['openspec-flow'];
        if (Object.keys(config.mcpServers).length === 0) {
          rmSync(oldMcpPath);
          console.log(`Removed old .claude/mcp.json (wrong location)`);
        } else {
          writeFileSync(oldMcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
          console.log(`Removed openspec-flow from old .claude/mcp.json`);
        }
      }
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Run the uninstall process
 */
export function runUninstall(isGlobal: boolean): void {
  const commandsDir = getCommandsDir(isGlobal);
  const mcpConfigPath = getMcpConfigPath(isGlobal);
  const location = isGlobal ? 'global' : 'project';

  console.log(`\nOpenSpec-Flow Uninstall`);
  console.log(`Removing from ${location}...\n`);

  // Remove slash commands
  const commandsToRemove = [
    'list-specs.md',
    'work.md',
    'implement.md',
    'verify.md',
    'review.md',
    'deferred.md',
    'log.md',
    'osf-help.md',
  ];

  if (existsSync(commandsDir)) {
    for (const cmd of commandsToRemove) {
      const cmdPath = join(commandsDir, cmd);
      if (existsSync(cmdPath)) {
        rmSync(cmdPath);
        console.log(`  Removed /${cmd.replace('.md', '')}`);
      }
    }
  }

  // Remove MCP configuration
  if (existsSync(mcpConfigPath)) {
    try {
      const config: McpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      if (config.mcpServers && config.mcpServers['openspec-flow']) {
        delete config.mcpServers['openspec-flow'];
        writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        console.log(`\nRemoved MCP server from ${mcpConfigPath}`);
      }
    } catch {
      console.warn('Warning: Could not update MCP config');
    }
  }

  // Clean up old installations too
  cleanupOldInstallation(isGlobal);

  console.log(`\nUninstall complete.`);
}
