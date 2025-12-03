/**
 * Deferred command - Analyze tasks and generate deferred items report
 *
 * Parses tasks.md, categorizes incomplete items, estimates effort,
 * and generates a comprehensive deferred items report.
 */

import { loadChange, parseTasks } from '../utils/openspec.js';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

interface DeferredItem {
  taskId: string;
  description: string;
  section: string;
  category: 'not_started' | 'partial' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedHours: number;
  reason?: string;
  blockedBy?: string;
  subtasks?: { id: string; description: string; completed: boolean }[];
}

interface DeferredReport {
  changeId: string;
  featureName: string;
  generatedAt: string;
  summary: {
    totalTasks: number;
    completedCount: number;
    completedPercent: number;
    deferredCount: number;
    deferredPercent: number;
    estimatedHours: number;
  };
  items: DeferredItem[];
  byCategory: {
    notStarted: DeferredItem[];
    partial: DeferredItem[];
    blocked: DeferredItem[];
  };
  byPriority: {
    critical: DeferredItem[];
    high: DeferredItem[];
    medium: DeferredItem[];
    low: DeferredItem[];
  };
}

export async function deferredCommand(changeId: string): Promise<void> {
  console.log('');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  OpenSpec Deferred Items Analysis: ' + changeId);
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Load change
    console.log('Loading change artifacts...');
    const change = loadChange(changeId);

    const tasksPath = join(change.path, 'tasks.md');
    if (!existsSync(tasksPath)) {
      console.error(`Error: tasks.md not found at ${tasksPath}`);
      process.exit(1);
    }

    // Parse tasks
    const tasksContent = readFileSync(tasksPath, 'utf-8');
    const taskItems = parseTasks(tasksContent);
    console.log(`   Found ${taskItems.length} tasks`);

    // Analyze tasks
    const completedTasks = taskItems.filter(t => t.completed);
    const incompleteTasks = taskItems.filter(t => !t.completed);

    console.log(`   Completed: ${completedTasks.length}`);
    console.log(`   Incomplete: ${incompleteTasks.length}`);
    console.log('');

    // Categorize and estimate deferred items
    const deferredItems: DeferredItem[] = [];

    for (const task of incompleteTasks) {
      const category = categorizeTask(task.description);
      // TaskItem doesn't have section - use 'General' as default
      const section = 'General';
      const priority = inferPriority(task.description, section);
      const effort = estimateEffort(task.description);

      deferredItems.push({
        taskId: `task-${deferredItems.length + 1}`,
        description: task.description,
        section,
        category,
        priority,
        estimatedHours: effort,
        reason: inferDeferralReason(task.description),
      });
    }

    // Build report
    const totalHours = deferredItems.reduce((sum, item) => sum + item.estimatedHours, 0);

    const report: DeferredReport = {
      changeId,
      featureName: changeId, // OpenSpecChange doesn't have title property
      generatedAt: new Date().toISOString(),
      summary: {
        totalTasks: taskItems.length,
        completedCount: completedTasks.length,
        completedPercent: Math.round((completedTasks.length / taskItems.length) * 100),
        deferredCount: incompleteTasks.length,
        deferredPercent: Math.round((incompleteTasks.length / taskItems.length) * 100),
        estimatedHours: totalHours,
      },
      items: deferredItems,
      byCategory: {
        notStarted: deferredItems.filter(i => i.category === 'not_started'),
        partial: deferredItems.filter(i => i.category === 'partial'),
        blocked: deferredItems.filter(i => i.category === 'blocked'),
      },
      byPriority: {
        critical: deferredItems.filter(i => i.priority === 'critical'),
        high: deferredItems.filter(i => i.priority === 'high'),
        medium: deferredItems.filter(i => i.priority === 'medium'),
        low: deferredItems.filter(i => i.priority === 'low'),
      },
    };

    // Generate report file
    const docsDir = join(process.cwd(), '_docs', 'features', changeId);
    mkdirSync(docsDir, { recursive: true });

    const reportPath = join(docsDir, 'deferred.md');
    const reportContent = generateDeferredReport(report);
    writeFileSync(reportPath, reportContent, 'utf-8');

    // Display summary
    console.log('Generated deferred items report');
    console.log('');
    console.log(`Summary: ${changeId}`);
    console.log(`   Total: ${report.summary.totalTasks} | Completed: ${report.summary.completedCount} (${report.summary.completedPercent}%) | Deferred: ${report.summary.deferredCount} (${report.summary.deferredPercent}%)`);
    console.log('');
    console.log(`Saved to: ${reportPath}`);
    console.log('');

    if (report.byPriority.critical.length > 0 || report.byPriority.high.length > 0) {
      console.log('Highest Priority Deferred:');
      const topItems = [...report.byPriority.critical, ...report.byPriority.high].slice(0, 3);
      for (let i = 0; i < topItems.length; i++) {
        console.log(`   ${i + 1}. ${topItems[i].description}`);
      }
      console.log('');
    }

    console.log('By Category:');
    console.log(`   Not Started: ${report.byCategory.notStarted.length} items`);
    console.log(`   Partially Done: ${report.byCategory.partial.length} items`);
    console.log(`   Blocked: ${report.byCategory.blocked.length} items`);
    console.log('');

    console.log(`Estimated Effort: ${totalHours} hours to complete all deferred`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error('Error analyzing deferred items:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    process.exit(1);
  }
}

function categorizeTask(description: string): 'not_started' | 'partial' | 'blocked' {
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('blocked') || lowerDesc.includes('waiting') || lowerDesc.includes('depends on')) {
    return 'blocked';
  }

  if (lowerDesc.includes('partial') || lowerDesc.includes('started') || lowerDesc.includes('in progress')) {
    return 'partial';
  }

  return 'not_started';
}

function inferPriority(description: string, section?: string): 'critical' | 'high' | 'medium' | 'low' {
  const lowerDesc = description.toLowerCase();
  const lowerSection = (section || '').toLowerCase();

  // Critical: security, data integrity, blocks others
  if (lowerDesc.includes('security') || lowerDesc.includes('auth') ||
      lowerDesc.includes('critical') || lowerDesc.includes('blocker')) {
    return 'critical';
  }

  // High: core functionality, domain model, API
  if (lowerSection.includes('domain') || lowerSection.includes('api') ||
      lowerDesc.includes('endpoint') || lowerDesc.includes('command') ||
      lowerDesc.includes('query') || lowerDesc.includes('grain')) {
    return 'high';
  }

  // Low: documentation, edge cases
  if (lowerDesc.includes('doc') || lowerDesc.includes('comment') ||
      lowerDesc.includes('edge case') || lowerDesc.includes('optional')) {
    return 'low';
  }

  // Default to medium
  return 'medium';
}

function estimateEffort(description: string): number {
  const lowerDesc = description.toLowerCase();

  // Simple task (single line, < 20 chars): 0.5 hours
  if (description.length < 20) {
    return 0.5;
  }

  // Large task (workflow, system, integration): 4-8 hours
  if (lowerDesc.includes('workflow') || lowerDesc.includes('system') ||
      lowerDesc.includes('integration') || lowerDesc.includes('migrate')) {
    return 6;
  }

  // Complex task (service, grain, handler): 2-4 hours
  if (lowerDesc.includes('service') || lowerDesc.includes('grain') ||
      lowerDesc.includes('handler') || lowerDesc.includes('refactor')) {
    return 3;
  }

  // Medium task (API endpoint, component, test): 1-2 hours
  if (lowerDesc.includes('endpoint') || lowerDesc.includes('component') ||
      lowerDesc.includes('test') || lowerDesc.includes('api')) {
    return 1.5;
  }

  // Default
  return 1;
}

function inferDeferralReason(description: string): string {
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('blocked')) {
    return 'Blocked by external dependency';
  }
  if (lowerDesc.includes('waiting')) {
    return 'Waiting for prerequisite';
  }
  if (lowerDesc.includes('optional')) {
    return 'Optional enhancement';
  }
  if (lowerDesc.includes('future')) {
    return 'Planned for future iteration';
  }

  return 'Not yet started';
}

function generateDeferredReport(report: DeferredReport): string {
  return `# Deferred Items - ${report.changeId}

> **Auto-generated** by \`/openspec-flow:deferred\` command.
> Analyzes tasks.md for incomplete items and categorizes them.

**Feature**: ${report.featureName}
**Generated**: ${report.generatedAt}
**Tasks File**: \`openspec-flow/changes/${report.changeId}/tasks.md\`

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | ${report.summary.totalTasks} |
| **Completed** | ${report.summary.completedCount} (${report.summary.completedPercent}%) |
| **Deferred** | ${report.summary.deferredCount} (${report.summary.deferredPercent}%) |
| **Est. Hours to Complete** | ${report.summary.estimatedHours} |

---

## By Category

### Not Started (${report.byCategory.notStarted.length})

> Tasks that haven't been started yet.

${report.byCategory.notStarted.length > 0 ?
  report.byCategory.notStarted.map(item => `- [ ] **${item.taskId}** - ${item.description}
  - **Section**: ${item.section}
  - **Why Deferred**: ${item.reason}
  - **Est. Effort**: ${item.estimatedHours} hours
  - **Priority**: ${item.priority}`).join('\n\n') :
  '*None*'}

---

### Partially Completed (${report.byCategory.partial.length})

> Tasks with some sub-items completed.

${report.byCategory.partial.length > 0 ?
  report.byCategory.partial.map(item => `- [ ] **${item.taskId}** - ${item.description}
  - **Section**: ${item.section}
  - **Why Incomplete**: ${item.reason}
  - **Est. Remaining**: ${item.estimatedHours} hours`).join('\n\n') :
  '*None*'}

---

### Blocked (${report.byCategory.blocked.length})

> Tasks waiting on external dependencies.

${report.byCategory.blocked.length > 0 ?
  report.byCategory.blocked.map(item => `- [ ] **${item.taskId}** - ${item.description}
  - **Blocked By**: ${item.blockedBy || 'Unknown'}
  - **Section**: ${item.section}`).join('\n\n') :
  '*None*'}

---

## Priority Recommendations

### High Priority (Do Next)

> Items that unblock other work or have high user impact.

${[...report.byPriority.critical, ...report.byPriority.high].length > 0 ?
  [...report.byPriority.critical, ...report.byPriority.high].map((item, i) =>
    `${i + 1}. **${item.taskId}** - ${item.description}
   - **Priority**: ${item.priority}
   - **Est. Effort**: ${item.estimatedHours} hours`).join('\n\n') :
  '*None*'}

### Medium Priority (Post-MVP)

> Nice-to-have items that can wait.

${report.byPriority.medium.length > 0 ?
  report.byPriority.medium.map(item => `- ${item.taskId} - ${item.description} (${item.estimatedHours}h)`).join('\n') :
  '*None*'}

### Low Priority (Future Enhancement)

> Items that are genuinely optional.

${report.byPriority.low.length > 0 ?
  report.byPriority.low.map(item => `- ${item.taskId} - ${item.description}`).join('\n') :
  '*None*'}

---

## Effort Summary

| Category | Count | Est. Hours |
|----------|-------|------------|
| Not Started (High) | ${report.byCategory.notStarted.filter(i => i.priority === 'high' || i.priority === 'critical').length} | ${report.byCategory.notStarted.filter(i => i.priority === 'high' || i.priority === 'critical').reduce((s, i) => s + i.estimatedHours, 0)} |
| Not Started (Medium) | ${report.byCategory.notStarted.filter(i => i.priority === 'medium').length} | ${report.byCategory.notStarted.filter(i => i.priority === 'medium').reduce((s, i) => s + i.estimatedHours, 0)} |
| Not Started (Low) | ${report.byCategory.notStarted.filter(i => i.priority === 'low').length} | ${report.byCategory.notStarted.filter(i => i.priority === 'low').reduce((s, i) => s + i.estimatedHours, 0)} |
| Partially Done | ${report.byCategory.partial.length} | ${report.byCategory.partial.reduce((s, i) => s + i.estimatedHours, 0)} |
| Blocked | ${report.byCategory.blocked.length} | ${report.byCategory.blocked.reduce((s, i) => s + i.estimatedHours, 0)} |
| **Total** | **${report.summary.deferredCount}** | **${report.summary.estimatedHours}** |

---

## Next Steps

1. **Review high-priority items** with product team
2. **Plan follow-up OpenSpec** for deferred features
3. **Document blockers** in project management tool
4. **Update timeline** based on effort estimates

---

## Related Documents

- \`decisions.md\` - Why certain items were deprioritized
- \`priorities.md\` - Full priority change history
- \`implementation-notes.md\` - Context on partial completions
`;
}
