/**
 * OpenSpec-Flow Type Definitions
 */

export interface OpenSpecChange {
  changeId: string;
  path: string;
  proposal?: string;
  tasks?: string;
  design?: string;
  specs: string[];
}

export interface ChangeListItem {
  changeId: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done' | 'unknown';
  tasksTotal: number;
  tasksCompleted: number;
  path: string;
}

export interface WorkBrief {
  changeId: string;
  generatedAt: string;
  summary: string;
  tasks: TaskItem[];
  impactedSpecs: string[];
  architectureContext: string;
  techStack: TechStackContext;
  constraints: string[];
}

export interface TaskItem {
  id: string;
  description: string;
  completed: boolean;
}

export interface TechStackContext {
  runtime: string;
  orchestration: string;
  database: string;
  messaging: string;
  storage: string;
  patterns: string[];
}

export interface ClaudeFlowInput {
  changeId: string;
  workBriefPath: string;
  claudeMdPath: string;
  projectContextPath: string;
}

export interface ClaudeFlowResult {
  success: boolean;
  logPath: string;
  error?: string;
}

/**
 * Batch/Hive Orchestration Types
 */

export interface ChangeDependency {
  changeId: string;
  dependsOn: string[];
  followedBy: string[];
}

export interface ExecutionNode {
  changeId: string;
  change: OpenSpecChange;
  dependsOn: string[];
  status: ChangeExecutionStatus;
  agentId?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export type ChangeExecutionStatus =
  | 'pending'
  | 'ready'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'blocked';

export interface ExecutionPlan {
  changes: ExecutionNode[];
  executionOrder: string[];
  parallelBatches: string[][];
}

export interface SwarmState {
  swarmId?: string;
  topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
  agents: SwarmAgent[];
  status: 'initializing' | 'running' | 'completed' | 'failed';
}

export interface SwarmAgent {
  agentId: string;
  name: string;
  type: string;
  changeId: string;
  status: 'idle' | 'working' | 'completed' | 'failed';
}

export interface BatchExecutionResult {
  success: boolean;
  completedChanges: string[];
  failedChanges: string[];
  executionTime: number;
  summary: string;
}
