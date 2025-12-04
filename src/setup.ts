/**
 * Setup and uninstall functions for openspec-flow
 * Handles installation of slash commands and MCP configuration
 *
 * MCP Config Locations (per Claude Code docs):
 * - Project-scoped: .mcp.json at project root
 * - User-scoped: ~/.claude.json
 *
 * Commands Location:
 * - .claude/commands/osf/ (namespaced under osf:)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { detectProjectStack, formatDetectionSummary } from './utils/projectDetector.js';
import { generateConfig, configExists } from './utils/configGenerator.js';
import { clearConfigCache } from './utils/configLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Package root is one level up from dist/
const PACKAGE_ROOT = join(__dirname, '..');

// Marker to identify our commands
const OSF_MARKER = '# openspec-flow-command:';

interface McpConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    type?: string;
  }>;
}

interface DependencyStatus {
  name: string;
  status: 'ok' | 'missing' | 'warning';
  message: string;
  action?: string;
}

interface InstallCheckResult {
  canInstall: boolean;
  conflicts: string[];
  existing: string[];
}

/**
 * Check if a command exists in PATH
 */
function checkCommandExists(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is an openspec-flow command by looking for our marker
 */
function isOurCommand(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.includes(OSF_MARKER);
  } catch {
    return false;
  }
}

/**
 * Check if we can safely install commands
 * Returns conflicts (files that exist but aren't ours)
 */
function checkCanInstall(commandsDir: string): InstallCheckResult {
  const osfDir = join(commandsDir, 'osf');
  const conflicts: string[] = [];
  const existing: string[] = [];

  // Check if osf directory exists
  if (!existsSync(osfDir)) {
    return { canInstall: true, conflicts: [], existing: [] };
  }

  // Check each file in the osf directory
  const files = readdirSync(osfDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = join(osfDir, file);
    if (isOurCommand(filePath)) {
      existing.push(file);
    } else {
      conflicts.push(file);
    }
  }

  return {
    canInstall: conflicts.length === 0,
    conflicts,
    existing,
  };
}

/**
 * Check all dependencies and return their status
 */
function checkDependencies(isGlobal: boolean): DependencyStatus[] {
  const results: DependencyStatus[] = [];

  // 1. Check project config (skip for global)
  if (!isGlobal) {
    if (configExists(process.cwd())) {
      results.push({ name: 'Project config', status: 'ok', message: '.openspec-flow/config/ exists' });
    } else {
      results.push({
        name: 'Project config',
        status: 'missing',
        message: 'Will auto-detect and generate',
      });
    }
  }

  // 2. Check openspec CLI installed
  const openspecInstalled = checkCommandExists('openspec');
  if (openspecInstalled) {
    results.push({ name: 'OpenSpec CLI', status: 'ok', message: 'openspec command available' });
  } else {
    results.push({
      name: 'OpenSpec CLI',
      status: 'warning',
      message: 'Not installed',
      action: 'npm install -g @anthropic/openspec',
    });
  }

  // 3. Check openspec directory
  if (existsSync('openspec/changes')) {
    results.push({ name: 'OpenSpec Dir', status: 'ok', message: 'openspec/changes/ exists' });
  } else {
    results.push({
      name: 'OpenSpec Dir',
      status: 'warning',
      message: 'openspec/changes/ not found',
      action: 'openspec init',
    });
  }

  // 4. Check claude-flow MCP
  if (checkClaudeFlowConfigured()) {
    results.push({ name: 'Claude-Flow', status: 'ok', message: 'MCP configured' });
  } else {
    results.push({
      name: 'Claude-Flow',
      status: 'warning',
      message: 'Not configured (needed for /osf:implement, /osf:verify, /osf:review)',
      action: 'claude mcp add claude-flow npx claude-flow@alpha mcp start',
    });
  }

  return results;
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
export async function runSetup(isGlobal: boolean): Promise<void> {
  const commandsDir = getCommandsDir(isGlobal);
  const mcpConfigPath = getMcpConfigPath(isGlobal);
  const location = isGlobal ? 'global' : 'project';

  console.log('\n=== OpenSpec-Flow Setup ===\n');

  // Check for conflicts first
  const installCheck = checkCanInstall(commandsDir);
  if (!installCheck.canInstall) {
    console.error('ERROR: Cannot install - conflicting files found in .claude/commands/osf/:\n');
    for (const conflict of installCheck.conflicts) {
      console.error(`  - ${conflict} (not an openspec-flow command)`);
    }
    console.error('\nThese files do not have the openspec-flow marker and may be custom commands.');
    console.error('Please remove or rename them before running setup.\n');
    process.exit(1);
  }

  if (installCheck.existing.length > 0) {
    console.log(`Updating ${installCheck.existing.length} existing openspec-flow commands...`);
  }

  // Check dependencies
  console.log('Checking dependencies...');
  const deps = checkDependencies(isGlobal);

  for (const dep of deps) {
    const icon = dep.status === 'ok' ? '[OK]' : dep.status === 'warning' ? '[WARN]' : '[MISSING]';
    console.log(`  ${icon} ${dep.name}: ${dep.message}`);
  }
  console.log();

  // Run init if needed (project-local only)
  const needsInit = !isGlobal && deps.some(d => d.name === 'Project config' && d.status === 'missing');
  if (needsInit) {
    console.log('Initializing project configuration...\n');
    await runInit();
    console.log();
  }

  // Clean up old installations (pre-0.2.4 flat commands)
  cleanupOldInstallation(isGlobal);

  // Create commands/osf directory
  const osfDir = join(commandsDir, 'osf');
  if (!existsSync(osfDir)) {
    mkdirSync(osfDir, { recursive: true });
  }

  // Copy slash commands from osf/ subdirectory
  console.log(`Installing slash commands to ${location}...`);
  const sourceOsfDir = join(PACKAGE_ROOT, 'commands', 'osf');
  if (existsSync(sourceOsfDir)) {
    const commands = readdirSync(sourceOsfDir).filter(f => f.endsWith('.md'));
    for (const cmd of commands) {
      const src = join(sourceOsfDir, cmd);
      const dest = join(osfDir, cmd);
      copyFileSync(src, dest);
      console.log(`  Installed /osf:${cmd.replace('.md', '')}`);
    }
  } else {
    console.error(`Warning: Commands directory not found at ${sourceOsfDir}`);
  }

  // Configure MCP server
  configureMcp(mcpConfigPath);

  console.log(`
Setup complete!

Usage in Claude Code:
  /osf:ideate <req>     Create new change from requirements
  /osf:list             List all OpenSpec changes
  /osf:work <id>        Generate work brief for a change
  /osf:analyze <id>     Analyze change size/complexity
  /osf:split <id>       Split large change into phases
  /osf:implement <id>   Run multi-agent implementation
  /osf:verify <id>      E2E verification
  /osf:review <id>      Code review against requirements
  /osf:deferred <id>    Analyze incomplete tasks
  /osf:archive <id>     Archive completed/closed change
  /osf:help             Command reference
`);

  // Show warnings with fix commands
  const warnings = deps.filter(d => d.status === 'warning' && d.action);
  if (warnings.length > 0) {
    console.log('Optional dependencies:');
    for (const w of warnings) {
      console.log(`  ${w.name}: ${w.message}`);
      console.log(`    Fix: ${w.action}`);
    }
    console.log();
  }
}

/**
 * Initialize project configuration by detecting tech stack
 */
async function runInit(): Promise<void> {
  const basePath = process.cwd();

  // Auto-detect project stack
  console.log('Detecting project stack...');
  const detection = await detectProjectStack(basePath);

  if (detection.runtime.type === 'unknown') {
    console.log('  Could not auto-detect project type.');
    console.log('  Using generic configuration.\n');
  } else {
    console.log('-'.repeat(40));
    console.log(formatDetectionSummary(detection));
    console.log('-'.repeat(40));
  }

  // Get project name
  const projectName = inferProjectName(basePath);
  console.log(`\nProject name: ${projectName}\n`);

  // Generate config files
  console.log('Generating configuration files...');
  const createdFiles = generateConfig(basePath, detection, {
    projectName,
  });

  for (const file of createdFiles) {
    const relativePath = file.replace(basePath + '/', '');
    console.log(`  Created: ${relativePath}`);
  }

  // Clear config cache so it reloads with new config
  clearConfigCache();
}

/**
 * Infer project name from package.json or directory name
 */
function inferProjectName(basePath: string): string {
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
  return basename(basePath) || 'myproject';
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
 * Clean up old installations (pre-0.2.4 flat commands)
 */
function cleanupOldInstallation(isGlobal: boolean): void {
  const dotClaudeDir = isGlobal
    ? join(homedir(), '.claude')
    : join(process.cwd(), '.claude');

  const commandsDir = join(dotClaudeDir, 'commands');

  // Remove old namespaced commands directory (pre-0.2.0)
  const oldNamespacedDir = join(commandsDir, 'openspec-flow');
  if (existsSync(oldNamespacedDir)) {
    rmSync(oldNamespacedDir, { recursive: true });
    console.log(`Removed old namespaced commands: ${oldNamespacedDir}`);
  }

  // Remove old flat commands (0.2.0 - 0.2.3) - only if they are ours
  const oldFlatCommands = [
    'list-specs.md',
    'work.md',
    'implement.md',
    'verify.md',
    'review.md',
    'deferred.md',
    'log.md',
    'osf-help.md',
    'ideate.md',
    'analyze.md',
    'split.md',
    'archive.md',
    // Even older formats
    'openspec-flow:list.md',
    'openspec-flow:work.md',
    'openspec-flow:implement.md',
    'openspec-flow:verify.md',
    'openspec-flow:deferred.md',
    'openspec-flow:review.md',
    'openspec-flow:log.md',
    'openspec-flow:help.md',
  ];

  if (existsSync(commandsDir)) {
    for (const cmd of oldFlatCommands) {
      const cmdPath = join(commandsDir, cmd);
      if (existsSync(cmdPath)) {
        // Only remove if it's our command or doesn't have content (empty)
        if (isOurCommand(cmdPath) || readFileSync(cmdPath, 'utf-8').trim() === '') {
          rmSync(cmdPath);
          console.log(`Removed old command: ${cmd}`);
        } else {
          // Check if it looks like our old command (has openspec-flow MCP tools)
          const content = readFileSync(cmdPath, 'utf-8');
          if (content.includes('mcp__openspec-flow__') || content.includes('OpenSpec-Flow')) {
            rmSync(cmdPath);
            console.log(`Removed old command: ${cmd}`);
          }
        }
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

  // Remove osf/ directory (only our commands)
  const osfDir = join(commandsDir, 'osf');
  if (existsSync(osfDir)) {
    const files = readdirSync(osfDir).filter(f => f.endsWith('.md'));
    let removedCount = 0;
    const skipped: string[] = [];

    for (const file of files) {
      const filePath = join(osfDir, file);
      if (isOurCommand(filePath)) {
        rmSync(filePath);
        console.log(`  Removed /osf:${file.replace('.md', '')}`);
        removedCount++;
      } else {
        skipped.push(file);
      }
    }

    // Remove the osf directory if empty
    const remaining = readdirSync(osfDir);
    if (remaining.length === 0) {
      rmSync(osfDir, { recursive: true });
      console.log(`  Removed osf/ directory`);
    } else if (skipped.length > 0) {
      console.log(`\n  Skipped ${skipped.length} non-openspec-flow files in osf/:`);
      for (const s of skipped) {
        console.log(`    - ${s}`);
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
