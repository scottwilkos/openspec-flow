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
