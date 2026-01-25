/**
 * Language Registry
 *
 * Manages custom language contributions from plugins.
 * Integrates with Monaco Editor for syntax highlighting and language features.
 */

import type {
  LanguageContribution,
  MonacoLanguageConfig,
} from '../../../src/lib/plugins/plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredLanguage {
  contribution: LanguageContribution;
  pluginId: string;
  isRegistered: boolean;
}

// ============================================================================
// LANGUAGE REGISTRY
// ============================================================================

export class LanguageRegistry {
  private languages: Map<string, RegisteredLanguage> = new Map();
  private extensionMap: Map<string, string> = new Map(); // .ext -> languageId

  /**
   * Register a language contribution
   */
  register(pluginId: string, contribution: LanguageContribution): void {
    if (this.languages.has(contribution.id)) {
      console.warn(
        `[LanguageRegistry] Language ${contribution.id} already registered, skipping`
      );
      return;
    }

    this.languages.set(contribution.id, {
      contribution,
      pluginId,
      isRegistered: false,
    });

    // Map file extensions to language ID
    for (const ext of contribution.extensions) {
      const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
      this.extensionMap.set(normalizedExt, contribution.id);
    }

    console.log(
      `[LanguageRegistry] Registered language: ${contribution.name} (${contribution.extensions.join(', ')})`
    );
  }

  /**
   * Unregister a language (when plugin is deactivated)
   */
  unregister(languageId: string): void {
    const lang = this.languages.get(languageId);
    if (!lang) return;

    // Remove extension mappings
    for (const ext of lang.contribution.extensions) {
      const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
      this.extensionMap.delete(normalizedExt);
    }

    this.languages.delete(languageId);
    console.log(`[LanguageRegistry] Unregistered language: ${languageId}`);
  }

  /**
   * Get language ID by file extension
   */
  getLanguageByExtension(extension: string): string | undefined {
    const normalizedExt = extension.startsWith('.')
      ? extension
      : `.${extension}`;
    return this.extensionMap.get(normalizedExt);
  }

  /**
   * Get all registered languages
   */
  getAllLanguages(): RegisteredLanguage[] {
    return Array.from(this.languages.values());
  }

  /**
   * Get language configuration for Monaco
   */
  getLanguageConfig(languageId: string): MonacoLanguageConfig | undefined {
    return this.languages.get(languageId)?.contribution.configuration;
  }

  /**
   * Mark language as registered in Monaco
   */
  markAsRegistered(languageId: string): void {
    const lang = this.languages.get(languageId);
    if (lang) {
      lang.isRegistered = true;
    }
  }

  /**
   * Get languages for a specific plugin
   */
  getLanguagesByPlugin(pluginId: string): LanguageContribution[] {
    return Array.from(this.languages.values())
      .filter((lang) => lang.pluginId === pluginId)
      .map((lang) => lang.contribution);
  }

  /**
   * Clear all registered languages
   */
  clear(): void {
    this.languages.clear();
    this.extensionMap.clear();
  }
}

// Singleton instance
export const languageRegistry = new LanguageRegistry();
