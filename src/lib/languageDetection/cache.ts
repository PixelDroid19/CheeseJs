/**
 * Detection Cache
 *
 * LRU cache for language detection results to avoid redundant processing.
 */

import type { DetectionResult } from './types';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const detectionCache = new Map<string, DetectionResult>();
const CACHE_SIZE = 50;

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate a cache key using content signature:
 * - First 100 chars (captures imports/headers)
 * - Middle 100 chars (captures unique code patterns)
 * - Last 100 chars (captures unique endings)
 * - Total length (differentiates similar content)
 */
export function getCacheKey(content: string): string {
    const len = content.length;
    const start = content.slice(0, 100);
    const mid =
        len > 300
            ? content.slice(Math.floor(len / 2) - 50, Math.floor(len / 2) + 50)
            : '';
    const end = len > 200 ? content.slice(-100) : '';
    return `${len}:${start}:${mid}:${end}`;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached detection result
 */
export function getCached(key: string): DetectionResult | undefined {
    return detectionCache.get(key);
}

/**
 * Update cache with LRU eviction
 */
export function updateCache(key: string, value: DetectionResult): void {
    // LRU eviction: remove oldest entries when at capacity
    if (detectionCache.size >= CACHE_SIZE) {
        const keysToDelete = Array.from(detectionCache.keys()).slice(0, 10);
        keysToDelete.forEach((k) => detectionCache.delete(k));
    }
    detectionCache.set(key, value);
}

/**
 * Clear the detection cache (exported for testing/reset)
 */
export function clearDetectionCache(): void {
    detectionCache.clear();
}
