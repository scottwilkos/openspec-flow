/**
 * OpenSpec-Flow Configuration Schema
 * TypeScript interfaces for project configuration
 */

/**
 * Root configuration object - merges all config files
 */
export interface OpenSpecFlowConfig {
  project: ProjectConfig;
  tech: TechStackConfig;
  paths: PathsConfig;
  patterns: PatternsConfig;
  constraints: ConstraintsConfig;
}

/**
 * Project identity and metadata (project.yaml)
 */
export interface ProjectConfig {
  name: string;
  description?: string;
  repository?: string;
  build: BuildConfig;
  test: TestConfig;
  run: RunConfig;
}

export interface BuildConfig {
  command: string;
  solution?: string;
  project?: string;
}

export interface TestConfig {
  command: string;
  project?: string;
}

export interface RunConfig {
  command: string;
  project?: string;
  port?: number;
}

/**
 * Technology stack configuration (tech-stack.yaml)
 */
export interface TechStackConfig {
  runtime: RuntimeConfig;
  orchestration?: OrchestrationConfig;
  database?: DatabaseConfig;
  messaging?: MessagingConfig;
  storage?: StorageConfig;
  additional?: AdditionalTechConfig[];
}

export interface RuntimeConfig {
  name: string;
  version: string;
  language?: string;
  language_version?: string;
}

export interface OrchestrationConfig {
  name: string;
  version?: string;
}

export interface DatabaseConfig {
  type: string;
  version?: string;
  orm?: string;
}

export interface MessagingConfig {
  development?: string;
  production?: string;
}

export interface StorageConfig {
  type?: string;
  development?: string;
}

export interface AdditionalTechConfig {
  name: string;
  purpose?: string;
}

/**
 * Project paths configuration (paths.yaml)
 */
export interface PathsConfig {
  solution: SolutionPathConfig;
  source: SourcePathConfig;
  hosting?: HostingPathConfig;
  frontend?: FrontendPathConfig;
  tests?: TestsPathConfig;
}

export interface SolutionPathConfig {
  root: string;
  file?: string;
}

export interface SourcePathConfig {
  core?: string;
  domain?: string;
  application?: string;
  infrastructure?: string;
  endpoints?: string;
  [key: string]: string | undefined;
}

export interface HostingPathConfig {
  apphost?: string;
}

export interface FrontendPathConfig {
  root?: string;
}

export interface TestsPathConfig {
  unit?: string;
  integration?: string;
  e2e?: string;
}

/**
 * Architecture patterns configuration (patterns.yaml)
 */
export interface PatternsConfig {
  architecture: string[];
  code: CodePatternConfig[];
  naming?: NamingConfig;
}

export interface CodePatternConfig {
  pattern: string;
  description: string;
}

export interface NamingConfig {
  entities?: string;
  commands?: string;
  queries?: string;
  handlers?: string;
  [key: string]: string | undefined;
}

/**
 * Critical constraints configuration (constraints.yaml)
 */
export interface ConstraintsConfig {
  constraints: ConstraintItem[];
}

export interface ConstraintItem {
  name: string;
  rule: string;
}

/**
 * Computed/derived values from config
 */
export interface ComputedConfig {
  /** Full runtime description, e.g., ".NET 9 with Minimal APIs, C# 13" */
  runtimeFull: string;
  /** Full database description, e.g., "PostgreSQL 15+ with EF Core" */
  databaseFull: string;
  /** Full messaging description, e.g., "RabbitMQ (dev) / Azure Service Bus (prod)" */
  messagingFull: string;
  /** Full storage description, e.g., "Azure Blob Storage (Azurite for local)" */
  storageFull: string;
  /** Full build command with paths */
  buildFullCommand: string;
  /** Full run command with paths */
  runFullCommand: string;
}

/**
 * Detection result from auto-detection
 */
export interface DetectionResult {
  runtime: {
    type: 'dotnet' | 'node' | 'python' | 'go' | 'rust' | 'java' | 'unknown';
    version?: string;
    language?: string;
    languageVersion?: string;
  };
  framework?: string;
  database?: {
    type: string;
    orm?: string;
  };
  paths: {
    root: string;
    source: string[];
    tests: string[];
    hosting?: string;
    frontend?: string;
  };
  buildCommand?: string;
  testCommand?: string;
  runCommand?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<OpenSpecFlowConfig> = {
  project: {
    name: 'MyProject',
    description: 'Project description',
    build: {
      command: 'npm run build',
    },
    test: {
      command: 'npm test',
    },
    run: {
      command: 'npm start',
      port: 3000,
    },
  },
  patterns: {
    architecture: [],
    code: [],
  },
  constraints: {
    constraints: [],
  },
};
