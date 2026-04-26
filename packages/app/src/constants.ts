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
} from '@cheesejs/core/contracts/workerTypes';

/** Debounce delay (ms) before auto-running code after edits. */
export { CODE_RUNNER_DEBOUNCE_MS } from '@cheesejs/editor/constants';

/** Timeout (ms) for loading the ML language-detection model. */
export { ML_MODEL_LOAD_TIMEOUT_MS } from '@cheesejs/editor/constants';

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

/** Default debounce (ms) for the LanguageDetectionService. */
export { LANGUAGE_DETECTION_DEBOUNCE_MS } from '@cheesejs/editor/constants';

/** Default idle-callback timeout (ms) for the LanguageDetectionService. */
export { LANGUAGE_DETECTION_IDLE_TIMEOUT_MS } from '@cheesejs/editor/constants';
