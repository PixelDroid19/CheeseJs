/**
 * Theme Manager
 *
 * Central coordinator for the theme system.
 * Manages theme registration, loading, application, and event emission.
 * Integrates all theme subsystems into a cohesive API.
 */

import type {
  ExtendedThemeDefinition,
  ThemeChangeEvent,
  ThemeRegistrationEvent,
  ThemeLoadErrorEvent,
  ThemeLoadOptions,
  ThemeApplyOptions,
  ThemeSubscription,
  ThemeSubscriptionCallback,
  ThemeSubscriptionOptions,
  RegisteredTheme,
  ThemeType,
  CSSVariableMap,
  ThemePluginContribution,
} from './types';

import { eventBus, ExtensionEvents } from '../../core/events/EventBus';
import { ThemeVariableManager } from './theme-variable-manager';
import { ThemePluginAdapter } from './theme-plugin-adapter';
import {
  MonacoThemeWrapper,
  type MonacoInstance,
} from './monaco-theme-wrapper';
import {
  ThemeError,
  ThemeNotFoundError,
  ThemeLoadError,
  ThemeApplicationError,
  ThemeInheritanceError,
  wrapAsThemeError,
} from './theme-errors';

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeManagerOptions {
  /** Default theme ID */
  defaultTheme?: string;
  /** Fallback theme ID when errors occur */
  fallbackTheme?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** CSS transition duration for theme changes (ms) */
  transitionDuration?: number;
  /** Auto-apply CSS variables */
  autoCssVariables?: boolean;
}

export interface ThemeManagerState {
  /** Currently active theme ID */
  activeTheme: string | null;
  /** All registered themes */
  registeredThemes: Map<string, RegisteredTheme>;
  /** Whether manager is initialized */
  isInitialized: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Current error (if any) */
  error: ThemeError | null;
}

// ============================================================================
// THEME MANAGER
// ============================================================================

export class ThemeManager {
  private options: Required<ThemeManagerOptions>;
  private state: ThemeManagerState;
  private subscriptions: Map<string, ThemeSubscriptionCallback> = new Map();
  private subscriptionIdCounter = 0;

  // Subsystems
  private variableManager: ThemeVariableManager;
  private pluginAdapter: ThemePluginAdapter;
  private monacoWrapper: MonacoThemeWrapper;

  // Built-in themes cache
  private builtinThemes: Map<string, ExtendedThemeDefinition> = new Map();

  constructor(options: ThemeManagerOptions = {}) {
    this.options = {
      defaultTheme: options.defaultTheme ?? 'vs-dark',
      fallbackTheme: options.fallbackTheme ?? 'vs-dark',
      debug: options.debug ?? false,
      transitionDuration: options.transitionDuration ?? 200,
      autoCssVariables: options.autoCssVariables ?? true,
    };

    this.state = {
      activeTheme: null,
      registeredThemes: new Map(),
      isInitialized: false,
      isLoading: false,
      error: null,
    };

    // Initialize subsystems
    this.variableManager = new ThemeVariableManager({
      transitionDuration: this.options.transitionDuration,
      debug: this.options.debug,
    });
    this.pluginAdapter = ThemePluginAdapter.getInstance();
    this.monacoWrapper = new MonacoThemeWrapper();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize the theme manager
   */
  async initialize(monaco?: MonacoInstance): Promise<void> {
    if (this.state.isInitialized) {
      this.log('warn', 'Theme manager already initialized');
      return;
    }

    this.log('info', 'Initializing theme manager...');

    // Set Monaco instance if provided
    if (monaco) {
      this.setMonacoInstance(monaco);
    }

    // Register built-in Monaco themes
    this.registerBuiltinThemes();

    this.state.isInitialized = true;
    this.log('info', 'Theme manager initialized');
  }

  /**
   * Set the Monaco Editor instance
   */
  setMonacoInstance(monaco: MonacoInstance): void {
    this.monacoWrapper.setMonaco(monaco);

    // Register all loaded themes with Monaco
    for (const [themeId, theme] of this.state.registeredThemes) {
      if (theme.definition) {
        this.monacoWrapper.registerTheme(themeId, theme.definition);
      }
    }
  }

  /**
   * Register built-in Monaco themes
   */
  private registerBuiltinThemes(): void {
    const builtins: Array<{
      id: string;
      base: 'vs' | 'vs-dark' | 'hc-black';
      type: ThemeType;
    }> = [
      { id: 'vs', base: 'vs', type: 'light' },
      { id: 'vs-dark', base: 'vs-dark', type: 'dark' },
      { id: 'hc-black', base: 'hc-black', type: 'high-contrast' },
    ];

    for (const builtin of builtins) {
      const definition: ExtendedThemeDefinition = {
        base: builtin.base,
        inherit: false,
        rules: [],
        colors: {},
        metadata: {
          name: builtin.id,
          description: `Built-in ${builtin.id} theme`,
        },
      };

      this.builtinThemes.set(builtin.id, definition);

      this.state.registeredThemes.set(builtin.id, {
        id: builtin.id,
        label: builtin.id,
        type: builtin.type,
        base: builtin.base,
        pluginId: 'builtin',
        definition,
        isLoaded: true,
        isRegisteredWithMonaco: true, // Monaco has these built-in
      });
    }
  }

  // ========================================================================
  // THEME REGISTRATION
  // ========================================================================

  /**
   * Register a theme from a plugin contribution
   */
  registerTheme(
    pluginId: string,
    contribution: ThemePluginContribution,
    definition?: ExtendedThemeDefinition
  ): void {
    const themeId = contribution.id;

    if (this.state.registeredThemes.has(themeId)) {
      this.log('warn', `Theme '${themeId}' already registered, updating...`);
    }

    const type = this.determineThemeType(contribution.uiTheme);

    const registeredTheme: RegisteredTheme = {
      id: themeId,
      label: contribution.label,
      type,
      base: contribution.uiTheme,
      pluginId,
      path: contribution.path,
      definition,
      isLoaded: !!definition,
      isRegisteredWithMonaco: false,
      extendsTheme: contribution.extends,
    };

    this.state.registeredThemes.set(themeId, registeredTheme);

    // Register with Monaco if definition is available
    if (definition && this.monacoWrapper.isReady()) {
      const resolved = this.resolveThemeInheritance(definition);
      this.monacoWrapper.registerTheme(themeId, resolved);
      registeredTheme.isRegisteredWithMonaco = true;
    }

    // Emit event
    this.emitRegistrationEvent({
      themeId,
      pluginId,
      eventType: 'registered',
    });

    this.log('info', `Registered theme: ${themeId} from plugin ${pluginId}`);
  }

  /**
   * Register a theme with its full definition
   */
  registerThemeWithDefinition(
    themeId: string,
    definition: ExtendedThemeDefinition,
    pluginId: string = 'custom'
  ): void {
    const type = this.determineThemeType(definition.base);

    // Validate and normalize the theme
    const validation = this.pluginAdapter.validate(definition);
    if (!validation.isValid) {
      const errors = validation.errors.map((e) => e.message).join(', ');
      throw new ThemeLoadError(themeId, `Validation failed: ${errors}`);
    }

    const normalizedDefinition = validation.normalizedTheme ?? definition;

    const registeredTheme: RegisteredTheme = {
      id: themeId,
      label: definition.metadata?.name ?? themeId,
      type,
      base: definition.base,
      pluginId,
      definition: normalizedDefinition,
      isLoaded: true,
      isRegisteredWithMonaco: false,
      extendsTheme: definition.extends,
    };

    this.state.registeredThemes.set(themeId, registeredTheme);

    // Register with Monaco
    if (this.monacoWrapper.isReady()) {
      const resolved = this.resolveThemeInheritance(normalizedDefinition);
      this.monacoWrapper.registerTheme(themeId, resolved);
      registeredTheme.isRegisteredWithMonaco = true;
    }

    this.emitRegistrationEvent({
      themeId,
      pluginId,
      eventType: 'registered',
    });

    this.log('info', `Registered theme with definition: ${themeId}`);
  }

  /**
   * Unregister a theme
   */
  unregisterTheme(themeId: string): boolean {
    const theme = this.state.registeredThemes.get(themeId);
    if (!theme) {
      return false;
    }

    // Don't allow unregistering built-in themes
    if (theme.pluginId === 'builtin') {
      this.log('warn', `Cannot unregister built-in theme: ${themeId}`);
      return false;
    }

    // If this is the active theme, switch to fallback
    if (this.state.activeTheme === themeId) {
      this.applyTheme(this.options.fallbackTheme);
    }

    this.state.registeredThemes.delete(themeId);
    this.monacoWrapper.unregisterTheme(themeId);

    this.emitRegistrationEvent({
      themeId,
      pluginId: theme.pluginId,
      eventType: 'unregistered',
    });

    this.log('info', `Unregistered theme: ${themeId}`);
    return true;
  }

  /**
   * Unregister all themes from a plugin
   */
  unregisterPluginThemes(pluginId: string): number {
    const themesToRemove: string[] = [];

    for (const [themeId, theme] of this.state.registeredThemes) {
      if (theme.pluginId === pluginId) {
        themesToRemove.push(themeId);
      }
    }

    for (const themeId of themesToRemove) {
      this.unregisterTheme(themeId);
    }

    return themesToRemove.length;
  }

  // ========================================================================
  // THEME LOADING
  // ========================================================================

  /**
   * Load a theme definition (if not already loaded)
   */
  async loadTheme(
    themeId: string,
    loadFn: (path: string) => Promise<unknown>,
    options: ThemeLoadOptions = {}
  ): Promise<ExtendedThemeDefinition> {
    const theme = this.state.registeredThemes.get(themeId);
    if (!theme) {
      throw new ThemeNotFoundError(themeId, this.getRegisteredThemeIds());
    }

    // Return cached definition if already loaded
    if (theme.isLoaded && theme.definition && !options.forceReload) {
      return theme.definition;
    }

    if (!theme.path) {
      throw new ThemeLoadError(themeId, 'Theme has no path defined');
    }

    this.state.isLoading = true;
    eventBus.emit(ExtensionEvents.THEME_LOADING, { themeId });

    const retries = options.retries ?? 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const rawTheme = await this.loadWithTimeout(
          loadFn(theme.path),
          options.timeout ?? 10000
        );

        // Convert to extended format
        const definition = this.pluginAdapter.toExtendedFormat(
          rawTheme,
          themeId,
          { validate: !options.skipValidation }
        );

        // Update registered theme
        theme.definition = definition;
        theme.isLoaded = true;
        theme.loadedAt = Date.now();
        theme.loadError = undefined;

        // Register with Monaco
        if (this.monacoWrapper.isReady()) {
          const resolved = this.resolveThemeInheritance(definition);
          this.monacoWrapper.registerTheme(themeId, resolved);
          theme.isRegisteredWithMonaco = true;
        }

        this.state.isLoading = false;
        eventBus.emit(ExtensionEvents.THEME_LOADED, { themeId, definition });

        this.log('info', `Loaded theme: ${themeId}`);
        return definition;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(
          'warn',
          `Failed to load theme ${themeId} (attempt ${attempt + 1}/${retries + 1}): ${lastError.message}`
        );

        if (attempt < retries) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 500);
        }
      }
    }

    // All retries failed
    this.state.isLoading = false;
    theme.loadError = lastError?.message;

    const loadError = new ThemeLoadError(
      themeId,
      lastError?.message ?? 'Unknown error',
      {
        path: theme.path,
        retryCount: retries,
        originalError: lastError,
      }
    );

    this.emitLoadError({
      themeId,
      error: loadError.message,
      originalError: lastError,
    });

    throw loadError;
  }

  // ========================================================================
  // THEME APPLICATION
  // ========================================================================

  /**
   * Apply a theme
   */
  async applyTheme(
    themeId: string,
    options: ThemeApplyOptions = {}
  ): Promise<void> {
    const theme = this.state.registeredThemes.get(themeId);
    if (!theme) {
      throw new ThemeNotFoundError(themeId, this.getRegisteredThemeIds());
    }

    const previousThemeId = this.state.activeTheme;

    try {
      // Ensure theme is loaded
      if (!theme.definition) {
        throw new ThemeLoadError(
          themeId,
          'Theme definition not loaded. Call loadTheme first.'
        );
      }

      // Resolve inheritance
      const resolvedDefinition = this.resolveThemeInheritance(theme.definition);

      // Apply to Monaco
      if (!theme.isRegisteredWithMonaco && this.monacoWrapper.isReady()) {
        this.monacoWrapper.registerTheme(themeId, resolvedDefinition);
        theme.isRegisteredWithMonaco = true;
      }

      this.monacoWrapper.setTheme(themeId, {
        onApplied: options.onApplied,
      });

      // Apply CSS variables
      let cssVariables: CSSVariableMap = {} as CSSVariableMap;
      if (this.options.autoCssVariables && !options.skipCssVariables) {
        const result = this.variableManager.apply(themeId, resolvedDefinition, {
          skipTransition: options.transitionDuration === 0,
        });
        cssVariables = result.applied;
      }

      // Update state
      this.state.activeTheme = themeId;
      this.state.error = null;

      // Emit events
      const changeEvent: ThemeChangeEvent = {
        previousThemeId,
        newThemeId: themeId,
        type: theme.type,
        definition: resolvedDefinition,
        cssVariables,
      };

      eventBus.emit(ExtensionEvents.THEME_APPLIED, changeEvent);
      eventBus.emit(ExtensionEvents.THEME_CHANGED, changeEvent);

      // Notify subscribers
      this.notifySubscribers(changeEvent);

      this.log('info', `Applied theme: ${themeId}`);
    } catch (error) {
      const themeError = wrapAsThemeError(error, themeId, 'applyTheme');
      this.state.error = themeError;

      // Try fallback theme
      if (themeId !== this.options.fallbackTheme) {
        this.log(
          'warn',
          `Theme application failed, trying fallback: ${this.options.fallbackTheme}`
        );
        await this.applyTheme(this.options.fallbackTheme, options);
        return;
      }

      throw new ThemeApplicationError(
        themeId,
        'monaco',
        themeError.message,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Refresh the current theme (re-apply CSS variables)
   */
  refreshTheme(): void {
    if (!this.state.activeTheme) return;

    const theme = this.state.registeredThemes.get(this.state.activeTheme);
    if (theme?.definition) {
      const resolved = this.resolveThemeInheritance(theme.definition);
      this.variableManager.apply(this.state.activeTheme, resolved, {
        skipTransition: true,
      });
    }
  }

  // ========================================================================
  // THEME INHERITANCE
  // ========================================================================

  /**
   * Resolve theme inheritance chain
   */
  private resolveThemeInheritance(
    theme: ExtendedThemeDefinition
  ): ExtendedThemeDefinition {
    if (!theme.extends) {
      return theme;
    }

    const visited = new Set<string>();

    return this.pluginAdapter.resolveInheritance(
      theme,
      (parentId: string) => {
        // Check for circular reference
        if (visited.has(parentId)) {
          throw new ThemeInheritanceError(
            'unknown',
            parentId,
            'Circular inheritance detected',
            Array.from(visited)
          );
        }
        visited.add(parentId);

        const parentTheme = this.state.registeredThemes.get(parentId);
        return parentTheme?.definition;
      },
      visited
    );
  }

  // ========================================================================
  // SUBSCRIPTIONS
  // ========================================================================

  /**
   * Subscribe to theme changes
   */
  subscribe(
    callback: ThemeSubscriptionCallback,
    options: ThemeSubscriptionOptions = {}
  ): ThemeSubscription {
    const id = `sub_${++this.subscriptionIdCounter}`;
    this.subscriptions.set(id, callback);

    // Send immediate update if requested
    if (options.immediate && this.state.activeTheme) {
      const theme = this.state.registeredThemes.get(this.state.activeTheme);
      if (theme?.definition) {
        callback({
          previousThemeId: null,
          newThemeId: this.state.activeTheme,
          type: theme.type,
          definition: theme.definition,
          cssVariables: this.variableManager.getCurrentVariables(),
        });
      }
    }

    return {
      id,
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };
  }

  /**
   * Notify all subscribers of a theme change
   */
  private notifySubscribers(event: ThemeChangeEvent): void {
    for (const callback of this.subscriptions.values()) {
      try {
        callback(event);
      } catch (error) {
        this.log('error', `Subscription callback error: ${error}`);
      }
    }
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  /**
   * Get the current active theme ID
   */
  getActiveThemeId(): string | null {
    return this.state.activeTheme;
  }

  /**
   * Get the current active theme
   */
  getActiveTheme(): RegisteredTheme | undefined {
    if (!this.state.activeTheme) return undefined;
    return this.state.registeredThemes.get(this.state.activeTheme);
  }

  /**
   * Get a registered theme by ID
   */
  getTheme(themeId: string): RegisteredTheme | undefined {
    return this.state.registeredThemes.get(themeId);
  }

  /**
   * Get all registered themes
   */
  getAllThemes(): RegisteredTheme[] {
    return Array.from(this.state.registeredThemes.values());
  }

  /**
   * Get themes by type
   */
  getThemesByType(type: ThemeType): RegisteredTheme[] {
    return this.getAllThemes().filter((t) => t.type === type);
  }

  /**
   * Get themes by plugin
   */
  getThemesByPlugin(pluginId: string): RegisteredTheme[] {
    return this.getAllThemes().filter((t) => t.pluginId === pluginId);
  }

  /**
   * Get registered theme IDs
   */
  getRegisteredThemeIds(): string[] {
    return Array.from(this.state.registeredThemes.keys());
  }

  /**
   * Get current CSS variables
   */
  getCssVariables(): CSSVariableMap {
    return this.variableManager.getCurrentVariables();
  }

  /**
   * Check if a theme is registered
   */
  isThemeRegistered(themeId: string): boolean {
    return this.state.registeredThemes.has(themeId);
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Check if manager is loading
   */
  isLoading(): boolean {
    return this.state.isLoading;
  }

  /**
   * Get current error
   */
  getError(): ThemeError | null {
    return this.state.error;
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  /**
   * Determine theme type from base
   */
  private determineThemeType(base: 'vs' | 'vs-dark' | 'hc-black'): ThemeType {
    switch (base) {
      case 'vs':
        return 'light';
      case 'vs-dark':
        return 'dark';
      case 'hc-black':
        return 'high-contrast';
    }
  }

  /**
   * Load with timeout
   */
  private async loadWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Theme load timeout')), timeout)
      ),
    ]);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Emit registration event
   */
  private emitRegistrationEvent(event: ThemeRegistrationEvent): void {
    eventBus.emit(ExtensionEvents.THEME_REGISTERED, event);
  }

  /**
   * Emit load error event
   */
  private emitLoadError(event: ThemeLoadErrorEvent): void {
    eventBus.emit(ExtensionEvents.THEME_LOAD_ERROR, event);
  }

  /**
   * Log message
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (!this.options.debug && level === 'info') return;

    const prefix = '[ThemeManager]';
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.state.registeredThemes.clear();
    this.state.activeTheme = null;
    this.state.isInitialized = false;
    this.subscriptions.clear();
    this.variableManager.clear();
    this.monacoWrapper.clear();

    // Re-register built-in themes
    this.registerBuiltinThemes();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const themeManager = new ThemeManager();
