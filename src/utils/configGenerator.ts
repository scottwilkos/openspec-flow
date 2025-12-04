/**
 * OpenSpec-Flow Config Generator
 * Generates configuration files from detection results
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stringify as stringifyYaml } from 'yaml';
import { DetectionResult } from './configSchema.js';

const CONFIG_DIR = '.openspec-flow/config';

/**
 * Config generation options
 */
export interface GenerateConfigOptions {
  /** Project name (required) */
  projectName: string;
  /** Project description */
  description?: string;
  /** Repository URL */
  repository?: string;
  /** Override detection result */
  detection?: DetectionResult;
  /** Custom patterns to add */
  patterns?: string[];
  /** Custom constraints to add */
  constraints?: Array<{ name: string; rule: string }>;
}

/**
 * Generate all config files from detection result
 *
 * @param basePath - Base path to create config
 * @param detection - Detection result from project detector
 * @param options - Generation options
 * @returns List of created file paths
 */
export function generateConfig(
  basePath: string,
  detection: DetectionResult,
  options: GenerateConfigOptions
): string[] {
  const configDir = join(basePath, CONFIG_DIR);

  // Create config directory
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const createdFiles: string[] = [];

  // Generate project.yaml
  const projectPath = join(configDir, 'project.yaml');
  const projectConfig = generateProjectConfig(detection, options);
  writeFileSync(projectPath, stringifyYaml(projectConfig, { lineWidth: 0 }), 'utf-8');
  createdFiles.push(projectPath);

  // Generate tech-stack.yaml
  const techPath = join(configDir, 'tech-stack.yaml');
  const techConfig = generateTechStackConfig(detection);
  writeFileSync(techPath, stringifyYaml(techConfig, { lineWidth: 0 }), 'utf-8');
  createdFiles.push(techPath);

  // Generate paths.yaml
  const pathsPath = join(configDir, 'paths.yaml');
  const pathsConfig = generatePathsConfig(detection);
  writeFileSync(pathsPath, stringifyYaml(pathsConfig, { lineWidth: 0 }), 'utf-8');
  createdFiles.push(pathsPath);

  // Generate patterns.yaml
  const patternsPath = join(configDir, 'patterns.yaml');
  const patternsConfig = generatePatternsConfig(detection, options.patterns);
  writeFileSync(patternsPath, stringifyYaml(patternsConfig, { lineWidth: 0 }), 'utf-8');
  createdFiles.push(patternsPath);

  // Generate constraints.yaml
  const constraintsPath = join(configDir, 'constraints.yaml');
  const constraintsConfig = generateConstraintsConfig(options.constraints);
  writeFileSync(constraintsPath, stringifyYaml(constraintsConfig, { lineWidth: 0 }), 'utf-8');
  createdFiles.push(constraintsPath);

  return createdFiles;
}

/**
 * Generate project.yaml content
 */
function generateProjectConfig(
  detection: DetectionResult,
  options: GenerateConfigOptions
): Record<string, unknown> {
  return {
    name: options.projectName,
    description: options.description || `${options.projectName} project`,
    repository: options.repository || '',

    build: {
      command: detection.buildCommand || getBuildCommand(detection.runtime.type),
      solution: getSolutionPath(detection),
    },

    test: {
      command: detection.testCommand || getTestCommand(detection.runtime.type),
    },

    run: {
      command: detection.runCommand || getRunCommand(detection.runtime.type),
      project: detection.paths.hosting || '',
      port: getDefaultPort(detection.runtime.type, detection.framework),
    },
  };
}

/**
 * Generate tech-stack.yaml content
 */
function generateTechStackConfig(detection: DetectionResult): Record<string, unknown> {
  const config: Record<string, unknown> = {
    runtime: {
      name: getRuntimeName(detection.runtime.type),
      version: detection.runtime.version || 'latest',
    },
  };

  if (detection.runtime.language) {
    (config.runtime as Record<string, unknown>).language = detection.runtime.language;
    if (detection.runtime.languageVersion) {
      (config.runtime as Record<string, unknown>).language_version = detection.runtime.languageVersion;
    }
  }

  if (detection.framework) {
    config.orchestration = {
      name: detection.framework,
    };
  }

  if (detection.database) {
    config.database = {
      type: detection.database.type,
      orm: detection.database.orm,
    };
  }

  // Add messaging placeholder
  config.messaging = {
    development: '',
    production: '',
  };

  // Add storage placeholder
  config.storage = {
    type: '',
    development: '',
  };

  return config;
}

/**
 * Generate paths.yaml content
 */
function generatePathsConfig(detection: DetectionResult): Record<string, unknown> {
  const config: Record<string, unknown> = {
    solution: {
      root: detection.paths.root,
      file: '',
    },
    source: {},
    tests: {},
  };

  // Map source paths
  if (detection.paths.source.length > 0) {
    (config.source as Record<string, unknown>).core = detection.paths.source[0];

    // Try to detect subdirectories for .NET style projects
    if (detection.runtime.type === 'dotnet') {
      const mainSource = detection.paths.source[0];
      (config.source as Record<string, unknown>).domain = `${mainSource}/Domain`;
      (config.source as Record<string, unknown>).application = `${mainSource}/Application`;
      (config.source as Record<string, unknown>).infrastructure = `${mainSource}/Infrastructure`;
      (config.source as Record<string, unknown>).endpoints = `${mainSource}/Endpoints`;
    }
  }

  // Map hosting path
  if (detection.paths.hosting) {
    config.hosting = {
      apphost: detection.paths.hosting,
    };
  }

  // Map frontend path
  if (detection.paths.frontend) {
    config.frontend = {
      root: detection.paths.frontend,
    };
  }

  // Map test paths
  if (detection.paths.tests.length > 0) {
    (config.tests as Record<string, unknown>).unit = detection.paths.tests[0];
    if (detection.paths.tests.length > 1) {
      (config.tests as Record<string, unknown>).integration = detection.paths.tests[1];
    }
  }

  return config;
}

/**
 * Generate patterns.yaml content
 */
function generatePatternsConfig(
  detection: DetectionResult,
  customPatterns?: string[]
): Record<string, unknown> {
  const architecture: string[] = [];
  const code: Array<{ pattern: string; description: string }> = [];

  // Add default patterns based on runtime
  if (detection.runtime.type === 'dotnet') {
    if (detection.framework === '.NET Aspire') {
      architecture.push('Cloud-native distributed architecture');
    }
    code.push({ pattern: 'Result<T>', description: 'Return Result<T> from all business operations' });
    code.push({ pattern: 'CQRS', description: 'Command Query Responsibility Segregation' });
  } else if (detection.runtime.type === 'node') {
    code.push({ pattern: 'Async/Await', description: 'Use async/await for asynchronous operations' });
  }

  // Add custom patterns
  if (customPatterns) {
    architecture.push(...customPatterns);
  }

  return {
    architecture,
    code,
    naming: {
      entities: 'PascalCase',
      commands: '{Entity}{Action}Command',
      queries: '{Entity}{Action}Query',
      handlers: '{Command}Handler',
    },
  };
}

/**
 * Generate constraints.yaml content
 */
function generateConstraintsConfig(
  customConstraints?: Array<{ name: string; rule: string }>
): Record<string, unknown> {
  const constraints: Array<{ name: string; rule: string }> = [
    { name: 'File Organization', rule: 'NEVER save files to root folder - use proper directories' },
  ];

  if (customConstraints) {
    constraints.push(...customConstraints);
  }

  return { constraints };
}

/**
 * Get runtime name for display
 */
function getRuntimeName(type: string): string {
  const names: Record<string, string> = {
    dotnet: '.NET',
    node: 'Node.js',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    unknown: 'Unknown',
  };
  return names[type] || type;
}

/**
 * Get default build command
 */
function getBuildCommand(type: string): string {
  const commands: Record<string, string> = {
    dotnet: 'dotnet build',
    node: 'npm run build',
    python: '',
    go: 'go build',
    rust: 'cargo build',
    java: './gradlew build',
  };
  return commands[type] || '';
}

/**
 * Get default test command
 */
function getTestCommand(type: string): string {
  const commands: Record<string, string> = {
    dotnet: 'dotnet test',
    node: 'npm test',
    python: 'pytest',
    go: 'go test ./...',
    rust: 'cargo test',
    java: './gradlew test',
  };
  return commands[type] || '';
}

/**
 * Get default run command
 */
function getRunCommand(type: string): string {
  const commands: Record<string, string> = {
    dotnet: 'dotnet run',
    node: 'npm start',
    python: 'python main.py',
    go: 'go run .',
    rust: 'cargo run',
    java: './gradlew run',
  };
  return commands[type] || '';
}

/**
 * Get solution path from detection
 */
function getSolutionPath(detection: DetectionResult): string {
  // For .NET, try to find .sln file reference
  if (detection.runtime.type === 'dotnet' && detection.buildCommand) {
    const match = detection.buildCommand.match(/dotnet build\s+(.+\.sln)/);
    if (match) {
      return match[1];
    }
  }
  return '';
}

/**
 * Get default port based on runtime/framework
 */
function getDefaultPort(type: string, framework?: string): number {
  if (framework === 'Next.js') return 3000;
  if (framework === 'Nuxt') return 3000;
  if (framework === 'Django') return 8000;
  if (framework === 'FastAPI') return 8000;
  if (framework === 'Flask') return 5000;

  const ports: Record<string, number> = {
    dotnet: 5000,
    node: 3000,
    python: 8000,
    go: 8080,
    rust: 8080,
    java: 8080,
  };

  return ports[type] || 3000;
}

/**
 * Check if config already exists
 */
export function configExists(basePath: string): boolean {
  const configDir = join(basePath, CONFIG_DIR);
  return existsSync(configDir);
}

/**
 * Get config directory path
 */
export function getConfigPath(basePath: string): string {
  return join(basePath, CONFIG_DIR);
}
