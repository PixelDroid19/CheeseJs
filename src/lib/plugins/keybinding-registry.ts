/**
 * Keybinding Registry
 *
 * Manages keybinding contributions from plugins.
 * Integrates with Monaco Editor for keyboard shortcuts.
 */

import type { KeybindingContribution } from './plugin-api';
import { commandRegistry } from './command-registry';
// import type { Monaco } from '@monaco-editor/react';
import type { editor, languages, KeyMod, KeyCode } from 'monaco-editor';

interface MonacoGlobal {
  editor: typeof editor;
  languages: typeof languages;
  KeyMod: typeof KeyMod;
  KeyCode: typeof KeyCode;
}

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredKeybinding {
  contribution: KeybindingContribution;
  pluginId: string;
  isActive: boolean;
  monacoDisposable?: { dispose: () => void };
}

export interface ParsedKeybinding {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
  keyCode?: number;
}

// ============================================================================
// KEYBINDING REGISTRY
// ============================================================================

export class KeybindingRegistry {
  private keybindings: Map<string, RegisteredKeybinding> = new Map();
  private monacoInstance: MonacoGlobal | null = null;
  private listeners: Set<(event: KeybindingRegistryEvent) => void> = new Set();

  /**
   * Set the Monaco instance for keybinding registration
   */
  setMonacoInstance(monaco: MonacoGlobal): void {
    this.monacoInstance = monaco;

    // Re-register all keybindings with Monaco
    for (const [id, keybinding] of this.keybindings) {
      if (keybinding.isActive) {
        this.registerWithMonaco(id, keybinding);
      }
    }
  }

  /**
   * Register a keybinding contribution
   */
  register(pluginId: string, contribution: KeybindingContribution): void {
    const id = `${pluginId}.${contribution.command}.${contribution.key}`;

    if (this.keybindings.has(id)) {
      console.warn(
        `[KeybindingRegistry] Keybinding '${id}' already registered`
      );
      return;
    }

    const keybinding: RegisteredKeybinding = {
      contribution,
      pluginId,
      isActive: true,
    };

    this.keybindings.set(id, keybinding);

    // Register with Monaco if available
    if (this.monacoInstance) {
      this.registerWithMonaco(id, keybinding);
    }

    this.emit({ type: 'registered', id, pluginId });
    console.log(
      `[KeybindingRegistry] Registered keybinding: ${contribution.key} -> ${contribution.command}`
    );
  }

  /**
   * Unregister all keybindings from a plugin
   */
  unregisterByPlugin(pluginId: string): void {
    const toRemove: string[] = [];

    for (const [id, keybinding] of this.keybindings) {
      if (keybinding.pluginId === pluginId) {
        // Dispose Monaco keybinding
        if (keybinding.monacoDisposable) {
          keybinding.monacoDisposable.dispose();
        }
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.keybindings.delete(id);
      this.emit({ type: 'unregistered', id, pluginId });
    }

    if (toRemove.length > 0) {
      console.log(
        `[KeybindingRegistry] Unregistered ${toRemove.length} keybindings from ${pluginId}`
      );
    }
  }

  /**
   * Get keybindings for a command
   */
  getByCommand(command: string): RegisteredKeybinding[] {
    return Array.from(this.keybindings.values()).filter(
      (kb) => kb.contribution.command === command
    );
  }

  /**
   * Get all registered keybindings
   */
  getAll(): RegisteredKeybinding[] {
    return Array.from(this.keybindings.values());
  }

  /**
   * Activate/deactivate a keybinding
   */
  setActive(id: string, active: boolean): void {
    const keybinding = this.keybindings.get(id);
    if (keybinding) {
      keybinding.isActive = active;

      if (active && this.monacoInstance) {
        this.registerWithMonaco(id, keybinding);
      } else if (!active && keybinding.monacoDisposable) {
        keybinding.monacoDisposable.dispose();
        keybinding.monacoDisposable = undefined;
      }

      this.emit({ type: active ? 'activated' : 'deactivated', id });
    }
  }

  /**
   * Clear all keybindings
   */
  clear(): void {
    for (const keybinding of this.keybindings.values()) {
      if (keybinding.monacoDisposable) {
        keybinding.monacoDisposable.dispose();
      }
    }
    this.keybindings.clear();
    this.emit({ type: 'cleared' });
  }

  /**
   * Parse a key string into components
   */
  parseKey(keyString: string): ParsedKeybinding {
    const parts = keyString
      .toLowerCase()
      .split('+')
      .map((p) => p.trim());

    const parsed: ParsedKeybinding = {
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      key: '',
    };

    for (const part of parts) {
      switch (part) {
        case 'ctrl':
        case 'control':
          parsed.ctrlKey = true;
          break;
        case 'shift':
          parsed.shiftKey = true;
          break;
        case 'alt':
          parsed.altKey = true;
          break;
        case 'meta':
        case 'cmd':
        case 'command':
          parsed.metaKey = true;
          break;
        default:
          parsed.key = part;
      }
    }

    return parsed;
  }

  /**
   * Convert parsed keybinding to Monaco KeyMod + KeyCode
   */
  private toMonacoKeybinding(
    parsed: ParsedKeybinding,
    monaco: MonacoGlobal
  ): number {
    let keybinding = 0;

    if (parsed.ctrlKey) {
      keybinding |= monaco.KeyMod.CtrlCmd;
    }
    if (parsed.shiftKey) {
      keybinding |= monaco.KeyMod.Shift;
    }
    if (parsed.altKey) {
      keybinding |= monaco.KeyMod.Alt;
    }
    if (parsed.metaKey) {
      keybinding |= monaco.KeyMod.WinCtrl;
    }

    // Map key to Monaco KeyCode
    const keyCode = this.keyToMonacoKeyCode(parsed.key, monaco);
    keybinding |= keyCode;

    return keybinding;
  }

  /**
   * Map a key string to Monaco KeyCode
   */
  private keyToMonacoKeyCode(key: string, monaco: MonacoGlobal): number {
    const keyMap: Record<string, string> = {
      a: 'KeyA',
      b: 'KeyB',
      c: 'KeyC',
      d: 'KeyD',
      e: 'KeyE',
      f: 'KeyF',
      g: 'KeyG',
      h: 'KeyH',
      i: 'KeyI',
      j: 'KeyJ',
      k: 'KeyK',
      l: 'KeyL',
      m: 'KeyM',
      n: 'KeyN',
      o: 'KeyO',
      p: 'KeyP',
      q: 'KeyQ',
      r: 'KeyR',
      s: 'KeyS',
      t: 'KeyT',
      u: 'KeyU',
      v: 'KeyV',
      w: 'KeyW',
      x: 'KeyX',
      y: 'KeyY',
      z: 'KeyZ',
      '0': 'Digit0',
      '1': 'Digit1',
      '2': 'Digit2',
      '3': 'Digit3',
      '4': 'Digit4',
      '5': 'Digit5',
      '6': 'Digit6',
      '7': 'Digit7',
      '8': 'Digit8',
      '9': 'Digit9',
      f1: 'F1',
      f2: 'F2',
      f3: 'F3',
      f4: 'F4',
      f5: 'F5',
      f6: 'F6',
      f7: 'F7',
      f8: 'F8',
      f9: 'F9',
      f10: 'F10',
      f11: 'F11',
      f12: 'F12',
      enter: 'Enter',
      escape: 'Escape',
      esc: 'Escape',
      backspace: 'Backspace',
      tab: 'Tab',
      space: 'Space',
      delete: 'Delete',
      insert: 'Insert',
      home: 'Home',
      end: 'End',
      pageup: 'PageUp',
      pagedown: 'PageDown',
      up: 'UpArrow',
      down: 'DownArrow',
      left: 'LeftArrow',
      right: 'RightArrow',
    };

    const monacoKey = keyMap[key.toLowerCase()] || key;
    return monaco.KeyCode[monacoKey as keyof typeof monaco.KeyCode] || 0;
  }

  /**
   * Register keybinding with Monaco
   */
  private registerWithMonaco(
    _id: string,
    keybinding: RegisteredKeybinding
  ): void {
    const monaco = this.monacoInstance;
    if (!monaco?.editor) return;

    const { contribution } = keybinding;

    // Get platform-specific key
    const platform = this.getPlatform();
    let keyString = contribution.key;
    if (platform === 'mac' && contribution.mac) {
      keyString = contribution.mac;
    } else if (platform === 'linux' && contribution.linux) {
      keyString = contribution.linux;
    }

    const parsed = this.parseKey(keyString);
    const monacoKeybinding = this.toMonacoKeybinding(parsed, monaco);

    try {
      // Add keybinding action to Monaco
      const disposable = monaco.editor.addKeybindingRule({
        keybinding: monacoKeybinding,
        command: contribution.command,
        when: contribution.when,
      });

      keybinding.monacoDisposable = disposable;

      // Also register the command handler if not already registered
      if (!commandRegistry.has(contribution.command)) {
        commandRegistry.registerHandler(contribution.command, async () => {
          await commandRegistry.execute(contribution.command, [], 'keybinding');
        });
      }
    } catch (error) {
      console.error(
        `[KeybindingRegistry] Failed to register with Monaco: ${keyString}`,
        error
      );
    }
  }

  /**
   * Get current platform
   */
  private getPlatform(): 'mac' | 'linux' | 'windows' {
    if (typeof navigator !== 'undefined') {
      const platform = navigator.platform.toLowerCase();
      if (platform.includes('mac')) return 'mac';
      if (platform.includes('linux')) return 'linux';
    }
    return 'windows';
  }

  /**
   * Subscribe to registry events
   */
  onEvent(listener: (event: KeybindingRegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: KeybindingRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[KeybindingRegistry] Event listener error:', error);
      }
    }
  }
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type KeybindingRegistryEvent =
  | { type: 'registered'; id: string; pluginId: string }
  | { type: 'unregistered'; id: string; pluginId: string }
  | { type: 'activated'; id: string }
  | { type: 'deactivated'; id: string }
  | { type: 'cleared' };

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const keybindingRegistry = new KeybindingRegistry();
