/**
 * Work command - Generate work brief for a change
 */

import { loadChange } from '../utils/openspec.js';
import { generateWorkBrief, saveWorkBrief } from '../utils/workbriefGenerator.js';

export function workCommand(changeId: string): void {
  console.log('');
  console.log(`Generating work brief for: ${changeId}`);
  console.log('');

  try {
    // Load the change
    const change = loadChange(changeId);

    // Generate work brief
    const workBriefContent = generateWorkBrief(change);

    // Save work brief
    const outputPath = saveWorkBrief(change, workBriefContent);

    console.log('✅ Work brief generated successfully!');
    console.log('');
    console.log(`Output: ${outputPath}`);
    console.log('');
    console.log('Contents:');
    console.log('─'.repeat(60));
    console.log(workBriefContent);
    console.log('─'.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log(`  npm run openspec-flow:implement -- ${changeId}`);
    console.log('');
  } catch (error) {
    console.error('❌ Error generating work brief:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
