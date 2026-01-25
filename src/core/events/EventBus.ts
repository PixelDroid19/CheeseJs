/**
 * Event Bus
 *
 * Central publish/subscribe event system for decoupled communication.
 * Enables async workflows and serves as foundation for plugin messaging.
 */

// ============================================================================
// TYPES
// ============================================================================

export type EventHandler<T = unknown> = (event: T) => void | Promise<void>;

export interface Disposable {
  dispose(): void;
}

export interface IEventBus {
  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Disposable to unsubscribe
   */
  on<T>(event: string, handler: EventHandler<T>): Disposable;

  /**
   * Subscribe to an event once
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Disposable to unsubscribe
   */
  once<T>(event: string, handler: EventHandler<T>): Disposable;

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler function
   */
  off<T>(event: string, handler: EventHandler<T>): void;

  /**
   * Emit an event synchronously
   * @param event - Event name
   * @param data - Event data
   */
  emit<T>(event: string, data: T): void;

  /**
   * Emit an event asynchronously (wait for all handlers)
   * @param event - Event name
   * @param data - Event data
   */
  emitAsync<T>(event: string, data: T): Promise<void>;

  /**
   * Clear all handlers for an event
   * @param event - Event name
   */
  clear(event: string): void;

  /**
   * Clear all handlers for all events
   */
  clearAll(): void;
}

// ============================================================================
// EVENT BUS IMPLEMENTATION
// ============================================================================

export class EventBus implements IEventBus {
  // Use 'any' internally to avoid variance issues with generic handlers
  // The public API remains type-safe via generic methods
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<string, Set<EventHandler<any>>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onceHandlers = new Map<EventHandler<any>, EventHandler<any>>();

  on<T>(event: string, handler: EventHandler<T>): Disposable {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    return {
      dispose: () => this.off(event, handler),
    };
  }

  once<T>(event: string, handler: EventHandler<T>): Disposable {
    // Wrap handler to remove itself after first call
    const wrappedHandler: EventHandler<T> = (data) => {
      this.off(event, wrappedHandler);
      return handler(data);
    };

    // Track original for manual removal
    this.onceHandlers.set(handler, wrappedHandler);

    return this.on(event, wrappedHandler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Check if this is a once handler
    const wrappedHandler = this.onceHandlers.get(handler);
    if (wrappedHandler) {
      handlers.delete(wrappedHandler);
      this.onceHandlers.delete(handler);
    } else {
      handlers.delete(handler);
    }

    // Clean up empty set
    if (handlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  emit<T>(event: string, data: T): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Execute handlers synchronously
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for '${event}':`, error);
      }
    }
  }

  async emitAsync<T>(event: string, data: T): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    // Execute all handlers and wait for completion
    const promises = Array.from(handlers).map((handler) => {
      try {
        return Promise.resolve(handler(data));
      } catch (error) {
        console.error(
          `[EventBus] Error in async handler for '${event}':`,
          error
        );
        return Promise.resolve();
      }
    });

    await Promise.allSettled(promises);
  }

  clear(event: string): void {
    this.handlers.delete(event);
  }

  clearAll(): void {
    this.handlers.clear();
    this.onceHandlers.clear();
  }

  /**
   * Get number of handlers for an event (useful for debugging)
   */
  getHandlerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * Get all registered event names
   */
  getEventNames(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// ============================================================================
// BUILT-IN EVENT CONSTANTS
// ============================================================================

export const ExtensionEvents = {
  // Lifecycle
  EXTENSION_LOADING: 'extension.loading',
  EXTENSION_LOADED: 'extension.loaded',
  EXTENSION_ACTIVATED: 'extension.activated',
  EXTENSION_DEACTIVATING: 'extension.deactivating',
  EXTENSION_DEACTIVATED: 'extension.deactivated',
  EXTENSION_ERROR: 'extension.error',

  // Editor
  EDITOR_DID_CHANGE: 'editor.didChange',
  EDITOR_DID_SAVE: 'editor.didSave',
  EDITOR_DID_OPEN: 'editor.didOpen',
  EDITOR_DID_CLOSE: 'editor.didClose',
  EDITOR_SELECTION_CHANGED: 'editor.selectionChanged',

  // Execution
  EXECUTION_STARTING: 'execution.starting',
  EXECUTION_COMPLETED: 'execution.completed',
  EXECUTION_FAILED: 'execution.failed',

  // Language
  LANGUAGE_DETECTED: 'language.detected',
  LANGUAGE_CHANGED: 'language.changed',

  // Transpilation
  TRANSPILATION_STARTING: 'transpilation.starting',
  TRANSPILATION_COMPLETED: 'transpilation.completed',
  TRANSPILATION_FAILED: 'transpilation.failed',

  // Console
  CONSOLE_OUTPUT: 'console.output',
  CONSOLE_ERROR: 'console.error',
  CONSOLE_WARN: 'console.warn',
  CONSOLE_CLEAR: 'console.clear',

  // Plugin Registry Events
  LANGUAGE_REGISTERED: 'plugin.language.registered',
  TRANSPILER_REGISTERED: 'plugin.transpiler.registered',
  PANEL_REGISTERED: 'plugin.panel.registered',
  FORMATTER_REGISTERED: 'plugin.formatter.registered',

  // Theme Events
  THEME_REGISTERED: 'theme.registered',
  THEME_UNREGISTERED: 'theme.unregistered',
  THEME_LOADING: 'theme.loading',
  THEME_LOADED: 'theme.loaded',
  THEME_APPLIED: 'theme.applied',
  THEME_LOAD_ERROR: 'theme.loadError',
  THEME_CHANGED: 'theme.changed',
} as const;

export type ExtensionEventName =
  (typeof ExtensionEvents)[keyof typeof ExtensionEvents];

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const eventBus = new EventBus();
