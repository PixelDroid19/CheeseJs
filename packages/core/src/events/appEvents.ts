import { createEventBus, type TypedEventBus } from './eventBus';

export interface CheeseJsAppEvents {
  'editor.format.requested': undefined;
  'packages.bootstrap.requested': undefined;
  'settings.magic-comments.toggle.requested': undefined;
  'workbench.run.requested': { code?: string } | undefined;
  'workbench.settings.toggle.requested': undefined;
}

export type CheeseJsEventBus = TypedEventBus<CheeseJsAppEvents>;

/**
 * Creates the shared application event bus for renderer-side coordination.
 */
export function createCheeseJsEventBus(): CheeseJsEventBus {
  return createEventBus<CheeseJsAppEvents>();
}
