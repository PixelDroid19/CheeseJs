/**
 * Execution Visualizer Store
 *
 * Manages state for real-time code execution visualization.
 * Features:
 * - Active line tracking with history
 * - Variable state tracking with change detection
 * - Control flow path visualization
 * - Animation speed control
 */

import { create } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export interface VariableState {
  value: string;
  type: string;
  changed: boolean;
  timestamp: number;
}

export interface FlowStep {
  from: number;
  to: number;
  type: 'if' | 'else' | 'loop' | 'call' | 'return';
  timestamp: number;
}

export interface LineExecution {
  line: number;
  timestamp: number;
  duration?: number;
}

export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export interface ExecutionVisualizerState {
  // Execution state
  isActive: boolean;
  activeLine: number | null;
  previousLine: number | null;
  executionHistory: LineExecution[];

  // Variable tracking
  variables: Map<string, VariableState>;

  // Control flow
  flowPath: FlowStep[];

  // Settings
  enabled: boolean;
  animationSpeed: AnimationSpeed;
  showVariables: boolean;
  showFlowPath: boolean;
  maxHistorySize: number;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  setShowVariables: (show: boolean) => void;
  setShowFlowPath: (show: boolean) => void;

  // Execution actions
  startExecution: () => void;
  endExecution: () => void;
  setActiveLine: (line: number) => void;
  updateVariables: (
    vars: Record<string, { value: string; type: string }>
  ) => void;
  addFlowStep: (step: Omit<FlowStep, 'timestamp'>) => void;
  reset: () => void;
}

// ============================================================================
// ANIMATION SPEED CONFIG
// ============================================================================

export const ANIMATION_SPEEDS: Record<AnimationSpeed, number> = {
  slow: 500, // 500ms per line
  normal: 150, // 150ms per line
  fast: 50, // 50ms per line
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useExecutionVisualizerStore = create<ExecutionVisualizerState>(
  (set, get) => ({
    // Initial state
    isActive: false,
    activeLine: null,
    previousLine: null,
    executionHistory: [],
    variables: new Map(),
    flowPath: [],

    // Settings - default to enabled with normal speed
    enabled: true,
    animationSpeed: 'normal',
    showVariables: true,
    showFlowPath: false,
    maxHistorySize: 100,

    // Settings actions
    setEnabled: (enabled) => set({ enabled }),
    setAnimationSpeed: (animationSpeed) => set({ animationSpeed }),
    setShowVariables: (showVariables) => set({ showVariables }),
    setShowFlowPath: (showFlowPath) => set({ showFlowPath }),

    // Execution actions
    startExecution: () =>
      set({
        isActive: true,
        activeLine: null,
        previousLine: null,
        executionHistory: [],
        variables: new Map(),
        flowPath: [],
      }),

    endExecution: () =>
      set({
        isActive: false,
        activeLine: null,
        previousLine: null,
      }),

    setActiveLine: (line) => {
      const state = get();
      const now = Date.now();

      // Calculate duration for previous line
      const updatedHistory = [...state.executionHistory];
      if (updatedHistory.length > 0 && state.activeLine !== null) {
        const lastEntry = updatedHistory[updatedHistory.length - 1];
        if (lastEntry.line === state.activeLine && !lastEntry.duration) {
          lastEntry.duration = now - lastEntry.timestamp;
        }
      }

      // Add new line to history
      const newEntry: LineExecution = { line, timestamp: now };
      updatedHistory.push(newEntry);

      // Trim history if too large
      const trimmedHistory =
        updatedHistory.length > state.maxHistorySize
          ? updatedHistory.slice(-state.maxHistorySize)
          : updatedHistory;

      set({
        previousLine: state.activeLine,
        activeLine: line,
        executionHistory: trimmedHistory,
      });
    },

    updateVariables: (vars) => {
      const state = get();
      const now = Date.now();
      const newVariables = new Map(state.variables);

      for (const [name, { value, type }] of Object.entries(vars)) {
        const existing = newVariables.get(name);
        const changed = !existing || existing.value !== value;

        newVariables.set(name, {
          value,
          type,
          changed,
          timestamp: now,
        });
      }

      // Reset "changed" flag for variables that weren't updated
      for (const [name, varState] of newVariables) {
        if (!(name in vars) && varState.changed) {
          newVariables.set(name, { ...varState, changed: false });
        }
      }

      set({ variables: newVariables });
    },

    addFlowStep: (step) => {
      const state = get();
      const flowStep: FlowStep = {
        ...step,
        timestamp: Date.now(),
      };

      const updatedPath = [...state.flowPath, flowStep];

      // Limit flow path size
      const trimmedPath =
        updatedPath.length > state.maxHistorySize
          ? updatedPath.slice(-state.maxHistorySize)
          : updatedPath;

      set({ flowPath: trimmedPath });
    },

    reset: () =>
      set({
        isActive: false,
        activeLine: null,
        previousLine: null,
        executionHistory: [],
        variables: new Map(),
        flowPath: [],
      }),
  })
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Check if visualization is currently active
 */
export function useIsVisualizationActive(): boolean {
  return useExecutionVisualizerStore((s) => s.enabled && s.isActive);
}

/**
 * Get current active line for highlighting
 */
export function useActiveLine(): number | null {
  return useExecutionVisualizerStore((s) => (s.enabled ? s.activeLine : null));
}

/**
 * Get variables as array for rendering
 */
export function useVariablesArray(): Array<{
  name: string;
  value: string;
  type: string;
  changed: boolean;
}> {
  const variables = useExecutionVisualizerStore((s) => s.variables);
  const showVariables = useExecutionVisualizerStore((s) => s.showVariables);

  if (!showVariables) return [];

  return Array.from(variables.entries()).map(([name, state]) => ({
    name,
    value: state.value,
    type: state.type,
    changed: state.changed,
  }));
}

/**
 * Get animation delay for current speed setting
 */
export function useAnimationDelay(): number {
  const speed = useExecutionVisualizerStore((s) => s.animationSpeed);
  return ANIMATION_SPEEDS[speed];
}
