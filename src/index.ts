#!/usr/bin/env node

/**
 * OpenSpec-Flow CLI
 * Integration between OpenSpec change management and Claude-Flow automation
 */

import { program } from 'commander';
import { listCommand } from './commands/list.js';
import { workCommand } from './commands/work.js';
import { implementCommand } from './commands/implement.js';
import { batchCommand } from './commands/batch.js';
import { verifyCommand } from './commands/verify.js';
import { deferredCommand } from './commands/deferred.js';
import { initCommand } from './commands/init.js';
import { loadConfig, configExists } from './utils/configLoader.js';

// Get description from config if available, otherwise use generic
const getDescription = (): string => {
  if (configExists()) {
    const config = loadConfig();
    return `OpenSpec + Claude-Flow integration for ${config.project.name}`;
  }
  return 'OpenSpec + Claude-Flow integration tooling';
};

program
  .name('openspec-flow')
  .description(getDescription())
  .version('0.1.2-alpha');

program
  .command('init')
  .description('Initialize openspec-flow configuration for this project')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --description <desc>', 'Project description')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    await initCommand(options);
  });

program
  .command('list')
  .description('List all OpenSpec changes')
  .action(() => {
    listCommand();
  });

program
  .command('work <change-id>')
  .description('Generate work brief for a change')
  .action((changeId: string) => {
    workCommand(changeId);
  });

program
  .command('implement <change-id>')
  .description('Run Claude-Flow implementation for a change')
  .action(async (changeId: string) => {
    await implementCommand(changeId);
  });

program
  .command('batch <change-ids...>')
  .description('Execute multiple changes with hive orchestration')
  .action(async (changeIds: string[]) => {
    await batchCommand(changeIds);
  });

program
  .command('verify <change-id>')
  .description('Verify implementation with E2E testing and documentation check')
  .action(async (changeId: string) => {
    await verifyCommand(changeId);
  });

program
  .command('deferred <change-id>')
  .description('Analyze tasks and generate deferred items report')
  .action(async (changeId: string) => {
    await deferredCommand(changeId);
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();
