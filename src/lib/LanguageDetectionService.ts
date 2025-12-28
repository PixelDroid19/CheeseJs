/**
 * Language Detection Service
 *
 * Provides non-blocking language detection with:
 * - Deferred execution using requestIdleCallback
 * - Request deduplication and cancellation
 * - Race condition prevention with version checking
 * - Metrics for monitoring
 */

import {
  detectWithML,
  patternBasedDetection,
  isMLModelLoaded,
} from './languageDetection';
import type { DetectionResult } from './languageDetection';

// ============================================================================
// TYPES
// ============================================================================

interface PendingDetection {
  content: string;
  version: number;
  resolve: (result: DetectionResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface DetectionMetrics {
  totalRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  syncDetections: number;
  asyncDetections: number;
  averageDetectionTime: number;
}

interface ServiceConfig {
  debounceMs: number; // Debounce time for detection requests
  useIdleCallback: boolean; // Use requestIdleCallback when available
  idleTimeout: number; // Max wait for idle callback
}

// ============================================================================
// LANGUAGE DETECTION SERVICE
// ============================================================================

export class LanguageDetectionService {
  private static instance: LanguageDetectionService | null = null;

  private pending: PendingDetection | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentVersion = 0;
  private isProcessing = false;

  private config: ServiceConfig;
  private metrics: DetectionMetrics = {
    totalRequests: 0,
    completedRequests: 0,
    cancelledRequests: 0,
    syncDetections: 0,
    asyncDetections: 0,
    averageDetectionTime: 0,
  };

  private detectionTimes: number[] = [];
  private readonly maxHistorySize = 50;

  private constructor(config: Partial<ServiceConfig> = {}) {
    this.config = {
      debounceMs: config.debounceMs ?? 150,
      useIdleCallback: config.useIdleCallback ?? true,
      idleTimeout: config.idleTimeout ?? 100,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: Partial<ServiceConfig>
  ): LanguageDetectionService {
    if (!LanguageDetectionService.instance) {
      LanguageDetectionService.instance = new LanguageDetectionService(config);
    }
    return LanguageDetectionService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (LanguageDetectionService.instance) {
      LanguageDetectionService.instance.cancelPending();
      LanguageDetectionService.instance = null;
    }
  }

  /**
   * Detect language synchronously using patterns only (for immediate UI feedback)
   */
  detectSync(content: string): DetectionResult {
    this.metrics.syncDetections++;
    return patternBasedDetection(content);
  }

  /**
   * Detect language asynchronously with debouncing and race condition prevention
   */
  async detectAsync(
    content: string,
    version?: number
  ): Promise<DetectionResult & { version: number }> {
    this.metrics.totalRequests++;

    const requestVersion = version ?? ++this.currentVersion;

    // Cancel any pending detection
    this.cancelPending();

    return new Promise((resolve, reject) => {
      this.pending = {
        content,
        version: requestVersion,
        resolve: (result) => resolve({ ...result, version: requestVersion }),
        reject,
        timestamp: Date.now(),
      };

      // Clear existing debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Schedule detection with debounce
      this.debounceTimer = setTimeout(() => {
        this.executeDetection();
      }, this.config.debounceMs);
    });
  }

  /**
   * Execute the pending detection
   */
  private async executeDetection(): Promise<void> {
    if (!this.pending || this.isProcessing) return;

    const detection = this.pending;
    this.pending = null;
    this.isProcessing = true;

    const startTime = performance.now();

    try {
      // Use idle callback if available and configured
      if (this.config.useIdleCallback && 'requestIdleCallback' in window) {
        await this.runInIdleCallback(async () => {
          await this.performDetection(detection, startTime);
        });
      } else {
        // Use setTimeout(0) to yield to the event loop
        await new Promise<void>((resolve) => {
          setTimeout(async () => {
            await this.performDetection(detection, startTime);
            resolve();
          }, 0);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Perform the actual detection
   */
  private async performDetection(
    detection: PendingDetection,
    startTime: number
  ): Promise<void> {
    // Check if this detection is still relevant (no newer request)
    if (detection.version < this.currentVersion) {
      this.metrics.cancelledRequests++;
      detection.reject(new Error('Detection superseded by newer request'));
      return;
    }

    try {
      const result = await detectWithML(detection.content);

      // Double-check version after async operation
      if (detection.version < this.currentVersion) {
        this.metrics.cancelledRequests++;
        detection.reject(new Error('Detection superseded by newer request'));
        return;
      }

      const duration = performance.now() - startTime;
      this.recordDetectionTime(duration);

      this.metrics.completedRequests++;
      this.metrics.asyncDetections++;

      detection.resolve(result);
    } catch (error) {
      // Fallback to sync detection on error
      try {
        const fallbackResult = this.detectSync(detection.content);
        detection.resolve(fallbackResult);
      } catch (_fallbackError) {
        detection.reject(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  /**
   * Run callback during browser idle time
   */
  private runInIdleCallback(callback: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const idleCallback = (
        window as Window & {
          requestIdleCallback?: (
            cb: (deadline: IdleDeadline) => void,
            opts?: { timeout: number }
          ) => number;
        }
      ).requestIdleCallback;

      if (!idleCallback) {
        callback().then(resolve).catch(reject);
        return;
      }

      idleCallback(
        async () => {
          try {
            await callback();
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        { timeout: this.config.idleTimeout }
      );
    });
  }

  /**
   * Record detection time for metrics
   */
  private recordDetectionTime(duration: number): void {
    this.detectionTimes.push(duration);

    if (this.detectionTimes.length > this.maxHistorySize) {
      this.detectionTimes.shift();
    }

    this.metrics.averageDetectionTime =
      this.detectionTimes.reduce((a, b) => a + b, 0) /
      this.detectionTimes.length;
  }

  /**
   * Cancel pending detection
   */
  cancelPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.pending) {
      this.metrics.cancelledRequests++;
      this.pending.reject(new Error('Detection cancelled'));
      this.pending = null;
    }
  }

  /**
   * Get current version counter
   */
  getVersion(): number {
    return this.currentVersion;
  }

  /**
   * Increment and get new version
   */
  incrementVersion(): number {
    return ++this.currentVersion;
  }

  /**
   * Check if ML model is ready
   */
  isModelReady(): boolean {
    return isMLModelLoaded();
  }

  /**
   * Get metrics
   */
  getMetrics(): DetectionMetrics & {
    hitRate: number;
    isPending: boolean;
  } {
    const total =
      this.metrics.completedRequests + this.metrics.cancelledRequests;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.completedRequests / total : 0,
      isPending: this.pending !== null || this.isProcessing,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      completedRequests: 0,
      cancelledRequests: 0,
      syncDetections: 0,
      asyncDetections: 0,
      averageDetectionTime: 0,
    };
    this.detectionTimes = [];
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the language detection service instance
 */
export function getLanguageDetectionService(): LanguageDetectionService {
  return LanguageDetectionService.getInstance();
}

/**
 * Detect language synchronously (pattern-based, for immediate UI)
 */
export function detectLanguageSync(content: string): DetectionResult {
  return getLanguageDetectionService().detectSync(content);
}

/**
 * Detect language asynchronously (ML-based, with debouncing)
 */
export async function detectLanguageAsync(
  content: string,
  version?: number
): Promise<DetectionResult & { version: number }> {
  return getLanguageDetectionService().detectAsync(content, version);
}
