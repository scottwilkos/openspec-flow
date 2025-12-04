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

// Analysis types
export interface AnalysisResult {
  changeId: string;
  metrics: ChangeMetrics;
  sizing: SizingAssessment;
  complexityFactors: ComplexityFactor[];
  suggestedPhases?: PhaseBoundary[];
}

export interface ChangeMetrics {
  taskCount: number;
  completedTasks: number;
  tokenEstimate: number;
  specCount: number;
  hasDesign: boolean;
}

export interface SizingAssessment {
  level: 'green' | 'yellow' | 'red';
  label: string;
  recommendation: string;
}

export interface ComplexityFactor {
  factor: string;
  evidence: string;
}

export interface PhaseBoundary {
  phaseNumber: number;
  description: string;
  taskIndices: number[];
}

// Split types
export interface SplitResult {
  originalChangeId: string;
  phases: PhaseInfo[];
  manifestPath: string;
}

export interface PhaseInfo {
  changeId: string;
  path: string;
  description: string;
  taskCount: number;
  dependsOn: string[];
}

export interface PhaseDefinition {
  description: string;
  taskIndices: number[];
}

export interface PhaseManifest {
  splitDate: string;
  status: 'split';
  phases: Array<{
    id: string;
    description: string;
    dependsOn: string[];
  }>;
}
