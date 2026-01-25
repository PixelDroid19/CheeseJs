/**
 * Formatter Registry
 *
 * Manages custom console output formatters from plugins (renderer-side).
 * Provides priority-based selection when multiple formatters handle the same type.
 */

import type { FormatterContribution, ConsoleFormatter } from './plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredFormatter {
  contribution: FormatterContribution;
  formatter: ConsoleFormatter;
  pluginId: string;
  priority: number;
}

// ============================================================================
// FORMATTER REGISTRY
// ============================================================================

export class FormatterRegistry {
  private formatters: Map<string, RegisteredFormatter[]> = new Map();

  /**
   * Register a formatter contribution
   */
  register(
    pluginId: string,
    contribution: FormatterContribution,
    formatter: ConsoleFormatter
  ): void {
    const priority = contribution.priority ?? 0;

    const registered: RegisteredFormatter = {
      contribution,
      formatter,
      pluginId,
      priority,
    };

    // Register for each type
    for (const type of contribution.types) {
      if (!this.formatters.has(type)) {
        this.formatters.set(type, []);
      }

      const formatters = this.formatters.get(type)!;
      formatters.push(registered);

      // Sort by priority (higher priority first)
      formatters.sort((a, b) => b.priority - a.priority);
    }

    console.log(
      `[FormatterRegistry] Registered formatter for types: ${contribution.types.join(', ')}`
    );
  }

  /**
   * Unregister formatters for a plugin
   */
  unregisterByPlugin(pluginId: string): void {
    for (const [type, formatters] of this.formatters.entries()) {
      const filtered = formatters.filter((f) => f.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.formatters.delete(type);
      } else {
        this.formatters.set(type, filtered);
      }
    }
    console.log(
      `[FormatterRegistry] Unregistered formatters for plugin: ${pluginId}`
    );
  }

  /**
   * Format a value using registered formatters
   */
  format(value: unknown, type: string): string | null {
    const formatters = this.formatters.get(type);
    if (!formatters) return null;

    // Try formatters in priority order
    for (const { formatter } of formatters) {
      if (formatter.canFormat(value, type)) {
        try {
          return formatter.format(value, type);
        } catch (error) {
          console.error(`[FormatterRegistry] Formatter error:`, error);
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Check if a formatter exists for a type
   */
  hasFormatter(type: string): boolean {
    const formatters = this.formatters.get(type);
    return formatters !== undefined && formatters.length > 0;
  }

  /**
   * Get all registered formatters
   */
  getAllFormatters(): RegisteredFormatter[] {
    const all: RegisteredFormatter[] = [];
    const seen = new Set<RegisteredFormatter>();

    for (const formatters of this.formatters.values()) {
      for (const formatter of formatters) {
        if (!seen.has(formatter)) {
          all.push(formatter);
          seen.add(formatter);
        }
      }
    }

    return all;
  }

  /**
   * Get formatters for a specific plugin
   */
  getFormattersByPlugin(pluginId: string): RegisteredFormatter[] {
    return this.getAllFormatters().filter((f) => f.pluginId === pluginId);
  }

  /**
   * Clear all registered formatters
   */
  clear(): void {
    this.formatters.clear();
  }
}

// Singleton instance
export const formatterRegistry = new FormatterRegistry();
