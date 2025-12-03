/**
 * List command - Display all OpenSpec changes
 */

import { listChanges } from '../utils/openspec.js';

export function listCommand(): void {
  console.log('');
  console.log('OpenSpec Changes');
  console.log('================');
  console.log('');

  const changes = listChanges();

  if (changes.length === 0) {
    console.log('No changes found in openspec/changes/');
    console.log('');
    return;
  }

  // Calculate column widths
  const maxIdLength = Math.max(...changes.map(c => c.changeId.length), 10);
  const maxTitleLength = Math.max(...changes.map(c => c.title.length), 30);

  // Header
  const idHeader = 'Change ID'.padEnd(maxIdLength);
  const titleHeader = 'Title'.padEnd(maxTitleLength);
  const statusHeader = 'Status'.padEnd(12);
  const tasksHeader = 'Tasks';

  console.log(`${idHeader}  ${titleHeader}  ${statusHeader}  ${tasksHeader}`);
  console.log('─'.repeat(maxIdLength + maxTitleLength + 30));

  // Rows
  for (const change of changes) {
    const id = change.changeId.padEnd(maxIdLength);
    const title = truncate(change.title, maxTitleLength).padEnd(maxTitleLength);
    const status = formatStatus(change.status).padEnd(12);
    const tasks = `${change.tasksCompleted}/${change.tasksTotal}`;

    console.log(`${id}  ${title}  ${status}  ${tasks}`);
  }

  console.log('');
  console.log(`Total: ${changes.length} change(s)`);
  console.log('');
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'todo': '📋 TODO',
    'in-progress': '🔄 IN PROGRESS',
    'done': '✅ DONE',
    'unknown': '❓ UNKNOWN',
  };
  return statusMap[status] || status;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
