/**
 * Language Detection Module
 *
 * Re-exports all language detection functionality.
 */

// Types
export type { DetectionResult } from './types';
export type { LanguageInfo } from './languages';

// Patterns
export {
  DEFINITIVE_PYTHON_PATTERNS,
  DEFINITIVE_JS_PATTERNS,
  DEFINITIVE_TS_PATTERNS,
  PYTHON_PATTERNS,
  TYPESCRIPT_PATTERNS,
  JAVASCRIPT_PATTERNS,
} from './patterns';

// Language Registry
export {
  LANGUAGES,
  DETECTION_TO_MONACO,
  getLanguageInfo,
  isExecutable,
  getDisplayName,
  registerWasmLanguage,
  unregisterWasmLanguage,
  getWasmLanguages,
} from './languages';

// Cache
export {
  clearDetectionCache,
  getCacheKey,
  getCached,
  updateCache,
} from './cache';

// Pattern Detection
export {
  patternBasedDetection,
  matchesDefinitivePython,
  matchesDefinitiveTypeScript,
  matchesDefinitiveJavaScript,
} from './patternDetection';

// ML Detection
export {
  initializeMLModel,
  isMLModelLoaded,
  isMLModelLoading,
  detectWithML,
} from './mlDetection';
