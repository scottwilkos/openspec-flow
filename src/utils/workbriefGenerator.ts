/**
 * Work Brief Generator
 * Creates comprehensive work briefs for Claude-Flow consumption
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { OpenSpecChange, WorkBrief, TaskItem, TechStackContext } from '../types.js';
import { parseTasks, loadProjectContext, loadClaudeMd } from './openspec.js';
import { loadConfig, configExists, getComputedConfig } from './configLoader.js';

/**
 * Generate work brief for a change
 */
export function generateWorkBrief(change: OpenSpecChange): string {
  const workBrief: WorkBrief = {
    changeId: change.changeId,
    generatedAt: new Date().toISOString(),
    summary: extractSummary(change),
    tasks: change.tasks ? parseTasks(change.tasks) : [],
    impactedSpecs: extractImpactedSpecs(change),
    architectureContext: buildArchitectureContext(change),
    techStack: extractTechStack(),
    constraints: extractConstraints(),
  };

  return formatWorkBrief(workBrief);
}

/**
 * Extract summary from proposal
 */
function extractSummary(change: OpenSpecChange): string {
  if (!change.proposal) {
    return `Change: ${change.changeId}`;
  }

  // Extract "Why" and "What Changes" sections
  const whyMatch = change.proposal.match(/##\s+Why\s*\n([\s\S]*?)(?=\n##|$)/i);
  const whatMatch = change.proposal.match(/##\s+What Changes?\s*\n([\s\S]*?)(?=\n##|$)/i);

  let summary = '';
  if (whyMatch) {
    summary += `**Why**: ${whyMatch[1].trim()}\n\n`;
  }
  if (whatMatch) {
    summary += `**What Changes**: ${whatMatch[1].trim()}`;
  }

  return summary || change.proposal.substring(0, 500);
}

/**
 * Extract impacted specs from change
 */
function extractImpactedSpecs(change: OpenSpecChange): string[] {
  const specs: string[] = [];

  // From spec deltas
  for (const specPath of change.specs) {
    const relPath = specPath.replace(/^openspec\/changes\/[^/]+\//, '');
    specs.push(relPath);
  }

  // Try to infer from proposal "Impact" section
  if (change.proposal) {
    const impactMatch = change.proposal.match(/##\s+Impact\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (impactMatch) {
      const specMatches = impactMatch[1].matchAll(/specs\/([^\s,]+)/g);
      for (const match of specMatches) {
        const specPath = `specs/${match[1]}`;
        if (!specs.includes(specPath)) {
          specs.push(specPath);
        }
      }
    }
  }

  return specs;
}

/**
 * Build architecture context section
 */
function buildArchitectureContext(change: OpenSpecChange): string {
  const context: string[] = [];
  const projectName = configExists() ? loadConfig().project.name : 'Project';

  context.push('## Architecture & Technical Context');
  context.push('');
  context.push(`This change must integrate with the ${projectName} architecture:`);
  context.push('');

  // Check for specific architectural concerns
  if (change.design) {
    context.push('### Design Considerations');
    context.push('');
    context.push('See `design.md` in this change for detailed technical decisions.');
    context.push('');
  }

  // Reference project-context.md
  context.push('### Reference Documents');
  context.push('');
  context.push('- **CLAUDE.md**: High-level Claude Code guidance and conventions');
  context.push('- **CLAUDE-FLOW.md**: Swarm orchestration configuration and agent behavior');
  context.push('- **docs/project-context.md**: Complete tech stack and architectural requirements');
  context.push('- **docs/openspec-claude-flow.md**: OpenSpec + Claude-Flow integration architecture');
  context.push('- **MVP-PRD/**: Product requirements and domain model');
  context.push('');

  return context.join('\n');
}

/**
 * Extract tech stack from config or use defaults
 */
function extractTechStack(): TechStackContext {
  // Try to load from config first
  if (configExists()) {
    const config = loadConfig();
    const computed = getComputedConfig(config);
    return {
      runtime: computed.runtimeFull || 'Not configured',
      orchestration: config.tech.orchestration?.name || 'Not configured',
      database: computed.databaseFull || 'Not configured',
      messaging: computed.messagingFull || 'Not configured',
      storage: computed.storageFull || 'Not configured',
      patterns: config.patterns.architecture || [],
    };
  }

  // Fallback to defaults if no config exists
  return {
    runtime: 'Not configured - run openspec-flow init',
    orchestration: 'Not configured',
    database: 'Not configured',
    messaging: 'Not configured',
    storage: 'Not configured',
    patterns: [],
  };
}

/**
 * Extract constraints from config or CLAUDE.md
 */
function extractConstraints(): string[] {
  // Try to load from config first
  if (configExists()) {
    const config = loadConfig();
    if (config.constraints.constraints && config.constraints.constraints.length > 0) {
      return config.constraints.constraints.map(c => `${c.name}: ${c.rule}`);
    }
  }

  // Fallback to default constraint
  return [
    'File Organization: NEVER save files to root folder - use proper directories',
  ];
}

/**
 * Load CLAUDE-FLOW.md configuration if it exists
 */
function loadClaudeFlowMd(): string | null {
  const claudeFlowPath = join(process.cwd(), 'CLAUDE-FLOW.md');

  if (existsSync(claudeFlowPath)) {
    return readFileSync(claudeFlowPath, 'utf-8');
  }

  return null;
}

/**
 * Load OpenSpec-Claude-Flow integration documentation
 */
function loadIntegrationDocs(): string | null {
  const integrationDocsPath = join(process.cwd(), 'docs', 'openspec-claude-flow.md');

  if (existsSync(integrationDocsPath)) {
    return readFileSync(integrationDocsPath, 'utf-8');
  }

  return null;
}

/**
 * Format work brief as markdown
 */
function formatWorkBrief(brief: WorkBrief): string {
  const lines: string[] = [];

  lines.push(`# Work Brief: ${brief.changeId}`);
  lines.push('');
  lines.push(`**Generated**: ${new Date(brief.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(brief.summary);
  lines.push('');

  // Tasks
  if (brief.tasks.length > 0) {
    lines.push('## Implementation Tasks');
    lines.push('');
    for (const task of brief.tasks) {
      const checkbox = task.completed ? '[x]' : '[ ]';
      lines.push(`- ${checkbox} ${task.description}`);
    }
    lines.push('');
  }

  // Impacted Specs
  if (brief.impactedSpecs.length > 0) {
    lines.push('## Impacted Specifications');
    lines.push('');
    for (const spec of brief.impactedSpecs) {
      lines.push(`- \`${spec}\``);
    }
    lines.push('');
  }

  // Tech Stack
  lines.push('## Technology Stack');
  lines.push('');
  lines.push(`- **Runtime**: ${brief.techStack.runtime}`);
  lines.push(`- **Orchestration**: ${brief.techStack.orchestration}`);
  lines.push(`- **Database**: ${brief.techStack.database}`);
  lines.push(`- **Messaging**: ${brief.techStack.messaging}`);
  lines.push(`- **Storage**: ${brief.techStack.storage}`);
  lines.push('');
  lines.push('**Patterns**:');
  for (const pattern of brief.techStack.patterns) {
    lines.push(`- ${pattern}`);
  }
  lines.push('');

  // Architecture Context
  lines.push(brief.architectureContext);

  // Constraints
  lines.push('## Critical Constraints');
  lines.push('');
  for (const constraint of brief.constraints) {
    lines.push(`- ${constraint}`);
  }
  lines.push('');

  // Next Steps
  lines.push('## Next Steps');
  lines.push('');
  lines.push('1. Review this work brief thoroughly');
  lines.push('2. Load and understand CLAUDE.md, CLAUDE-FLOW.md, and docs/project-context.md');
  lines.push('3. Review swarm orchestration patterns in CLAUDE-FLOW.md');
  lines.push('4. Plan implementation following the configured architecture patterns');
  lines.push('5. Implement changes respecting all constraints');
  lines.push('6. Review against original OpenSpec change');
  lines.push('7. Document in flow-log.md');
  lines.push('');

  // Appendix: Include full CLAUDE-FLOW.md and integration docs
  lines.push('---');
  lines.push('');
  lines.push('# Appendix A: Claude-Flow Configuration');
  lines.push('');

  const claudeFlowContent = loadClaudeFlowMd();
  if (claudeFlowContent) {
    lines.push('**Note**: This is the full content of CLAUDE-FLOW.md for reference during implementation.');
    lines.push('');
    lines.push(claudeFlowContent);
    lines.push('');
  } else {
    lines.push('**Warning**: CLAUDE-FLOW.md not found. Swarm orchestration may not work correctly.');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('# Appendix B: OpenSpec-Claude-Flow Integration');
  lines.push('');

  const integrationDocs = loadIntegrationDocs();
  if (integrationDocs) {
    lines.push('**Note**: This is the full integration documentation for OpenSpec + Claude-Flow.');
    lines.push('');
    lines.push(integrationDocs);
    lines.push('');
  } else {
    lines.push('**Warning**: Integration docs not found at docs/openspec-claude-flow.md');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Save work brief to file
 */
export function saveWorkBrief(change: OpenSpecChange, content: string): string {
  const outputPath = join(change.path, 'work-brief.md');
  writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}
