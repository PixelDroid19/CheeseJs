/**
 * Command Registry
 *
 * Manages command contributions from plugins.
 * Commands can be executed via keybindings, command palette, or programmatically.
 */

import type { CommandContribution } from './plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export type CommandHandler = (...args: unknown[]) => void | Promise<void>;

export interface RegisteredCommand {
  contribution: CommandContribution;
  handler?: CommandHandler;
  pluginId: string;
  isEnabled: boolean;
}

export interface CommandExecutionContext {
  /** The command being executed */
  command: string;
  /** Arguments passed to the command */
  args: unknown[];
  /** Source of the execution (keybinding, palette, api) */
  source: 'keybinding' | 'palette' | 'api' | 'menu';
}

// ============================================================================
// COMMAND REGISTRY
// ============================================================================

export class CommandRegistry {
  private commands: Map<string, RegisteredCommand> = new Map();
  private listeners: Set<(event: CommandRegistryEvent) => void> = new Set();

  /**
   * Register a command contribution from a plugin manifest
   */
  registerContribution(
    pluginId: string,
    contribution: CommandContribution
  ): void {
    const commandId = contribution.command;

    if (this.commands.has(commandId)) {
      console.warn(
        `[CommandRegistry] Command '${commandId}' already registered, overwriting`
      );
    }

    this.commands.set(commandId, {
      contribution,
      pluginId,
      isEnabled: true,
    });

    this.emit({ type: 'registered', commandId, pluginId });
    console.log(
      `[CommandRegistry] Registered command: ${commandId} from ${pluginId}`
    );
  }

  /**
   * Register or update the handler for a command
   */
  registerHandler(commandId: string, handler: CommandHandler): void {
    const command = this.commands.get(commandId);
    if (!command) {
      // Allow registering handler before contribution (for built-in commands)
      this.commands.set(commandId, {
        contribution: { command: commandId, title: commandId },
        handler,
        pluginId: 'core',
        isEnabled: true,
      });
    } else {
      command.handler = handler;
    }

    this.emit({ type: 'handler-registered', commandId });
    console.log(`[CommandRegistry] Handler registered for: ${commandId}`);
  }

  /**
   * Execute a command by ID
   */
  async execute(
    commandId: string,
    args: unknown[] = [],
    source: CommandExecutionContext['source'] = 'api'
  ): Promise<unknown> {
    const command = this.commands.get(commandId);

    if (!command) {
      throw new Error(`Command '${commandId}' not found`);
    }

    if (!command.isEnabled) {
      console.warn(`[CommandRegistry] Command '${commandId}' is disabled`);
      return undefined;
    }

    if (!command.handler) {
      throw new Error(`Command '${commandId}' has no handler registered`);
    }

    const context: CommandExecutionContext = {
      command: commandId,
      args,
      source,
    };

    this.emit({ type: 'executing', commandId, context });

    try {
      const result = await command.handler(...args);
      this.emit({ type: 'executed', commandId, context, result });
      return result;
    } catch (error) {
      this.emit({ type: 'error', commandId, context, error });
      throw error;
    }
  }

  /**
   * Unregister all commands from a plugin
   */
  unregisterByPlugin(pluginId: string): void {
    const toRemove: string[] = [];

    for (const [commandId, command] of this.commands) {
      if (command.pluginId === pluginId) {
        toRemove.push(commandId);
      }
    }

    for (const commandId of toRemove) {
      this.commands.delete(commandId);
      this.emit({ type: 'unregistered', commandId, pluginId });
    }

    if (toRemove.length > 0) {
      console.log(
        `[CommandRegistry] Unregistered ${toRemove.length} commands from ${pluginId}`
      );
    }
  }

  /**
   * Get a command by ID
   */
  get(commandId: string): RegisteredCommand | undefined {
    return this.commands.get(commandId);
  }

  /**
   * Check if a command exists
   */
  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  /**
   * Get all registered commands
   */
  getAll(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by plugin
   */
  getByPlugin(pluginId: string): RegisteredCommand[] {
    return this.getAll().filter((cmd) => cmd.pluginId === pluginId);
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): RegisteredCommand[] {
    return this.getAll().filter(
      (cmd) => cmd.contribution.category === category
    );
  }

  /**
   * Enable/disable a command
   */
  setEnabled(commandId: string, enabled: boolean): void {
    const command = this.commands.get(commandId);
    if (command) {
      command.isEnabled = enabled;
      this.emit({ type: enabled ? 'enabled' : 'disabled', commandId });
    }
  }

  /**
   * Clear all commands (useful for testing)
   */
  clear(): void {
    this.commands.clear();
    this.emit({ type: 'cleared' });
  }

  /**
   * Subscribe to registry events
   */
  onEvent(listener: (event: CommandRegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: CommandRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[CommandRegistry] Event listener error:', error);
      }
    }
  }
}

// ============================================================================
// TYPES FOR EVENTS
// ============================================================================

export type CommandRegistryEvent =
  | { type: 'registered'; commandId: string; pluginId: string }
  | { type: 'unregistered'; commandId: string; pluginId: string }
  | { type: 'handler-registered'; commandId: string }
  | { type: 'executing'; commandId: string; context: CommandExecutionContext }
  | {
      type: 'executed';
      commandId: string;
      context: CommandExecutionContext;
      result: unknown;
    }
  | {
      type: 'error';
      commandId: string;
      context: CommandExecutionContext;
      error: unknown;
    }
  | { type: 'enabled'; commandId: string }
  | { type: 'disabled'; commandId: string }
  | { type: 'cleared' };

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const commandRegistry = new CommandRegistry();
