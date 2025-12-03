/**
 * OpenSpec-Flow Configuration Loader
 * Loads and merges configuration from .openspec-flow/config/ directory
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import {
  OpenSpecFlowConfig,
  ProjectConfig,
  TechStackConfig,
  PathsConfig,
  PatternsConfig,
  ConstraintsConfig,
  ComputedConfig,
  DEFAULT_CONFIG,
} from './configSchema.js';

const CONFIG_DIR = '.openspec-flow/config';

/**
 * Config file names
 */
const CONFIG_FILES = {
  project: 'project.yaml',
  techStack: 'tech-stack.yaml',
  paths: 'paths.yaml',
  patterns: 'patterns.yaml',
  constraints: 'constraints.yaml',
} as const;

/**
 * Cached configuration
 */
let cachedConfig: OpenSpecFlowConfig | null = null;
let cachedComputed: ComputedConfig | null = null;

/**
 * Load configuration from .openspec-flow/config/ directory
 * @param basePath - Base path to look for config (defaults to cwd)
 * @param forceReload - Force reload even if cached
 */
export function loadConfig(basePath?: string, forceReload = false): OpenSpecFlowConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const root = basePath || process.cwd();
  const configDir = join(root, CONFIG_DIR);

  // Check if config directory exists
  if (!existsSync(configDir)) {
    console.warn(`Config directory not found: ${configDir}`);
    console.warn('Run "npm run openspec-flow:init" to initialize configuration.');
    return DEFAULT_CONFIG as OpenSpecFlowConfig;
  }

  // Load individual config files
  const project = loadConfigFile<ProjectConfig>(configDir, CONFIG_FILES.project);
  const tech = loadConfigFile<TechStackConfig>(configDir, CONFIG_FILES.techStack);
  const paths = loadConfigFile<PathsConfig>(configDir, CONFIG_FILES.paths);
  const patterns = loadConfigFile<PatternsConfig>(configDir, CONFIG_FILES.patterns);
  const constraints = loadConfigFile<ConstraintsConfig>(configDir, CONFIG_FILES.constraints);

  // Merge with defaults
  const defaultPaths: PathsConfig = {
    solution: { root: root },
    source: {},
  };

  cachedConfig = {
    project: { ...DEFAULT_CONFIG.project, ...project } as ProjectConfig,
    tech: tech || { runtime: { name: 'unknown', version: 'unknown' } },
    paths: paths || defaultPaths,
    patterns: { ...DEFAULT_CONFIG.patterns, ...patterns } as PatternsConfig,
    constraints: { ...DEFAULT_CONFIG.constraints, ...constraints } as ConstraintsConfig,
  };

  // Clear computed cache
  cachedComputed = null;

  return cachedConfig;
}

/**
 * Load a single config file
 */
function loadConfigFile<T>(configDir: string, filename: string): T | null {
  const filePath = join(configDir, filename);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseYaml(content) as T;
  } catch (error) {
    console.error(`Error loading config file ${filename}:`, error);
    return null;
  }
}

/**
 * Get computed/derived configuration values
 */
export function getComputedConfig(config?: OpenSpecFlowConfig): ComputedConfig {
  if (cachedComputed) {
    return cachedComputed;
  }

  const cfg = config || loadConfig();

  cachedComputed = {
    runtimeFull: computeRuntimeFull(cfg.tech),
    databaseFull: computeDatabaseFull(cfg.tech),
    messagingFull: computeMessagingFull(cfg.tech),
    storageFull: computeStorageFull(cfg.tech),
    buildFullCommand: computeBuildFullCommand(cfg),
    runFullCommand: computeRunFullCommand(cfg),
  };

  return cachedComputed;
}

/**
 * Compute full runtime description
 * e.g., ".NET 9 with Minimal APIs, C# 13"
 */
function computeRuntimeFull(tech: TechStackConfig): string {
  const parts: string[] = [];

  if (tech.runtime) {
    parts.push(`${tech.runtime.name} ${tech.runtime.version}`);

    if (tech.runtime.language && tech.runtime.language_version) {
      parts.push(`${tech.runtime.language} ${tech.runtime.language_version}`);
    }
  }

  return parts.join(', ') || 'Unknown runtime';
}

/**
 * Compute full database description
 * e.g., "PostgreSQL 15+ with EF Core"
 */
function computeDatabaseFull(tech: TechStackConfig): string {
  if (!tech.database) {
    return 'No database configured';
  }

  let result = tech.database.type;
  if (tech.database.version) {
    result += ` ${tech.database.version}`;
  }
  if (tech.database.orm) {
    result += ` with ${tech.database.orm}`;
  }

  return result;
}

/**
 * Compute full messaging description
 * e.g., "RabbitMQ (dev) / Azure Service Bus (prod)"
 */
function computeMessagingFull(tech: TechStackConfig): string {
  if (!tech.messaging) {
    return 'No messaging configured';
  }

  const parts: string[] = [];

  if (tech.messaging.development) {
    parts.push(`${tech.messaging.development} (dev)`);
  }
  if (tech.messaging.production) {
    parts.push(`${tech.messaging.production} (prod)`);
  }

  return parts.join(' / ') || 'No messaging configured';
}

/**
 * Compute full storage description
 * e.g., "Azure Blob Storage (Azurite for local)"
 */
function computeStorageFull(tech: TechStackConfig): string {
  if (!tech.storage) {
    return 'No storage configured';
  }

  let result = tech.storage.type || 'File storage';
  if (tech.storage.development) {
    result += ` (${tech.storage.development} for local)`;
  }

  return result;
}

/**
 * Compute full build command with paths
 */
function computeBuildFullCommand(cfg: OpenSpecFlowConfig): string {
  const { project, paths } = cfg;

  if (!project.build) {
    return 'npm run build';
  }

  let cmd = project.build.command;

  if (project.build.solution && paths.solution?.root) {
    cmd += ` ${paths.solution.root}/${project.build.solution}`;
  } else if (project.build.project) {
    cmd += ` ${project.build.project}`;
  }

  return cmd;
}

/**
 * Compute full run command with paths
 */
function computeRunFullCommand(cfg: OpenSpecFlowConfig): string {
  const { project, paths } = cfg;

  if (!project.run) {
    return 'npm start';
  }

  let cmd = project.run.command;

  if (project.run.project) {
    // Check if it's a .NET style command
    if (cmd.includes('dotnet')) {
      cmd += ` --project ${paths.solution?.root || '.'}/${project.run.project}`;
    }
  }

  return cmd;
}

/**
 * Check if configuration exists
 */
export function configExists(basePath?: string): boolean {
  const root = basePath || process.cwd();
  const configDir = join(root, CONFIG_DIR);
  return existsSync(configDir);
}

/**
 * Get config directory path
 */
export function getConfigDir(basePath?: string): string {
  const root = basePath || process.cwd();
  return join(root, CONFIG_DIR);
}

/**
 * Clear cached configuration
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedComputed = null;
}

/**
 * Get a flattened object for template interpolation
 * Converts nested config to dot-notation keys
 */
export function getFlatConfig(config?: OpenSpecFlowConfig): Record<string, string | number | boolean> {
  const cfg = config || loadConfig();
  const computed = getComputedConfig(cfg);
  const flat: Record<string, string | number | boolean> = {};

  // Project config
  flat['project.name'] = cfg.project.name;
  flat['project.description'] = cfg.project.description || '';
  flat['project.repository'] = cfg.project.repository || '';
  flat['build.command'] = cfg.project.build.command;
  flat['build.solution'] = cfg.project.build.solution || '';
  flat['build.project'] = cfg.project.build.project || '';
  flat['test.command'] = cfg.project.test.command;
  flat['test.project'] = cfg.project.test.project || '';
  flat['run.command'] = cfg.project.run.command;
  flat['run.project'] = cfg.project.run.project || '';
  flat['run.port'] = cfg.project.run.port || 3000;

  // Tech config (computed full values)
  flat['tech.runtime'] = computed.runtimeFull;
  flat['tech.orchestration'] = cfg.tech.orchestration?.name || '';
  flat['tech.database'] = computed.databaseFull;
  flat['tech.messaging'] = computed.messagingFull;
  flat['tech.storage'] = computed.storageFull;

  // Paths config
  flat['paths.solution.root'] = cfg.paths.solution.root;
  flat['paths.solution.file'] = cfg.paths.solution.file || '';
  flat['paths.source.core'] = cfg.paths.source?.core || '';
  flat['paths.source.domain'] = cfg.paths.source?.domain || '';
  flat['paths.source.application'] = cfg.paths.source?.application || '';
  flat['paths.source.infrastructure'] = cfg.paths.source?.infrastructure || '';
  flat['paths.source.endpoints'] = cfg.paths.source?.endpoints || '';
  flat['paths.hosting.apphost'] = cfg.paths.hosting?.apphost || '';
  flat['paths.frontend.root'] = cfg.paths.frontend?.root || '';
  flat['paths.tests.unit'] = cfg.paths.tests?.unit || '';
  flat['paths.tests.integration'] = cfg.paths.tests?.integration || '';

  // Computed full commands
  flat['build.full_command'] = computed.buildFullCommand;
  flat['run.full_command'] = computed.runFullCommand;

  return flat;
}

/**
 * Get patterns as an array for template iteration
 */
export function getPatternsList(config?: OpenSpecFlowConfig): string[] {
  const cfg = config || loadConfig();
  return cfg.patterns.architecture || [];
}

/**
 * Get constraints as an array for template iteration
 */
export function getConstraintsList(config?: OpenSpecFlowConfig): string[] {
  const cfg = config || loadConfig();
  return (cfg.constraints.constraints || []).map(c => `${c.name}: ${c.rule}`);
}
