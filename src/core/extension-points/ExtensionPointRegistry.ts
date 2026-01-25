/**
 * Extension Point Registry
 *
 * Dynamic registry system for plugin extension points.
 * Allows creation of new extension types without modifying core code.
 */

import { eventBus } from '../events/EventBus';

// ============================================================================
// TYPES
// ============================================================================

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ExtensionPoint<T = unknown> {
  id: string;
  description: string;
  schema?: JSONSchema;
  extensions: Map<string, RegisteredExtension<T>>;
}

export interface RegisteredExtension<T = unknown> {
  pluginId: string;
  contribution: T;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// EXTENSION POINT REGISTRY
// ============================================================================

export class ExtensionPointRegistry {
  private extensionPoints = new Map<string, ExtensionPoint>();

  /**
   * Register a new extension point
   */
  registerExtensionPoint<T>(
    id: string,
    description: string,
    schema?: JSONSchema
  ): ExtensionPoint<T> {
    if (this.extensionPoints.has(id)) {
      console.warn(
        `[ExtensionPointRegistry] Extension point '${id}' already registered`
      );
      return this.extensionPoints.get(id) as ExtensionPoint<T>;
    }

    const point: ExtensionPoint<T> = {
      id,
      description,
      schema,
      extensions: new Map(),
    };

    this.extensionPoints.set(id, point);
    console.log(`[ExtensionPointRegistry] Registered extension point: ${id}`);

    return point;
  }

  /**
   * Register an extension to a point
   */
  registerExtension<T>(
    pointId: string,
    extensionId: string,
    pluginId: string,
    contribution: T,
    metadata?: Record<string, unknown>
  ): void {
    const point = this.extensionPoints.get(pointId);
    if (!point) {
      throw new Error(`Extension point '${pointId}' not found`);
    }

    // Validate contribution if schema exists
    if (point.schema) {
      this.validateContribution(contribution, point.schema);
    }

    point.extensions.set(extensionId, {
      pluginId,
      contribution,
      metadata,
    });

    // Emit event for tracking
    eventBus.emit('extension-point.registered', {
      pointId,
      extensionId,
      pluginId,
    });

    console.log(
      `[ExtensionPointRegistry] Registered extension '${extensionId}' to point '${pointId}'`
    );
  }

  /**
   * Unregister an extension
   */
  unregisterExtension(pointId: string, extensionId: string): void {
    const point = this.extensionPoints.get(pointId);
    if (!point) return;

    point.extensions.delete(extensionId);

    eventBus.emit('extension-point.unregistered', {
      pointId,
      extensionId,
    });

    console.log(
      `[ExtensionPointRegistry] Unregistered extension '${extensionId}' from point '${pointId}'`
    );
  }

  /**
   * Unregister all extensions for a plugin
   */
  unregisterPluginExtensions(pluginId: string): void {
    for (const [pointId, point] of this.extensionPoints) {
      const extensionsToRemove: string[] = [];

      for (const [extensionId, registered] of point.extensions) {
        if (registered.pluginId === pluginId) {
          extensionsToRemove.push(extensionId);
        }
      }

      for (const extensionId of extensionsToRemove) {
        this.unregisterExtension(pointId, extensionId);
      }
    }
  }

  /**
   * Get all extensions for a point
   */
  getExtensions<T>(pointId: string): Map<string, RegisteredExtension<T>> {
    const point = this.extensionPoints.get(pointId);
    return (
      (point?.extensions as Map<string, RegisteredExtension<T>>) || new Map()
    );
  }

  /**
   * Get a specific extension
   */
  getExtension<T>(pointId: string, extensionId: string): T | undefined {
    const point = this.extensionPoints.get(pointId);
    return point?.extensions.get(extensionId)?.contribution as T | undefined;
  }

  /**
   * Get all extensions for a plugin
   */
  getPluginExtensions(pluginId: string): Map<string, RegisteredExtension[]> {
    const result = new Map<string, RegisteredExtension[]>();

    for (const [pointId, point] of this.extensionPoints) {
      const pluginExtensions = Array.from(point.extensions.values()).filter(
        (ext) => ext.pluginId === pluginId
      );

      if (pluginExtensions.length > 0) {
        result.set(pointId, pluginExtensions);
      }
    }

    return result;
  }

  /**
   * Check if an extension point exists
   */
  hasExtensionPoint(pointId: string): boolean {
    return this.extensionPoints.has(pointId);
  }

  /**
   * Get all extension point IDs
   */
  getExtensionPointIds(): string[] {
    return Array.from(this.extensionPoints.keys());
  }

  /**
   * Get extension point metadata
   */
  getExtensionPoint(pointId: string): ExtensionPoint | undefined {
    return this.extensionPoints.get(pointId);
  }

  /**
   * Validate contribution against schema (basic validation)
   */
  private validateContribution(
    contribution: unknown,
    schema: JSONSchema
  ): void {
    // Basic type validation
    if (schema.type && typeof contribution !== schema.type) {
      throw new Error(
        `Contribution type mismatch: expected ${schema.type}, got ${typeof contribution}`
      );
    }

    // Required fields validation
    if (
      schema.required &&
      typeof contribution === 'object' &&
      contribution !== null
    ) {
      for (const field of schema.required) {
        if (!(field in contribution)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }

    // For more complex validation, integrate ajv or similar library
  }

  /**
   * Clear all extension points (for testing/cleanup)
   */
  clear(): void {
    this.extensionPoints.clear();
  }
}

// ============================================================================
// BUILT-IN EXTENSION POINTS
// ============================================================================

export const BuiltInExtensionPoints = {
  LANGUAGES: 'languages',
  TRANSPILERS: 'transpilers',
  CONSOLE_FORMATTERS: 'consoleFormatters',
  UI_PANELS: 'uiPanels',
  CODE_ACTIONS: 'codeActions',
  THEMES: 'themes',
  SNIPPETS: 'snippets',
  COMMANDS: 'commands',
  KEYBINDINGS: 'keybindings',
} as const;

/**
 * Register built-in extension points
 */
export function registerBuiltInExtensionPoints(
  registry: ExtensionPointRegistry
): void {
  // Languages
  registry.registerExtensionPoint(
    BuiltInExtensionPoints.LANGUAGES,
    'Programming language definitions',
    {
      type: 'object',
      required: ['id', 'name', 'extensions'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        extensions: { type: 'array' },
      },
    }
  );

  // Transpilers
  registry.registerExtensionPoint(
    BuiltInExtensionPoints.TRANSPILERS,
    'Code transpilation extensions',
    {
      type: 'object',
      required: ['sourceLanguage', 'targetLanguage'],
      properties: {
        sourceLanguage: { type: 'string' },
        targetLanguage: { type: 'string' },
        priority: { type: 'number' },
      },
    }
  );

  // Console Formatters
  registry.registerExtensionPoint(
    BuiltInExtensionPoints.CONSOLE_FORMATTERS,
    'Custom console output formatters',
    {
      type: 'object',
      required: ['types'],
      properties: {
        types: { type: 'array' },
        priority: { type: 'number' },
      },
    }
  );

  // UI Panels
  registry.registerExtensionPoint(
    BuiltInExtensionPoints.UI_PANELS,
    'Custom UI panels and sidebars',
    {
      type: 'object',
      required: ['id', 'title', 'location'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        location: { type: 'string' },
        icon: { type: 'string' },
        priority: { type: 'number' },
      },
    }
  );

  // Commands
  registry.registerExtensionPoint(
    BuiltInExtensionPoints.COMMANDS,
    'Executable commands',
    {
      type: 'object',
      required: ['command', 'title'],
      properties: {
        command: { type: 'string' },
        title: { type: 'string' },
        icon: { type: 'string' },
        category: { type: 'string' },
      },
    }
  );

  console.log('[ExtensionPointRegistry] Registered built-in extension points');
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const extensionPointRegistry = new ExtensionPointRegistry();

// Auto-register built-in extension points
registerBuiltInExtensionPoints(extensionPointRegistry);
