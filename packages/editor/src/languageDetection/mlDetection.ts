/**
 * ML-Based Language Detection
 *
 * Uses VS Code's language detection model for high-accuracy detection.
 * Falls back to pattern-based detection on error.
 */

export {
  clearLanguageDetectionCache as clearDetectionCache,
  detectWithML,
  initializeMLModel,
  isMLModelLoaded,
  isMLModelLoading,
} from '@cheesejs/languages';
