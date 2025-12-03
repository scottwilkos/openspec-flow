/**
 * OpenSpec-Flow Init Command
 * Initializes project configuration by detecting tech stack and generating config files
 */

import { existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { detectProjectStack, formatDetectionSummary } from '../utils/projectDetector.js';
import { generateConfig, configExists, getConfigPath } from '../utils/configGenerator.js';
import { processTemplateDirectory } from '../utils/templateEngine.js';
import { loadConfig, clearConfigCache } from '../utils/configLoader.js';

// Get __dirname equivalent for ESM
function getAssetsDir(): string {
  // When running from dist, assets are at ../assets relative to dist
  // We need to find the package root
  const possiblePaths = [
    join(process.cwd(), 'tooling/openspec-flow/assets/templates'),
    join(process.cwd(), 'node_modules/openspec-flow/assets/templates'),
    join(process.cwd(), 'assets/templates'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  // Fallback - try relative to cwd
  return join(process.cwd(), 'assets/templates');
}

/**
 * Init command options
 */
export interface InitOptions {
  /** Project name (required or prompted) */
  name?: string;
  /** Project description */
  description?: string;
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Force overwrite existing config */
  force?: boolean;
  /** Base path to initialize (defaults to cwd) */
  path?: string;
}

/**
 * Execute the init command
 */
export async function initCommand(options: InitOptions = {}): Promise<void> {
  const basePath = options.path || process.cwd();

  console.log(chalk.bold('\n=== OpenSpec-Flow Initialization ===\n'));

  // Check if already initialized
  if (configExists(basePath) && !options.force) {
    console.log(chalk.yellow('Configuration already exists at:'), getConfigPath(basePath));
    console.log(chalk.gray('Use --force to overwrite existing configuration.\n'));
    return;
  }

  // Step 1: Auto-detect project stack
  console.log(chalk.blue('Step 1: Detecting project stack...\n'));

  const detection = await detectProjectStack(basePath);

  if (detection.runtime.type === 'unknown') {
    console.log(chalk.yellow('Could not auto-detect project type.'));
    console.log(chalk.gray('Will use generic configuration.\n'));
  } else {
    console.log(chalk.green('Detected project configuration:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(formatDetectionSummary(detection));
    console.log(chalk.gray('─'.repeat(40) + '\n'));
  }

  // Step 2: Get project name
  const projectName = options.name || inferProjectName(basePath);
  console.log(chalk.blue('Step 2: Project name:'), chalk.bold(projectName));
  console.log();

  // Step 3: Generate config files
  console.log(chalk.blue('Step 3: Generating configuration files...\n'));

  const createdFiles = generateConfig(basePath, detection, {
    projectName,
    description: options.description,
  });

  for (const file of createdFiles) {
    const relativePath = file.replace(basePath + '/', '');
    console.log(chalk.green('  Created:'), relativePath);
  }
  console.log();

  // Step 4: Install assets (slash commands, prompts, templates)
  console.log(chalk.blue('Step 4: Installing assets...\n'));

  const installedAssets = await installAssets(basePath);

  for (const asset of installedAssets) {
    const relativePath = asset.replace(basePath + '/', '');
    console.log(chalk.green('  Installed:'), relativePath);
  }
  console.log();

  // Clear config cache so it reloads with new config
  clearConfigCache();

  // Summary
  console.log(chalk.bold.green('=== Initialization Complete ===\n'));

  console.log('Configuration created at:');
  console.log(chalk.cyan(`  ${getConfigPath(basePath)}/`));
  console.log();

  console.log('Next steps:');
  console.log(chalk.gray('  1. Review and customize the config files'));
  console.log(chalk.gray('  2. Run: openspec-flow list'));
  console.log(chalk.gray('  3. Create a change proposal: /openspec:proposal'));
  console.log();
}

/**
 * Infer project name from directory name or package.json
 */
function inferProjectName(basePath: string): string {
  // Try package.json
  const packageJsonPath = join(basePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = require(packageJsonPath);
      if (pkg.name) {
        return pkg.name;
      }
    } catch {
      // Ignore
    }
  }

  // Fall back to directory name
  const dirName = basePath.split('/').pop() || 'myproject';
  return dirName;
}

/**
 * Install assets (slash commands, prompts, templates, flows)
 * Processes .template files through the template engine
 */
async function installAssets(basePath: string): Promise<string[]> {
  const installed: string[] = [];

  // Get assets directory
  const assetsDir = getAssetsDir();

  // If assets directory doesn't exist, skip asset installation
  // This happens when running before templates are created
  if (!existsSync(assetsDir)) {
    console.log(chalk.yellow('  Assets directory not found. Skipping asset installation.'));
    console.log(chalk.gray('  Templates will be installed when the package is published.'));
    return installed;
  }

  // Load config for template interpolation
  const config = loadConfig(basePath);

  // Process each asset category
  const categories = [
    { source: 'commands', dest: '.claude/commands/openspec-flow' },
    { source: 'prompts', dest: '.claude/prompts/openspec-flow' },
    { source: 'flows', dest: '.claude/flows/openspec-flow' },
    { source: 'docs', dest: '.claude/templates/openspec-flow' },
  ];

  for (const category of categories) {
    const sourceDir = join(assetsDir, category.source);
    const destDir = join(basePath, category.dest);

    if (!existsSync(sourceDir)) {
      continue;
    }

    // Ensure destination directory exists
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    // Process templates
    const processed = processTemplateDirectory(sourceDir, destDir, { config });
    installed.push(...processed);
  }

  return installed;
}

/**
 * Export for CLI registration
 */
export default initCommand;
