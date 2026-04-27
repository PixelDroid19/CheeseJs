/**
 * Language Detection Module
 *
 * Re-exports all language detection functionality.
 */

// Types
export type { DetectionResult } from './types';
export type { LanguageInfo } from './languages';

// Language Registry
export {
  LANGUAGES,
  DETECTION_TO_MONACO,
  getLanguageInfo,
  isExecutable,
  getDisplayName,
} from './languages';

// Cache
export {
  clearDetectionCache,
  getCacheKey,
  getCached,
  updateCache,
} from './cache';

// Pattern Detection
export { patternBasedDetection } from './patternDetection';

// ML Detection
export {
  initializeMLModel,
  isMLModelLoaded,
  isMLModelLoading,
  detectWithML,
} from './mlDetection';
