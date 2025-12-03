/**
 * Verify command - Comprehensive verification of OpenSpec implementations
 *
 * Performs:
 * - E2E testing via Playwright MCP (after user starts AppHost)
 * - Documentation completeness check
 * - Lessons learned documentation
 * - Gap identification with interactive follow-up generation
 */

import { loadChange, parseTasks } from '../utils/openspec.js';
import { loadConfig, configExists } from '../utils/configLoader.js';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as readline from 'readline';

// Verification result types
interface VerificationResult {
  status: 'verified' | 'gaps-found' | 'failed';
  buildVerification: BuildResult;
  e2eVerification: E2EResult;
  documentationVerification: DocumentationResult;
  gaps: Gap[];
  followUps: FollowUp[];
}

interface BuildResult {
  dotnetBuild: { passed: boolean; warnings: number; errors: number };
  typeCheck: { passed: boolean; errors: number } | null;
}

interface E2EResult {
  appHostStarted: boolean;
  userConfirmed: boolean;
  endpointsTested: EndpointTest[];
  uiFlowsVerified: UIFlowTest[];
  issuesFound: string[];
}

interface EndpointTest {
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number | null;
  passed: boolean;
}

interface UIFlowTest {
  page: string;
  flow: string;
  passed: boolean;
  notes?: string;
}

interface DocumentationResult {
  flowLogExists: boolean;
  flowLogComplete: boolean;
  lessonsLearnedExists: boolean;
  decisionsDocumented: boolean;
  specsUpdated: boolean;
  tasksAccurate: boolean;
}

interface Gap {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  category: 'functionality' | 'tests' | 'documentation' | 'other';
  description: string;
  suggestedAction?: string;
}

interface FollowUp {
  gapId: string;
  changeId: string;
  description: string;
}

export async function verifyCommand(changeId: string): Promise<void> {
  console.log('');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  OpenSpec Verification: ' + changeId);
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    // Phase 1: Pre-flight checks
    console.log('Step 1: Loading change artifacts...');
    const change = loadChange(changeId);

    const tasksPath = join(change.path, 'tasks.md');
    const flowLogPath = join(change.path, 'flow-log.md');
    const workBriefPath = join(change.path, 'work-brief.md');

    const hasTasksMd = existsSync(tasksPath);
    const hasFlowLog = existsSync(flowLogPath);
    const hasWorkBrief = existsSync(workBriefPath);

    let tasksContent = '';
    let taskItems: ReturnType<typeof parseTasks> = [];

    if (hasTasksMd) {
      tasksContent = readFileSync(tasksPath, 'utf-8');
      taskItems = parseTasks(tasksContent);
      console.log(`   Found tasks.md (${taskItems.length} tasks)`);
    } else {
      console.log('   tasks.md not found');
    }

    if (hasFlowLog) {
      console.log('   Found flow-log.md');
    } else {
      console.log('   flow-log.md not found');
    }

    if (hasWorkBrief) {
      console.log('   Found work-brief.md');
    } else {
      console.log('   work-brief.md not found');
    }
    console.log('');

    // Phase 2: Build verification
    console.log('Step 2: Build verification...');
    console.log('   (Build verification should be run by Claude using Bash tool)');
    console.log('   Expected commands:');

    // Use config-based commands if available
    if (configExists()) {
      const config = loadConfig();
      const buildCmd = config.project.build?.command || 'npm run build';
      const buildTarget = config.project.build?.solution
        ? `${config.paths.solution?.root || '.'}/${config.project.build.solution}`
        : '';
      console.log(`     ${buildCmd}${buildTarget ? ' ' + buildTarget : ''}`);

      // Check for frontend type-check
      if (config.paths.frontend?.root) {
        console.log(`     cd ${config.paths.solution?.root || '.'}/${config.paths.frontend.root} && npm run type-check`);
      }
    } else {
      console.log('     (Run openspec-flow init to configure build commands)');
    }
    console.log('');

    const buildConfirm = await askQuestion('   Has the build passed with 0 warnings, 0 errors? [y/N]: ');
    const buildPassed = buildConfirm.toLowerCase() === 'y';

    if (buildPassed) {
      console.log('   Build verification confirmed');
    } else {
      console.log('   Build verification failed or not completed');
    }
    console.log('');

    // Phase 3: Application startup prompt
    console.log('Step 3: Application required for E2E testing');
    console.log('');
    console.log('   Please start the application:');

    // Use config-based run command if available
    if (configExists()) {
      const config = loadConfig();
      const runCmd = config.project.run?.command || 'npm start';
      const runProject = config.project.run?.project
        ? `${config.paths.solution?.root || '.'}/${config.project.run.project}`
        : '';

      if (runProject) {
        console.log(`   cd ${runProject} && ${runCmd}`);
      } else {
        console.log(`   ${runCmd}`);
      }

      if (config.project.run?.port) {
        console.log(`   (Expected port: ${config.project.run.port})`);
      }
    } else {
      console.log('   (Run openspec-flow init to configure run commands)');
    }
    console.log('');

    const appHostReady = await askQuestion('   Press Enter when services are ready (or type "skip" to skip E2E)... ');
    const skipE2E = appHostReady.toLowerCase() === 'skip';

    let e2eResult: E2EResult = {
      appHostStarted: !skipE2E,
      userConfirmed: !skipE2E,
      endpointsTested: [],
      uiFlowsVerified: [],
      issuesFound: [],
    };

    if (!skipE2E) {
      console.log('');
      console.log('Step 4: E2E Testing via Playwright MCP...');
      console.log('   (E2E testing should be performed by Claude using Playwright MCP tools)');
      console.log('');
      console.log('   Claude should use these Playwright MCP tools:');
      console.log('     mcp__playwright__browser_navigate');
      console.log('     mcp__playwright__browser_snapshot');
      console.log('     mcp__playwright__browser_click');
      console.log('     mcp__playwright__browser_type');
      console.log('');
      console.log('   Suggested tests based on tasks.md:');

      // Extract potential API endpoints and UI pages from tasks
      const apiTasks = taskItems.filter(t =>
        t.description.toLowerCase().includes('api') ||
        t.description.toLowerCase().includes('endpoint')
      );
      const uiTasks = taskItems.filter(t =>
        t.description.toLowerCase().includes('ui') ||
        t.description.toLowerCase().includes('page') ||
        t.description.toLowerCase().includes('component')
      );

      if (apiTasks.length > 0) {
        console.log('');
        console.log('   API Endpoints to test:');
        for (const task of apiTasks) {
          console.log(`     - ${task.description}`);
        }
      }

      if (uiTasks.length > 0) {
        console.log('');
        console.log('   UI Flows to verify:');
        for (const task of uiTasks) {
          console.log(`     - ${task.description}`);
        }
      }

      console.log('');
      const e2eConfirm = await askQuestion('   Have all E2E tests been performed? [y/N]: ');
      const e2ePassed = e2eConfirm.toLowerCase() === 'y';

      if (e2ePassed) {
        console.log('   E2E testing confirmed');
      } else {
        console.log('   E2E testing not completed');
        e2eResult.issuesFound.push('E2E testing not completed');
      }
    } else {
      console.log('');
      console.log('E2E testing skipped - verification will be marked incomplete');
    }
    console.log('');

    // Phase 5: Documentation verification
    console.log('Step 5: Documentation verification...');

    const docsDir = join('_docs', 'features', changeId);
    const decisionsPath = join(docsDir, 'decisions.md');
    const lessonsPath = join(docsDir, 'lessons-learned.md');
    const specsDir = join('openspec-flow', 'specs');

    const docResult: DocumentationResult = {
      flowLogExists: hasFlowLog,
      flowLogComplete: false,
      lessonsLearnedExists: existsSync(lessonsPath),
      decisionsDocumented: existsSync(decisionsPath),
      specsUpdated: existsSync(specsDir) && change.specs.length > 0,
      tasksAccurate: taskItems.filter(t => t.completed).length === taskItems.length,
    };

    // Check flow-log completeness
    if (hasFlowLog) {
      const flowLogContent = readFileSync(flowLogPath, 'utf-8');
      docResult.flowLogComplete =
        flowLogContent.includes('## Summary') &&
        flowLogContent.includes('## Changes Made') &&
        flowLogContent.includes('Status:');
    }

    console.log(`   ${docResult.flowLogExists ? 'Found' : 'Missing'} flow-log.md ${docResult.flowLogComplete ? '(complete)' : '(incomplete)'}`);
    console.log(`   ${docResult.lessonsLearnedExists ? 'Found' : 'Missing'} lessons-learned.md`);
    console.log(`   ${docResult.decisionsDocumented ? 'Found' : 'Missing'} decisions.md`);
    console.log(`   ${docResult.specsUpdated ? 'Found' : 'Missing'} openspec-flow/specs/ updated`);
    console.log(`   Tasks: ${taskItems.filter(t => t.completed).length}/${taskItems.length} completed`);
    console.log('');

    // Phase 6: Gap identification
    console.log('Step 6: Gap identification...');
    const gaps: Gap[] = [];

    // Check for functionality gaps
    const incompleteTasks = taskItems.filter(t => !t.completed);
    for (const task of incompleteTasks) {
      gaps.push({
        id: `gap-${gaps.length + 1}`,
        severity: 'major',
        category: 'functionality',
        description: `Incomplete task: ${task.description}`,
        suggestedAction: 'Complete the task or defer with documentation',
      });
    }

    // Check for documentation gaps
    if (!docResult.flowLogExists) {
      gaps.push({
        id: `gap-${gaps.length + 1}`,
        severity: 'major',
        category: 'documentation',
        description: 'Missing flow-log.md',
        suggestedAction: 'Generate flow log documenting the implementation',
      });
    }

    if (!docResult.lessonsLearnedExists) {
      gaps.push({
        id: `gap-${gaps.length + 1}`,
        severity: 'minor',
        category: 'documentation',
        description: 'Missing lessons-learned.md',
        suggestedAction: 'Document lessons learned from implementation',
      });
    }

    if (!buildPassed) {
      gaps.push({
        id: `gap-${gaps.length + 1}`,
        severity: 'critical',
        category: 'functionality',
        description: 'Build verification failed or not completed',
        suggestedAction: 'Fix build errors and warnings',
      });
    }

    if (skipE2E) {
      gaps.push({
        id: `gap-${gaps.length + 1}`,
        severity: 'critical',
        category: 'functionality',
        description: 'E2E verification not performed',
        suggestedAction: 'Start AppHost and verify endpoints/UI via Playwright MCP',
      });
    }

    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    const majorGaps = gaps.filter(g => g.severity === 'major');
    const minorGaps = gaps.filter(g => g.severity === 'minor');

    console.log(`   Found ${criticalGaps.length} critical, ${majorGaps.length} major, ${minorGaps.length} minor gaps`);

    if (gaps.length > 0) {
      console.log('');
      if (criticalGaps.length > 0) {
        console.log('   Critical:');
        for (const gap of criticalGaps) {
          console.log(`     - ${gap.description}`);
        }
      }
      if (majorGaps.length > 0) {
        console.log('   Major:');
        for (const gap of majorGaps) {
          console.log(`     - ${gap.description}`);
        }
      }
      if (minorGaps.length > 0) {
        console.log('   Minor:');
        for (const gap of minorGaps) {
          console.log(`     - ${gap.description}`);
        }
      }
    }
    console.log('');

    // Phase 7: Interactive follow-up
    const followUps: FollowUp[] = [];

    if (gaps.length > 0) {
      console.log('Step 7: Follow-up generation...');
      console.log('');

      for (const gap of gaps.filter(g => g.severity !== 'minor')) {
        console.log(`   Gap: ${gap.description}`);
        const createFollowUp = await askQuestion('   Create follow-up OpenSpec? [y/N]: ');

        if (createFollowUp.toLowerCase() === 'y') {
          const followUpId = `followup-${changeId}-${gap.id}`;
          followUps.push({
            gapId: gap.id,
            changeId: followUpId,
            description: gap.description,
          });
          console.log(`     Follow-up will be created: ${followUpId}`);
        }
        console.log('');
      }
    } else {
      console.log('Step 7: Follow-up generation...');
      console.log('   No significant gaps found - no follow-ups needed');
      console.log('');
    }

    // Phase 8: Report generation
    console.log('Step 8: Generating report...');

    const overallStatus: VerificationResult['status'] =
      criticalGaps.length > 0 ? 'failed' :
      gaps.length > 0 ? 'gaps-found' : 'verified';

    const result: VerificationResult = {
      status: overallStatus,
      buildVerification: {
        dotnetBuild: { passed: buildPassed, warnings: 0, errors: 0 },
        typeCheck: null,
      },
      e2eVerification: e2eResult,
      documentationVerification: docResult,
      gaps,
      followUps,
    };

    const reportPath = generateVerificationReport(changeId, change.path, result, taskItems);
    console.log(`   Saved: ${reportPath}`);
    console.log('');

    // Final summary
    console.log('═════════════════════════════════════════════════════════════════');
    if (overallStatus === 'verified') {
      console.log('  VERIFICATION COMPLETE');
    } else if (overallStatus === 'gaps-found') {
      console.log('  VERIFICATION COMPLETE - GAPS FOUND');
    } else {
      console.log('  VERIFICATION FAILED - CRITICAL ISSUES');
    }
    console.log('═════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Summary:');
    console.log(`  Build:         ${buildPassed ? 'Pass' : 'Fail'}`);
    console.log(`  E2E Tests:     ${skipE2E ? 'Skipped' : 'Performed'}`);
    console.log(`  Documentation: ${docResult.flowLogComplete ? 'Complete' : 'Incomplete'}`);
    console.log(`  Gaps:          ${criticalGaps.length} critical, ${majorGaps.length} major, ${minorGaps.length} minor`);
    console.log('');
    console.log(`Report: ${reportPath}`);
    console.log('');

    rl.close();

  } catch (error) {
    rl.close();
    console.error('');
    console.error('Error during verification:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    process.exit(1);
  }
}

function generateVerificationReport(
  changeId: string,
  changePath: string,
  result: VerificationResult,
  tasks: ReturnType<typeof parseTasks>
): string {
  const timestamp = new Date().toISOString();
  const statusEmoji =
    result.status === 'verified' ? 'Verified' :
    result.status === 'gaps-found' ? 'Gaps Found' : 'Failed';

  let report = `# Verification Report: ${changeId}

**Generated**: ${timestamp}
**Status**: ${statusEmoji}

---

## Build Verification

- **dotnet build**: ${result.buildVerification.dotnetBuild.passed ? 'Pass' : 'Fail'} (${result.buildVerification.dotnetBuild.warnings} warnings, ${result.buildVerification.dotnetBuild.errors} errors)
${result.buildVerification.typeCheck ? `- **npm run type-check**: ${result.buildVerification.typeCheck.passed ? 'Pass' : 'Fail'}` : '- **npm run type-check**: Not applicable'}

---

## E2E Verification

**User Started AppHost**: ${result.e2eVerification.appHostStarted ? 'Yes' : 'No'}
**Playwright MCP Used**: ${result.e2eVerification.userConfirmed ? 'Yes' : 'No/Skipped'}

### Endpoints Tested
${result.e2eVerification.endpointsTested.length > 0 ?
  result.e2eVerification.endpointsTested.map(e =>
    `| \`${e.method} ${e.endpoint}\` | ${e.expectedStatus} | ${e.actualStatus ?? 'N/A'} | ${e.passed ? 'Pass' : 'Fail'} |`
  ).join('\n') :
  '(E2E endpoint testing should be performed by Claude using Playwright MCP)'}

### UI Flows Verified
${result.e2eVerification.uiFlowsVerified.length > 0 ?
  result.e2eVerification.uiFlowsVerified.map(u =>
    `| ${u.page} | ${u.flow} | ${u.passed ? 'Pass' : 'Fail'} |`
  ).join('\n') :
  '(E2E UI verification should be performed by Claude using Playwright MCP)'}

### Issues Found During E2E
${result.e2eVerification.issuesFound.length > 0 ?
  result.e2eVerification.issuesFound.map(i => `- ${i}`).join('\n') :
  '- None reported'}

---

## Documentation Status

| Document | Status | Notes |
|----------|--------|-------|
| flow-log.md | ${result.documentationVerification.flowLogExists ? (result.documentationVerification.flowLogComplete ? 'Complete' : 'Incomplete') : 'Missing'} | |
| lessons-learned.md | ${result.documentationVerification.lessonsLearnedExists ? 'Exists' : 'Missing'} | |
| decisions.md | ${result.documentationVerification.decisionsDocumented ? 'Documented' : 'Missing'} | |
| openspec-flow/specs/ | ${result.documentationVerification.specsUpdated ? 'Updated' : 'Not updated'} | |
| tasks.md | ${result.documentationVerification.tasksAccurate ? 'Accurate' : 'Incomplete'} | ${tasks.filter(t => t.completed).length}/${tasks.length} tasks completed |

---

## Gaps Identified

### Critical
${result.gaps.filter(g => g.severity === 'critical').length > 0 ?
  result.gaps.filter(g => g.severity === 'critical').map(g => `- [ ] ${g.description}`).join('\n') :
  '- None'}

### Major
${result.gaps.filter(g => g.severity === 'major').length > 0 ?
  result.gaps.filter(g => g.severity === 'major').map(g => `- [ ] ${g.description}`).join('\n') :
  '- None'}

### Minor
${result.gaps.filter(g => g.severity === 'minor').length > 0 ?
  result.gaps.filter(g => g.severity === 'minor').map(g => `- [ ] ${g.description}`).join('\n') :
  '- None'}

---

## Follow-Up Actions

| Gap | Create Follow-Up? | Change ID |
|-----|-------------------|-----------|
${result.followUps.length > 0 ?
  result.followUps.map(f => `| ${f.description} | Yes | ${f.changeId} |`).join('\n') :
  '| None | - | - |'}

---

*Generated by openspec-flow:verify*
`;

  const reportPath = join(changePath, 'verification-report.md');
  writeFileSync(reportPath, report, 'utf-8');

  return reportPath;
}
