/**
 * Change analysis utilities
 * Analyzes OpenSpec changes for size, complexity, and phase recommendations
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadChange, parseTasks } from './openspec.js';
import {
  AnalysisResult,
  ChangeMetrics,
  SizingAssessment,
  ComplexityFactor,
  PhaseBoundary,
} from '../types.js';

// Sizing thresholds
const THRESHOLDS = {
  tasks: {
    green: 15,
    yellow: 30,
  },
  tokens: {
    green: 15000,
    yellow: 30000,
  },
};

// Complexity factor keywords
const COMPLEXITY_KEYWORDS: Record<string, string[]> = {
  'Database Changes': ['schema', 'migration', 'entity', 'table', 'column', 'database', 'db'],
  'API Surface': ['endpoint', 'route', 'REST', 'GraphQL', 'API', 'controller'],
  'Security': ['auth', 'permission', 'RBAC', 'token', 'encrypt', 'security', 'credential'],
  'Multi-component': ['across', 'multiple', 'refactor', 'throughout', 'all'],
  'External Integration': ['integration', 'third-party', 'external', 'webhook', 'service'],
};

/**
 * Slugify a title for use as a change ID
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .slice(0, 50); // Limit length
}

/**
 * Estimate token count from text (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Detect complexity factors in content
 */
function detectComplexityFactors(content: string): ComplexityFactor[] {
  const factors: ComplexityFactor[] = [];
  const lowerContent = content.toLowerCase();

  for (const [factor, keywords] of Object.entries(COMPLEXITY_KEYWORDS)) {
    const matches: string[] = [];
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }
    if (matches.length > 0) {
      factors.push({
        factor,
        evidence: `Found: ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`,
      });
    }
  }

  return factors;
}

/**
 * Calculate sizing assessment based on metrics
 */
function calculateSizing(metrics: ChangeMetrics): SizingAssessment {
  const { taskCount, tokenEstimate } = metrics;

  // Red: exceeds yellow thresholds
  if (taskCount > THRESHOLDS.tasks.yellow || tokenEstimate > THRESHOLDS.tokens.yellow) {
    return {
      level: 'red',
      label: 'Large',
      recommendation: 'This change is too large for a single implementation. Use /split to decompose into phases.',
    };
  }

  // Yellow: exceeds green thresholds
  if (taskCount > THRESHOLDS.tasks.green || tokenEstimate > THRESHOLDS.tokens.green) {
    return {
      level: 'yellow',
      label: 'Medium',
      recommendation: 'Consider splitting this change into phases for easier implementation.',
    };
  }

  // Green: within all thresholds
  return {
    level: 'green',
    label: 'Small',
    recommendation: 'This change is appropriately sized for direct implementation.',
  };
}

/**
 * Suggest phase boundaries based on task content
 */
function suggestPhases(tasks: { id: string; description: string; completed: boolean }[]): PhaseBoundary[] {
  if (tasks.length <= THRESHOLDS.tasks.green) {
    return [];
  }

  // Group tasks by category keywords
  const categories: Record<string, number[]> = {
    'Setup & Infrastructure': [],
    'Core Implementation': [],
    'Testing & Validation': [],
    'Documentation': [],
  };

  tasks.forEach((task, index) => {
    const lower = task.description.toLowerCase();

    if (lower.includes('setup') || lower.includes('config') || lower.includes('install') ||
        lower.includes('schema') || lower.includes('migration') || lower.includes('infrastructure')) {
      categories['Setup & Infrastructure'].push(index + 1);
    } else if (lower.includes('test') || lower.includes('verify') || lower.includes('validate') ||
               lower.includes('check')) {
      categories['Testing & Validation'].push(index + 1);
    } else if (lower.includes('document') || lower.includes('readme') || lower.includes('comment') ||
               lower.includes('doc')) {
      categories['Documentation'].push(index + 1);
    } else {
      categories['Core Implementation'].push(index + 1);
    }
  });

  // Build phases from non-empty categories
  const phases: PhaseBoundary[] = [];
  let phaseNumber = 1;

  for (const [description, taskIndices] of Object.entries(categories)) {
    if (taskIndices.length > 0) {
      phases.push({
        phaseNumber,
        description,
        taskIndices,
      });
      phaseNumber++;
    }
  }

  // If only one phase, split Core Implementation roughly in half
  if (phases.length === 1 && phases[0].taskIndices.length > THRESHOLDS.tasks.green) {
    const allIndices = phases[0].taskIndices;
    const mid = Math.ceil(allIndices.length / 2);

    return [
      {
        phaseNumber: 1,
        description: 'Phase 1: Initial Implementation',
        taskIndices: allIndices.slice(0, mid),
      },
      {
        phaseNumber: 2,
        description: 'Phase 2: Continued Implementation',
        taskIndices: allIndices.slice(mid),
      },
    ];
  }

  return phases;
}

/**
 * Analyze a change for size, complexity, and phase recommendations
 */
export function analyzeChange(changeId: string): AnalysisResult {
  const change = loadChange(changeId);

  // Calculate content size
  let totalContent = '';
  if (change.proposal) totalContent += change.proposal;
  if (change.tasks) totalContent += change.tasks;
  if (change.design) totalContent += change.design;

  // Add spec content
  for (const specPath of change.specs) {
    if (existsSync(specPath)) {
      totalContent += readFileSync(specPath, 'utf-8');
    }
  }

  // Parse tasks
  const tasks = change.tasks ? parseTasks(change.tasks) : [];
  const completedTasks = tasks.filter(t => t.completed).length;

  // Check for design file
  const designPath = join(change.path, 'design.md');
  const hasDesign = existsSync(designPath);

  // Build metrics
  const metrics: ChangeMetrics = {
    taskCount: tasks.length,
    completedTasks,
    tokenEstimate: estimateTokens(totalContent),
    specCount: change.specs.length,
    hasDesign,
  };

  // Detect complexity
  const complexityFactors = detectComplexityFactors(totalContent);

  // Calculate sizing
  const sizing = calculateSizing(metrics);

  // Suggest phases if yellow or red
  const suggestedPhases = sizing.level !== 'green' ? suggestPhases(tasks) : undefined;

  return {
    changeId,
    metrics,
    sizing,
    complexityFactors,
    suggestedPhases,
  };
}
