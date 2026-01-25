/**
 * Transpiler Registry
 *
 * Manages custom transpiler contributions from plugins.
 * Provides priority-based selection when multiple transpilers handle the same language.
 */

import type {
  TranspilerContribution,
  TranspilerExtension,
  TransformOptions,
  TransformResult,
} from '../../../src/lib/plugins/plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredTranspiler {
  contribution: TranspilerContribution;
  extension: TranspilerExtension;
  pluginId: string;
  priority: number;
}

// ============================================================================
// TRANSPILER REGISTRY
// ============================================================================

export class TranspilerRegistry {
  private transpilers: Map<string, RegisteredTranspiler[]> = new Map();

  /**
   * Register a transpiler contribution
   */
  register(
    pluginId: string,
    contribution: TranspilerContribution,
    extension: TranspilerExtension
  ): void {
    const key = `${contribution.sourceLanguage}->${contribution.targetLanguage}`;
    const priority = contribution.priority ?? 0;

    const registered: RegisteredTranspiler = {
      contribution,
      extension,
      pluginId,
      priority,
    };

    if (!this.transpilers.has(key)) {
      this.transpilers.set(key, []);
    }

    const transpilers = this.transpilers.get(key)!;
    transpilers.push(registered);

    // Sort by priority (higher priority first)
    transpilers.sort((a, b) => b.priority - a.priority);

    console.log(
      `[TranspilerRegistry] Registered transpiler: ${contribution.sourceLanguage} → ${contribution.targetLanguage} (priority: ${priority})`
    );
  }

  /**
   * Unregister transpilers for a plugin
   */
  unregisterByPlugin(pluginId: string): void {
    for (const [key, transpilers] of this.transpilers.entries()) {
      const filtered = transpilers.filter((t) => t.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.transpilers.delete(key);
      } else {
        this.transpilers.set(key, filtered);
      }
    }
    console.log(
      `[TranspilerRegistry] Unregistered transpilers for plugin: ${pluginId}`
    );
  }

  /**
   * Get best transpiler for a language pair
   */
  getTranspiler(
    sourceLanguage: string,
    targetLanguage: string = 'javascript'
  ): TranspilerExtension | undefined {
    const key = `${sourceLanguage}->${targetLanguage}`;
    const transpilers = this.transpilers.get(key);

    // Return highest priority transpiler
    return transpilers?.[0]?.extension;
  }

  /**
   * Check if a transpiler exists for a language
   */
  hasTranspiler(
    sourceLanguage: string,
    targetLanguage: string = 'javascript'
  ): boolean {
    const key = `${sourceLanguage}->${targetLanguage}`;
    const transpilers = this.transpilers.get(key);
    return transpilers !== undefined && transpilers.length > 0;
  }

  /**
   * Transform code using registered transpiler
   */
  async transform(
    sourceLanguage: string,
    code: string,
    options?: TransformOptions
  ): Promise<TransformResult | null> {
    const transpiler = this.getTranspiler(sourceLanguage);
    if (!transpiler) {
      return null;
    }

    try {
      const result = await transpiler.transform(code, options);
      return result;
    } catch (error) {
      console.error(`[TranspilerRegistry] Transpilation error:`, error);
      return {
        code,
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  /**
   * Get all registered transpilers
   */
  getAllTranspilers(): RegisteredTranspiler[] {
    const all: RegisteredTranspiler[] = [];
    for (const transpilers of this.transpilers.values()) {
      all.push(...transpilers);
    }
    return all;
  }

  /**
   * Get transpilers for a specific plugin
   */
  getTranspilersByPlugin(pluginId: string): RegisteredTranspiler[] {
    return this.getAllTranspilers().filter((t) => t.pluginId === pluginId);
  }

  /**
   * Clear all registered transpilers
   */
  clear(): void {
    this.transpilers.clear();
  }
}

// Singleton instance
export const transpilerRegistry = new TranspilerRegistry();
