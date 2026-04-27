import { ModelOperations } from '@vscode/vscode-languagedetection';
import type { DetectionContext, DetectionResult } from '../types';
import {
  DETECTION_TO_MONACO,
  getLanguageDescriptor,
  toDetectionResult,
} from '../registry';
import {
  clearDetectionCache,
  getCacheKey,
  getCached,
  updateCache,
} from './cache';
import { detectWithParsers } from './parserDetection';

const ML_MODEL_LOAD_TIMEOUT_MS = 5_000;

let modelOperations: ModelOperations | null = null;
let modelLoadPromise: Promise<void> | null = null;
let isModelLoaded = false;
let isModelLoading = false;

export async function initializeMLModel(): Promise<void> {
  if (isModelLoaded || isModelLoading) {
    return modelLoadPromise || Promise.resolve();
  }

  isModelLoading = true;

  modelLoadPromise = (async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Model load timeout')),
          ML_MODEL_LOAD_TIMEOUT_MS
        )
      );

      const loadPromise = async () => {
        modelOperations = new ModelOperations();
        await Promise.resolve();
      };

      await Promise.race([loadPromise(), timeoutPromise]);
      isModelLoaded = true;
      isModelLoading = false;
    } catch (error) {
      console.warn(
        '[LanguageDetection] Failed to load ML model (falling back to parser detection):',
        error
      );
      isModelLoading = false;
    }
  })();

  return modelLoadPromise;
}

export function isMLModelLoaded(): boolean {
  return isModelLoaded;
}

export function isMLModelLoading(): boolean {
  return isModelLoading;
}

export function clearLanguageDetectionCache() {
  clearDetectionCache();
}

export async function detectWithML(
  content: string,
  context?: DetectionContext,
  onDetecting?: (detecting: boolean) => void,
  onConfidenceUpdate?: (confidence: number) => void
): Promise<DetectionResult> {
  const cacheKey = getCacheKey(content);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const parserResult = detectWithParsers(content, context);
  if (parserResult && parserResult.confidence >= 0.9) {
    updateCache(cacheKey, parserResult);
    onConfidenceUpdate?.(parserResult.confidence);
    return parserResult;
  }

  if (!isModelLoaded && !isModelLoading) {
    await initializeMLModel();
  } else if (isModelLoading) {
    await modelLoadPromise;
  }

  if (!modelOperations) {
    const fallback =
      parserResult ?? toDetectionResult('typescript', 0.5, 'sticky');
    updateCache(cacheKey, fallback);
    onConfidenceUpdate?.(fallback.confidence);
    return fallback;
  }

  onDetecting?.(true);

  try {
    const results = await modelOperations.runModel(content);
    const topResult = results[0];

    if (!topResult) {
      const fallback =
        parserResult ?? toDetectionResult('typescript', 0.5, 'sticky');
      updateCache(cacheKey, fallback);
      onConfidenceUpdate?.(fallback.confidence);
      onDetecting?.(false);
      return fallback;
    }

    const monacoId =
      DETECTION_TO_MONACO[topResult.languageId] || topResult.languageId;
    const descriptor = getLanguageDescriptor(monacoId);

    const result: DetectionResult = {
      monacoId,
      confidence: topResult.confidence,
      isExecutable: descriptor?.executable ?? false,
      source: 'ml',
    };

    const finalResult =
      parserResult && parserResult.monacoId === result.monacoId
        ? {
            ...result,
            confidence: Math.max(result.confidence, parserResult.confidence),
          }
        : parserResult &&
            parserResult.source === 'sticky' &&
            result.confidence < 0.75
          ? parserResult
          : result;

    updateCache(cacheKey, finalResult);
    onConfidenceUpdate?.(finalResult.confidence);
    onDetecting?.(false);
    return finalResult;
  } catch (error) {
    console.error('[LanguageDetection] ML detection failed:', error);
    onDetecting?.(false);
    const fallback =
      parserResult ?? toDetectionResult('typescript', 0.5, 'sticky');
    updateCache(cacheKey, fallback);
    return fallback;
  }
}
