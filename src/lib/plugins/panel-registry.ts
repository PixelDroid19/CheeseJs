/**
 * Panel Registry
 *
 * Manages custom UI panel contributions from plugins (renderer-side).
 * Panels can be displayed in sidebar, bottom, or as floating windows.
 */

import type { PanelContribution, UIPanelProvider } from './plugin-api';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredPanel {
  contribution: PanelContribution;
  provider: UIPanelProvider;
  pluginId: string;
  isActive: boolean;
  container?: HTMLElement;
}

// ============================================================================
// PANEL REGISTRY
// ============================================================================

export class PanelRegistry {
  private panels: Map<string, RegisteredPanel> = new Map();

  /**
   * Register a panel contribution
   */
  register(
    pluginId: string,
    contribution: PanelContribution,
    provider: UIPanelProvider
  ): void {
    if (this.panels.has(contribution.id)) {
      console.warn(
        `[PanelRegistry] Panel ${contribution.id} already registered, skipping`
      );
      return;
    }

    this.panels.set(contribution.id, {
      contribution,
      provider,
      pluginId,
      isActive: false,
    });

    console.log(
      `[PanelRegistry] Registered panel: ${contribution.title} (${contribution.location})`
    );
  }

  /**
   * Unregister a panel
   */
  unregister(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    // Dispose if active
    if (panel.isActive) {
      this.deactivatePanel(panelId);
    }

    this.panels.delete(panelId);
    console.log(`[PanelRegistry] Unregistered panel: ${panelId}`);
  }

  /**
   * Activate a panel (render it)
   */
  activatePanel(panelId: string, container: HTMLElement): void {
    const panel = this.panels.get(panelId);
    if (!panel) {
      throw new Error(`Panel ${panelId} not found`);
    }

    if (panel.isActive) {
      console.warn(`[PanelRegistry] Panel ${panelId} is already active`);
      return;
    }

    panel.container = container;
    panel.provider.render(container);
    panel.provider.onActivate?.();
    panel.isActive = true;

    console.log(`[PanelRegistry] Activated panel: ${panelId}`);
  }

  /**
   * Deactivate a panel
   */
  deactivatePanel(panelId: string): void {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.isActive) return;

    panel.provider.onDeactivate?.();
    panel.provider.dispose();

    // Clear container
    if (panel.container) {
      panel.container.innerHTML = '';
    }

    panel.isActive = false;
    panel.container = undefined;

    console.log(`[PanelRegistry] Deactivated panel: ${panelId}`);
  }

  /**
   * Get panels by location
   */
  getPanelsByLocation(
    location: 'sidebar' | 'bottom' | 'floating'
  ): RegisteredPanel[] {
    return Array.from(this.panels.values())
      .filter((p) => p.contribution.location === location)
      .sort(
        (a, b) =>
          (b.contribution.priority ?? 0) - (a.contribution.priority ?? 0)
      );
  }

  /**
   * Get all registered panels
   */
  getAllPanels(): RegisteredPanel[] {
    return Array.from(this.panels.values());
  }

  /**
   * Get panels for a specific plugin
   */
  getPanelsByPlugin(pluginId: string): RegisteredPanel[] {
    return Array.from(this.panels.values()).filter(
      (p) => p.pluginId === pluginId
    );
  }

  /**
   * Clear all registered panels
   */
  clear(): void {
    // Deactivate all active panels
    for (const [id, panel] of this.panels) {
      if (panel.isActive) {
        this.deactivatePanel(id);
      }
    }
    this.panels.clear();
  }
}

// Singleton instance
export const panelRegistry = new PanelRegistry();
