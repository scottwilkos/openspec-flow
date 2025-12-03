/**
 * Setup and uninstall functions for openspec-flow
 * Handles installation of slash commands and MCP configuration
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
    description?: string;
  }>;
}

/**
 * Get the target directory for installation
 */
function getTargetDir(isGlobal: boolean): string {
  if (isGlobal) {
    return join(homedir(), '.claude');
  }
  return join(process.cwd(), '.claude');
}

/**
 * Run the setup process
 */
export function runSetup(isGlobal: boolean): void {
  const targetDir = getTargetDir(isGlobal);
  const commandsDir = join(targetDir, 'commands');
  const location = isGlobal ? 'global (~/.claude)' : 'project (.claude)';

  console.log(`\nOpenSpec-Flow Setup`);
  console.log(`Installing to ${location}...\n`);

  // Clean up old installations first
  cleanupOldInstallation(targetDir);

  // Create directories
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
  configureMcp(targetDir);

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
}

/**
 * Configure MCP server in mcp.json
 */
function configureMcp(targetDir: string): void {
  const mcpPath = join(targetDir, 'mcp.json');

  let config: McpConfig = {};

  // Load existing config if present
  if (existsSync(mcpPath)) {
    try {
      config = JSON.parse(readFileSync(mcpPath, 'utf-8'));
    } catch {
      console.warn('Warning: Could not parse existing mcp.json, creating new one');
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
    description: 'OpenSpec change management tools',
  };

  writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(`\nConfigured MCP server in ${mcpPath}`);
}

/**
 * Clean up old installations (pre-0.2.0)
 */
function cleanupOldInstallation(targetDir: string): void {
  // Remove old namespaced commands directory
  const oldNamespacedDir = join(targetDir, 'commands', 'openspec-flow');
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

  const commandsDir = join(targetDir, 'commands');
  if (existsSync(commandsDir)) {
    for (const cmd of oldCommands) {
      const cmdPath = join(commandsDir, cmd);
      if (existsSync(cmdPath)) {
        rmSync(cmdPath);
        console.log(`Removed old command: ${cmd}`);
      }
    }
  }
}

/**
 * Run the uninstall process
 */
export function runUninstall(isGlobal: boolean): void {
  const targetDir = getTargetDir(isGlobal);
  const commandsDir = join(targetDir, 'commands');
  const location = isGlobal ? 'global (~/.claude)' : 'project (.claude)';

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
  const mcpPath = join(targetDir, 'mcp.json');
  if (existsSync(mcpPath)) {
    try {
      const config: McpConfig = JSON.parse(readFileSync(mcpPath, 'utf-8'));
      if (config.mcpServers && config.mcpServers['openspec-flow']) {
        delete config.mcpServers['openspec-flow'];
        writeFileSync(mcpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        console.log(`\nRemoved MCP server from ${mcpPath}`);
      }
    } catch {
      console.warn('Warning: Could not update mcp.json');
    }
  }

  // Clean up old installations too
  cleanupOldInstallation(targetDir);

  console.log(`\nUninstall complete.`);
}
