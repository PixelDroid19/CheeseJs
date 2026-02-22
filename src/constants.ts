/**
 * Centralized Application Constants
 *
 * Magic numbers and configuration values used across the application.
 * Grouped by domain for easy discovery.
 */

// ============================================================================
// EXECUTION
// ============================================================================

/** Default execution timeout in ms (also exported from types/workerTypes.ts) */
export {
  DEFAULT_TIMEOUT,
  MAX_RESULTS,
  EXECUTION_DEBOUNCE_MS,
} from './types/workerTypes';

// ============================================================================
// EDITOR / CODE RUNNER
// ============================================================================

/** Debounce delay (ms) before auto-running code after edits */
export const CODE_RUNNER_DEBOUNCE_MS = 150;

// ============================================================================
// AI INLINE COMPLETIONS
// ============================================================================

/** Monaco inline-completion debounce delay (ms) */
export const AI_COMPLETION_DEBOUNCE_MS = 350;

/** Maximum entries in the inline-completion cache */
export const AI_COMPLETION_MAX_CACHE_SIZE = 30;

/** TTL for cached inline completions (ms) */
export const AI_COMPLETION_CACHE_TTL_MS = 30_000;

// ============================================================================
// UI FEEDBACK
// ============================================================================

/** Duration (ms) to show "Copied!" feedback after a clipboard copy */
export const COPY_FEEDBACK_DURATION_MS = 2_000;

/** Delay (ms) before focusing an input after an async UI action */
export const FOCUS_DELAY_MS = 100;

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/** Timeout (ms) for loading the ML language-detection model */
export const ML_MODEL_LOAD_TIMEOUT_MS = 5_000;

/** Default debounce (ms) for the LanguageDetectionService */
export const LANGUAGE_DETECTION_DEBOUNCE_MS = 150;

/** Default idle-callback timeout (ms) for LanguageDetectionService */
export const LANGUAGE_DETECTION_IDLE_TIMEOUT_MS = 100;
