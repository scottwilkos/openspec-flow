/**
 * OpenSpec-Flow Project Detector
 * Auto-detects project type, framework, and structure
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { glob } from 'glob';
import { DetectionResult } from './configSchema.js';

/**
 * Detect project stack from current directory
 *
 * @param basePath - Base path to analyze (defaults to cwd)
 * @returns Detection result with runtime, framework, paths, etc.
 */
export async function detectProjectStack(basePath?: string): Promise<DetectionResult> {
  const root = basePath || process.cwd();

  // Try detection in order of specificity
  const dotnetResult = await detectDotNet(root);
  if (dotnetResult.runtime.type !== 'unknown') {
    return dotnetResult;
  }

  const nodeResult = await detectNode(root);
  if (nodeResult.runtime.type !== 'unknown') {
    return nodeResult;
  }

  const pythonResult = await detectPython(root);
  if (pythonResult.runtime.type !== 'unknown') {
    return pythonResult;
  }

  const goResult = await detectGo(root);
  if (goResult.runtime.type !== 'unknown') {
    return goResult;
  }

  const rustResult = await detectRust(root);
  if (rustResult.runtime.type !== 'unknown') {
    return rustResult;
  }

  // Return unknown with detected paths
  return {
    runtime: { type: 'unknown' },
    paths: {
      root,
      source: findSourceDirectories(root),
      tests: findTestDirectories(root),
    },
  };
}

/**
 * Detect .NET projects
 */
async function detectDotNet(root: string): Promise<DetectionResult> {
  // Look for .csproj files
  const csprojFiles = await glob('**/*.csproj', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**'],
  });

  if (csprojFiles.length === 0) {
    return { runtime: { type: 'unknown' }, paths: { root, source: [], tests: [] } };
  }

  // Extract version from first csproj
  const version = await extractDotNetVersion(join(root, csprojFiles[0]));

  // Detect framework
  const framework = await detectDotNetFramework(root);

  // Detect database from appsettings.json
  const database = await detectDatabaseFromAppSettings(root);

  // Find solution file
  const slnFiles = await glob('**/*.sln', { cwd: root });
  const solutionFile = slnFiles[0];

  // Detect paths
  const paths = detectDotNetPaths(root, csprojFiles);

  // Detect hosting/AppHost
  const hostingPath = await detectAspireAppHost(root);

  return {
    runtime: {
      type: 'dotnet',
      version: version || '8',
      language: 'C#',
      languageVersion: getCSharpVersion(version),
    },
    framework,
    database,
    paths: {
      root,
      source: paths.source,
      tests: paths.tests,
      hosting: hostingPath,
    },
    buildCommand: solutionFile
      ? `dotnet build ${solutionFile}`
      : 'dotnet build',
    testCommand: 'dotnet test',
    runCommand: hostingPath
      ? `dotnet run --project ${hostingPath}`
      : 'dotnet run',
  };
}

/**
 * Extract .NET version from csproj
 */
async function extractDotNetVersion(csprojPath: string): Promise<string | undefined> {
  if (!existsSync(csprojPath)) return undefined;

  const content = readFileSync(csprojPath, 'utf-8');

  // Look for <TargetFramework>net9.0</TargetFramework>
  const match = content.match(/<TargetFramework>net(\d+\.?\d*)<\/TargetFramework>/);
  if (match) {
    return match[1];
  }

  return undefined;
}

/**
 * Get C# version for .NET version
 */
function getCSharpVersion(dotnetVersion: string | undefined): string {
  const version = parseFloat(dotnetVersion || '8');
  if (version >= 13) return '13';
  if (version >= 12) return '12';
  if (version >= 11) return '11';
  if (version >= 10) return '10';
  if (version >= 9) return '13';
  if (version >= 8) return '12';
  if (version >= 7) return '11';
  return '10';
}

/**
 * Detect .NET framework (Aspire, etc.)
 */
async function detectDotNetFramework(root: string): Promise<string | undefined> {
  // Check for Aspire
  const aspireFiles = await glob('**/*AppHost*.csproj', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**'],
  });

  if (aspireFiles.length > 0) {
    // Verify it's actually Aspire by checking for Aspire references
    const appHostPath = join(root, aspireFiles[0]);
    const content = readFileSync(appHostPath, 'utf-8');
    if (content.includes('Aspire')) {
      return '.NET Aspire';
    }
  }

  // Check for other frameworks
  const webApiProjects = await glob('**/*.csproj', { cwd: root });
  for (const proj of webApiProjects) {
    const content = readFileSync(join(root, proj), 'utf-8');
    if (content.includes('Microsoft.AspNetCore')) {
      return 'ASP.NET Core';
    }
  }

  return undefined;
}

/**
 * Detect Aspire AppHost path
 */
async function detectAspireAppHost(root: string): Promise<string | undefined> {
  const appHostDirs = await glob('**/AppHost', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**'],
  });

  if (appHostDirs.length > 0) {
    return appHostDirs[0];
  }

  // Also check for *AppHost directories
  const appHostProjects = await glob('**/*AppHost', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**'],
  });

  return appHostProjects[0];
}

/**
 * Detect database from appsettings.json
 */
async function detectDatabaseFromAppSettings(
  root: string
): Promise<{ type: string; orm?: string } | undefined> {
  const appSettingsFiles = await glob('**/appsettings*.json', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**'],
  });

  for (const file of appSettingsFiles) {
    try {
      const content = readFileSync(join(root, file), 'utf-8');

      if (content.includes('Npgsql') || content.includes('PostgreSQL') || content.includes('postgres')) {
        return { type: 'PostgreSQL', orm: 'EF Core' };
      }
      if (content.includes('SqlServer') || content.includes('MSSQL')) {
        return { type: 'SQL Server', orm: 'EF Core' };
      }
      if (content.includes('MySql') || content.includes('mysql')) {
        return { type: 'MySQL', orm: 'EF Core' };
      }
      if (content.includes('Sqlite') || content.includes('sqlite')) {
        return { type: 'SQLite', orm: 'EF Core' };
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check csproj for EF Core packages
  const csprojFiles = await glob('**/*.csproj', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**'],
  });

  for (const proj of csprojFiles) {
    const content = readFileSync(join(root, proj), 'utf-8');
    if (content.includes('Npgsql.EntityFrameworkCore')) {
      return { type: 'PostgreSQL', orm: 'EF Core' };
    }
    if (content.includes('Microsoft.EntityFrameworkCore.SqlServer')) {
      return { type: 'SQL Server', orm: 'EF Core' };
    }
  }

  return undefined;
}

/**
 * Detect .NET project paths
 */
function detectDotNetPaths(
  root: string,
  csprojFiles: string[]
): { source: string[]; tests: string[] } {
  const source: string[] = [];
  const tests: string[] = [];

  for (const proj of csprojFiles) {
    const dir = dirname(proj);
    const name = basename(dir).toLowerCase();

    if (
      name.includes('test') ||
      name.includes('spec') ||
      name.endsWith('.tests') ||
      name.endsWith('.test')
    ) {
      tests.push(dir);
    } else {
      source.push(dir);
    }
  }

  return { source, tests };
}

/**
 * Detect Node.js projects
 */
async function detectNode(root: string): Promise<DetectionResult> {
  const packageJsonPath = join(root, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return { runtime: { type: 'unknown' }, paths: { root, source: [], tests: [] } };
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Detect version
    const version = pkg.engines?.node?.replace(/[^0-9.]/g, '') || '20';

    // Detect framework
    const framework = detectNodeFramework(pkg);

    // Detect TypeScript
    const isTypeScript =
      existsSync(join(root, 'tsconfig.json')) ||
      pkg.devDependencies?.typescript ||
      pkg.dependencies?.typescript;

    // Detect database
    const database = detectNodeDatabase(pkg);

    // Detect paths
    const source = findNodeSourcePaths(root);
    const tests = findNodeTestPaths(root);
    const frontend = pkg.dependencies?.react || pkg.dependencies?.vue || pkg.dependencies?.svelte
      ? source[0] || 'src'
      : undefined;

    return {
      runtime: {
        type: 'node',
        version,
        language: isTypeScript ? 'TypeScript' : 'JavaScript',
      },
      framework,
      database,
      paths: {
        root,
        source,
        tests,
        frontend,
      },
      buildCommand: pkg.scripts?.build ? 'npm run build' : undefined,
      testCommand: pkg.scripts?.test ? 'npm test' : undefined,
      runCommand: pkg.scripts?.start
        ? 'npm start'
        : pkg.scripts?.dev
        ? 'npm run dev'
        : undefined,
    };
  } catch {
    return { runtime: { type: 'unknown' }, paths: { root, source: [], tests: [] } };
  }
}

/**
 * Detect Node.js framework from package.json
 */
function detectNodeFramework(pkg: Record<string, unknown>): string | undefined {
  const deps = {
    ...(pkg.dependencies as Record<string, unknown> || {}),
    ...(pkg.devDependencies as Record<string, unknown> || {})
  };

  if (deps['next']) return 'Next.js';
  if (deps['nuxt']) return 'Nuxt';
  if (deps['@remix-run/react']) return 'Remix';
  if (deps['gatsby']) return 'Gatsby';
  if (deps['express']) return 'Express';
  if (deps['fastify']) return 'Fastify';
  if (deps['nest'] || deps['@nestjs/core']) return 'NestJS';
  if (deps['hono']) return 'Hono';
  if (deps['react']) return 'React';
  if (deps['vue']) return 'Vue';
  if (deps['svelte']) return 'Svelte';
  if (deps['angular'] || deps['@angular/core']) return 'Angular';

  return undefined;
}

/**
 * Detect database from Node.js dependencies
 */
function detectNodeDatabase(pkg: Record<string, unknown>): { type: string; orm?: string } | undefined {
  const deps = {
    ...(pkg.dependencies as Record<string, unknown> || {}),
    ...(pkg.devDependencies as Record<string, unknown> || {})
  };

  if (deps['pg'] || deps['postgres']) {
    const orm = deps['prisma']
      ? 'Prisma'
      : deps['drizzle-orm']
      ? 'Drizzle'
      : deps['typeorm']
      ? 'TypeORM'
      : deps['sequelize']
      ? 'Sequelize'
      : undefined;
    return { type: 'PostgreSQL', orm };
  }
  if (deps['mysql'] || deps['mysql2']) {
    return { type: 'MySQL', orm: deps['prisma'] ? 'Prisma' : undefined };
  }
  if (deps['mongodb'] || deps['mongoose']) {
    return { type: 'MongoDB', orm: deps['mongoose'] ? 'Mongoose' : undefined };
  }
  if (deps['better-sqlite3'] || deps['sqlite3']) {
    return { type: 'SQLite', orm: deps['prisma'] ? 'Prisma' : undefined };
  }

  return undefined;
}

/**
 * Find Node.js source paths
 */
function findNodeSourcePaths(root: string): string[] {
  const paths: string[] = [];

  // Check common source directories
  const commonDirs = ['src', 'lib', 'app', 'pages', 'components'];
  for (const dir of commonDirs) {
    if (existsSync(join(root, dir))) {
      paths.push(dir);
    }
  }

  return paths.length > 0 ? paths : ['src'];
}

/**
 * Find Node.js test paths
 */
function findNodeTestPaths(root: string): string[] {
  const paths: string[] = [];

  // Check common test directories
  const commonDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
  for (const dir of commonDirs) {
    if (existsSync(join(root, dir))) {
      paths.push(dir);
    }
  }

  return paths;
}

/**
 * Detect Python projects
 */
async function detectPython(root: string): Promise<DetectionResult> {
  const hasRequirements = existsSync(join(root, 'requirements.txt'));
  const hasPyproject = existsSync(join(root, 'pyproject.toml'));
  const hasSetupPy = existsSync(join(root, 'setup.py'));

  if (!hasRequirements && !hasPyproject && !hasSetupPy) {
    return { runtime: { type: 'unknown' }, paths: { root, source: [], tests: [] } };
  }

  // Detect framework from requirements
  let framework: string | undefined;
  if (hasRequirements) {
    const content = readFileSync(join(root, 'requirements.txt'), 'utf-8');
    if (content.includes('django')) framework = 'Django';
    else if (content.includes('fastapi')) framework = 'FastAPI';
    else if (content.includes('flask')) framework = 'Flask';
  }

  return {
    runtime: {
      type: 'python',
      version: '3.11',
      language: 'Python',
    },
    framework,
    paths: {
      root,
      source: findSourceDirectories(root),
      tests: findTestDirectories(root),
    },
    buildCommand: undefined,
    testCommand: 'pytest',
    runCommand: framework === 'Django' ? 'python manage.py runserver' : 'python main.py',
  };
}

/**
 * Detect Go projects
 */
async function detectGo(root: string): Promise<DetectionResult> {
  if (!existsSync(join(root, 'go.mod'))) {
    return { runtime: { type: 'unknown' }, paths: { root, source: [], tests: [] } };
  }

  // Extract Go version from go.mod
  const content = readFileSync(join(root, 'go.mod'), 'utf-8');
  const versionMatch = content.match(/^go\s+(\d+\.\d+)/m);
  const version = versionMatch ? versionMatch[1] : '1.21';

  return {
    runtime: {
      type: 'go',
      version,
      language: 'Go',
    },
    paths: {
      root,
      source: ['cmd', 'internal', 'pkg'].filter(d => existsSync(join(root, d))),
      tests: [],
    },
    buildCommand: 'go build',
    testCommand: 'go test ./...',
    runCommand: 'go run .',
  };
}

/**
 * Detect Rust projects
 */
async function detectRust(root: string): Promise<DetectionResult> {
  if (!existsSync(join(root, 'Cargo.toml'))) {
    return { runtime: { type: 'unknown' }, paths: { root, source: [], tests: [] } };
  }

  return {
    runtime: {
      type: 'rust',
      version: '1.75',
      language: 'Rust',
    },
    paths: {
      root,
      source: ['src'],
      tests: ['tests'].filter(d => existsSync(join(root, d))),
    },
    buildCommand: 'cargo build',
    testCommand: 'cargo test',
    runCommand: 'cargo run',
  };
}

/**
 * Find source directories (generic)
 */
function findSourceDirectories(root: string): string[] {
  const common = ['src', 'lib', 'app', 'source', 'code'];
  return common.filter(d => {
    const path = join(root, d);
    return existsSync(path) && statSync(path).isDirectory();
  });
}

/**
 * Find test directories (generic)
 */
function findTestDirectories(root: string): string[] {
  const common = ['test', 'tests', '__tests__', 'spec', 'specs'];
  return common.filter(d => {
    const path = join(root, d);
    return existsSync(path) && statSync(path).isDirectory();
  });
}

/**
 * Format detection result as human-readable summary
 */
export function formatDetectionSummary(result: DetectionResult): string {
  const lines: string[] = [];

  lines.push(`Runtime: ${result.runtime.type}`);
  if (result.runtime.version) {
    lines.push(`Version: ${result.runtime.version}`);
  }
  if (result.runtime.language) {
    lines.push(`Language: ${result.runtime.language}`);
  }
  if (result.framework) {
    lines.push(`Framework: ${result.framework}`);
  }
  if (result.database) {
    lines.push(`Database: ${result.database.type}${result.database.orm ? ` (${result.database.orm})` : ''}`);
  }
  if (result.paths.source.length > 0) {
    lines.push(`Source: ${result.paths.source.join(', ')}`);
  }
  if (result.paths.tests.length > 0) {
    lines.push(`Tests: ${result.paths.tests.join(', ')}`);
  }
  if (result.buildCommand) {
    lines.push(`Build: ${result.buildCommand}`);
  }

  return lines.join('\n');
}
