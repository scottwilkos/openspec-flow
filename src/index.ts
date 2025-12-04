#!/usr/bin/env node

/**
 * OpenSpec-Flow
 * Claude Code plugin for OpenSpec change management
 *
 * Usage:
 *   openspec-flow          - Start MCP server (default, used by Claude Code)
 *   openspec-flow init     - Initialize project config by detecting tech stack
 *   openspec-flow setup    - Install slash commands and configure MCP
 *   openspec-flow setup --global  - Install globally to ~/.claude/
 *   openspec-flow uninstall - Remove installed commands and MCP config
 */

import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { startMCPServer } from './mcp/server.js';
import { runSetup, runUninstall } from './setup.js';
import { detectProjectStack, formatDetectionSummary } from './utils/projectDetector.js';
import { generateConfig, configExists, getConfigPath } from './utils/configGenerator.js';
import { clearConfigCache } from './utils/configLoader.js';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    runInit(args.includes('--force') || args.includes('-f'));
    break;

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
  openspec-flow init         Initialize project config (auto-detect tech stack)
  openspec-flow init -f      Force overwrite existing config
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
  /ideate <req>     Create OpenSpec from requirements
  /analyze <id>     Analyze change complexity
  /split <id>       Split large change into phases
`);
    break;

  default:
    // Default: start MCP server
    startMCPServer();
}

/**
 * Initialize project configuration by detecting tech stack
 */
async function runInit(force: boolean): Promise<void> {
  const basePath = process.cwd();

  console.log('\n=== OpenSpec-Flow Initialization ===\n');

  // Check if already initialized
  if (configExists(basePath) && !force) {
    console.log('Configuration already exists at:', getConfigPath(basePath));
    console.log('Use --force to overwrite existing configuration.\n');
    return;
  }

  // Step 1: Auto-detect project stack
  console.log('Step 1: Detecting project stack...\n');

  const detection = await detectProjectStack(basePath);

  if (detection.runtime.type === 'unknown') {
    console.log('Could not auto-detect project type.');
    console.log('Will use generic configuration.\n');
  } else {
    console.log('Detected project configuration:');
    console.log('-'.repeat(40));
    console.log(formatDetectionSummary(detection));
    console.log('-'.repeat(40) + '\n');
  }

  // Step 2: Get project name
  const projectName = inferProjectName(basePath);
  console.log('Step 2: Project name:', projectName);
  console.log();

  // Step 3: Generate config files
  console.log('Step 3: Generating configuration files...\n');

  const createdFiles = generateConfig(basePath, detection, {
    projectName,
  });

  for (const file of createdFiles) {
    const relativePath = file.replace(basePath + '/', '');
    console.log('  Created:', relativePath);
  }
  console.log();

  // Clear config cache so it reloads with new config
  clearConfigCache();

  // Summary
  console.log('=== Initialization Complete ===\n');

  console.log('Configuration created at:');
  console.log(`  ${getConfigPath(basePath)}/`);
  console.log();

  console.log('Next steps:');
  console.log('  1. Review and customize the config files');
  console.log('  2. Run: openspec-flow setup');
  console.log('  3. Use /list-specs to see available changes');
  console.log();
}

/**
 * Infer project name from package.json or directory name
 */
function inferProjectName(basePath: string): string {
  // Try package.json
  const packageJsonPath = join(basePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name) {
        return pkg.name;
      }
    } catch {
      // Ignore
    }
  }

  // Fall back to directory name
  return basename(basePath) || 'myproject';
}
