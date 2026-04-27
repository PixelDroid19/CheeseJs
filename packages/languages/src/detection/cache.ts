import type { DetectionResult } from '../types';

const cache = new Map<string, DetectionResult>();

export function getCacheKey(content: string): string {
  return `${content.length}:${content.slice(0, 100)}`;
}

export function getCached(key: string): DetectionResult | undefined {
  return cache.get(key);
}

export function updateCache(key: string, result: DetectionResult): void {
  cache.set(key, result);
}

export function clearDetectionCache(): void {
  cache.clear();
}
