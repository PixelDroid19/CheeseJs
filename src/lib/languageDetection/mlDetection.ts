/**
 * ML-Based Language Detection
 *
 * Uses VS Code's language detection model for high-accuracy detection.
 * Falls back to pattern-based detection on error.
 */

import { ModelOperations } from '@vscode/vscode-languagedetection';
import type { DetectionResult } from './types';
import { patternBasedDetection } from './patternDetection';
import { DETECTION_TO_MONACO, LANGUAGES } from './languages';
import { getCacheKey, getCached, updateCache } from './cache';
import {
  DEFINITIVE_PYTHON_PATTERNS,
  DEFINITIVE_TS_PATTERNS,
  DEFINITIVE_JS_PATTERNS,
} from './patterns';

// ============================================================================
// ML MODEL SINGLETON
// ============================================================================

let modelOperations: ModelOperations | null = null;
let modelLoadPromise: Promise<void> | null = null;
let isModelLoaded = false;
let isModelLoading = false;

// ============================================================================
// MODEL INITIALIZATION
// ============================================================================

/**
 * Initialize the ML model
 */
export async function initializeMLModel(): Promise<void> {
  if (isModelLoaded || isModelLoading) {
    return modelLoadPromise || Promise.resolve();
  }

  isModelLoading = true;

  modelLoadPromise = (async () => {
    try {
      // Add timeout to prevent infinite loading state
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model load timeout')), 5000)
      );

      const loadPromise = async () => {
        modelOperations = new ModelOperations();
        // Basic check to ensure it's responsive
        await Promise.resolve();
      };

      await Promise.race([loadPromise(), timeoutPromise]);

      isModelLoaded = true;
      isModelLoading = false;
    } catch (error) {
      console.warn(
        '[MLDetection] Failed to load ML model (falling back to pattern detection):',
        error
      );
      isModelLoading = false;
    }
  })();

  return modelLoadPromise;
}

/**
 * Check if the ML model is loaded
 */
export function isMLModelLoaded(): boolean {
  return isModelLoaded;
}

/**
 * Check if the ML model is currently loading
 */
export function isMLModelLoading(): boolean {
  return isModelLoading;
}

// ============================================================================
// ML DETECTION
// ============================================================================

/**
 * Detect language using ML model (async)
 * Falls back to pattern-based detection on error or for short content
 */
export async function detectWithML(
  content: string,
  onDetecting?: (detecting: boolean) => void,
  onConfidenceUpdate?: (confidence: number) => void
): Promise<DetectionResult> {
  // Check cache
  const cacheKey = getCacheKey(content);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const trimmed = content?.trim() || '';

  // =====================================================================
  // DEFINITIVE PATTERN CHECK (ALWAYS runs first, regardless of ML)
  // These patterns are UNAMBIGUOUS - no ML needed
  // =====================================================================
  for (const pattern of DEFINITIVE_PYTHON_PATTERNS) {
    if (pattern.test(trimmed)) {
      const result: DetectionResult = {
        monacoId: 'python',
        confidence: 0.98,
        isExecutable: true,
      };
      updateCache(cacheKey, result);
      onConfidenceUpdate?.(result.confidence);
      return result;
    }
  }

  for (const pattern of DEFINITIVE_TS_PATTERNS) {
    if (pattern.test(trimmed)) {
      const result: DetectionResult = {
        monacoId: 'typescript',
        confidence: 0.98,
        isExecutable: true,
      };
      updateCache(cacheKey, result);
      onConfidenceUpdate?.(result.confidence);
      return result;
    }
  }

  for (const pattern of DEFINITIVE_JS_PATTERNS) {
    if (pattern.test(trimmed)) {
      const result: DetectionResult = {
        monacoId: 'javascript',
        confidence: 0.98,
        isExecutable: true,
      };
      updateCache(cacheKey, result);
      onConfidenceUpdate?.(result.confidence);
      return result;
    }
  }

  // =====================================================================
  // SHORT CONTENT - use pattern scoring (ML unreliable < 50 chars)
  // =====================================================================
  if (trimmed.length < 50) {
    const result = patternBasedDetection(content);
    updateCache(cacheKey, result);
    onConfidenceUpdate?.(result.confidence);
    return result;
  }

  // Ensure model is loaded
  if (!isModelLoaded && !isModelLoading) {
    await initializeMLModel();
  } else if (isModelLoading) {
    await modelLoadPromise;
  }

  // If model failed to load, fallback to patterns
  if (!modelOperations) {
    console.warn(
      '[MLDetection] ML model not available, using pattern fallback'
    );
    const result = patternBasedDetection(content);
    updateCache(cacheKey, result);
    onConfidenceUpdate?.(result.confidence);
    return result;
  }

  onDetecting?.(true);

  try {
    const results = await modelOperations.runModel(content);

    if (results.length === 0) {
      const result = patternBasedDetection(content);
      updateCache(cacheKey, result);
      onConfidenceUpdate?.(result.confidence);
      onDetecting?.(false);
      return result;
    }

    const topResult = results[0];
    const monacoId =
      DETECTION_TO_MONACO[topResult.languageId] || topResult.languageId;
    const langInfo = LANGUAGES[monacoId];

    const result: DetectionResult = {
      monacoId,
      confidence: topResult.confidence,
      isExecutable: langInfo?.isExecutable ?? false,
    };

    // Cache ML result
    updateCache(cacheKey, result);
    onConfidenceUpdate?.(result.confidence);
    onDetecting?.(false);

    // console.debug(
    //   `[MLDetection] ML detected: ${monacoId} (${(topResult.confidence * 100).toFixed(1)}%)`
    // );
    return result;
  } catch (error) {
    console.error('[MLDetection] ML detection failed:', error);
    onDetecting?.(false);
    const result = patternBasedDetection(content);
    updateCache(cacheKey, result);
    return result;
  }
}
