/**
 * Snippet Registry
 *
 * Manages code snippet contributions from plugins.
 * Integrates with Monaco Editor for IntelliSense/autocomplete.
 */

import type { SnippetContribution } from './plugin-api';
// import type { Monaco } from '@monaco-editor/react';
import type { languages, editor } from 'monaco-editor';
// import type * as monaco from 'monaco-editor';

interface MonacoGlobal {
  editor: typeof editor;
  languages: typeof languages;
}

// ============================================================================
// TYPES
// ============================================================================

export interface Snippet {
  prefix: string;
  body: string | string[];
  description?: string;
}

export interface SnippetFile {
  [name: string]: Snippet;
}

export interface RegisteredSnippet {
  contribution: SnippetContribution;
  snippets: Map<string, Snippet>;
  pluginId: string;
  monacoDisposable?: { dispose: () => void };
}

export interface SnippetCompletionItem {
  label: string;
  insertText: string;
  description?: string;
  documentation?: string;
  sortText?: string;
}

// ============================================================================
// SNIPPET REGISTRY
// ============================================================================

export class SnippetRegistry {
  private registrations: Map<string, RegisteredSnippet> = new Map();
  private monacoInstance: MonacoGlobal | null = null;
  private listeners: Set<(event: SnippetRegistryEvent) => void> = new Set();

  /**
   * Set the Monaco instance for snippet registration
   */
  setMonacoInstance(monaco: MonacoGlobal): void {
    this.monacoInstance = monaco;

    // Re-register all snippets with Monaco
    for (const [id, registration] of this.registrations) {
      this.registerWithMonaco(id, registration);
    }
  }

  /**
   * Register a snippet contribution
   */
  register(
    pluginId: string,
    contribution: SnippetContribution,
    snippets: SnippetFile
  ): void {
    const id = `${pluginId}.${contribution.language}`;

    // Parse snippets
    const snippetMap = new Map<string, Snippet>();
    for (const [name, snippet] of Object.entries(snippets)) {
      snippetMap.set(name, snippet);
    }

    const registration: RegisteredSnippet = {
      contribution,
      snippets: snippetMap,
      pluginId,
    };

    this.registrations.set(id, registration);

    // Register with Monaco if available
    if (this.monacoInstance) {
      this.registerWithMonaco(id, registration);
    }

    this.emit({ type: 'registered', id, pluginId, count: snippetMap.size });
    console.log(
      `[SnippetRegistry] Registered ${snippetMap.size} snippets for ${contribution.language}`
    );
  }

  /**
   * Unregister all snippets from a plugin
   */
  unregisterByPlugin(pluginId: string): void {
    const toRemove: string[] = [];

    for (const [id, registration] of this.registrations) {
      if (registration.pluginId === pluginId) {
        if (registration.monacoDisposable) {
          registration.monacoDisposable.dispose();
        }
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.registrations.delete(id);
      this.emit({ type: 'unregistered', id, pluginId });
    }

    if (toRemove.length > 0) {
      console.log(`[SnippetRegistry] Unregistered snippets from ${pluginId}`);
    }
  }

  /**
   * Get snippets for a language
   */
  getByLanguage(language: string): Snippet[] {
    const result: Snippet[] = [];

    for (const registration of this.registrations.values()) {
      if (registration.contribution.language === language) {
        result.push(...registration.snippets.values());
      }
    }

    return result;
  }

  /**
   * Get all registered snippets
   */
  getAll(): Map<string, Snippet[]> {
    const result = new Map<string, Snippet[]>();

    for (const registration of this.registrations.values()) {
      const lang = registration.contribution.language;
      const existing = result.get(lang) || [];
      existing.push(...registration.snippets.values());
      result.set(lang, existing);
    }

    return result;
  }

  /**
   * Get languages that have snippets
   */
  getLanguages(): string[] {
    const languages = new Set<string>();
    for (const registration of this.registrations.values()) {
      languages.add(registration.contribution.language);
    }
    return Array.from(languages);
  }

  /**
   * Clear all snippets
   */
  clear(): void {
    for (const registration of this.registrations.values()) {
      if (registration.monacoDisposable) {
        registration.monacoDisposable.dispose();
      }
    }
    this.registrations.clear();
    this.emit({ type: 'cleared' });
  }

  /**
   * Register snippets with Monaco
   */
  private registerWithMonaco(
    _id: string,
    registration: RegisteredSnippet
  ): void {
    const monaco = this.monacoInstance;
    if (!monaco?.languages) return;

    const { contribution, snippets } = registration;

    try {
      // Create completion item provider
      const disposable = monaco.languages.registerCompletionItemProvider(
        contribution.language,
        {
          provideCompletionItems: (
            _model: unknown,
            position: unknown
          ): languages.ProviderResult<languages.CompletionList> => {
            const suggestions: languages.CompletionItem[] = [];
            const pos = position as { lineNumber: number; column: number };

            for (const [name, snippet] of snippets) {
              const insertText = Array.isArray(snippet.body)
                ? snippet.body.join('\n')
                : snippet.body;

              suggestions.push({
                label: snippet.prefix,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: {
                  value: snippet.description || name,
                },
                detail: `(snippet) ${name}`,
                sortText: `!${snippet.prefix}`, // Prioritize snippets
                range: {
                  startLineNumber: pos.lineNumber,
                  startColumn: pos.column,
                  endLineNumber: pos.lineNumber,
                  endColumn: pos.column,
                },
              });
            }

            return { suggestions };
          },
        }
      );

      registration.monacoDisposable = disposable;
    } catch (error) {
      console.error(
        `[SnippetRegistry] Failed to register with Monaco: ${contribution.language}`,
        error
      );
    }
  }

  /**
   * Convert snippet body to Monaco snippet format
   * Transforms VS Code-style placeholders to Monaco format
   */
  convertSnippetBody(body: string | string[]): string {
    const text = Array.isArray(body) ? body.join('\n') : body;

    // VS Code snippets use ${1:default} format, which Monaco also supports
    // Just return as-is for now
    return text;
  }

  /**
   * Subscribe to registry events
   */
  onEvent(listener: (event: SnippetRegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SnippetRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[SnippetRegistry] Event listener error:', error);
      }
    }
  }
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type SnippetRegistryEvent =
  | { type: 'registered'; id: string; pluginId: string; count: number }
  | { type: 'unregistered'; id: string; pluginId: string }
  | { type: 'cleared' };

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const snippetRegistry = new SnippetRegistry();
