import {
  createEventBus,
  type EventMap,
  type TypedEventBus,
} from '../events/eventBus';
import {
  createExtensionRegistry,
  type ExtensionRegistry,
  type ExtensionRegistrySnapshot,
} from '../extensions/extensionRegistry';

export interface CoreRuntimeSnapshot {
  extensions: ExtensionRegistrySnapshot['extensions'];
}

/**
 * Minimal CheeseJS core runtime surface.
 *
 * The core runtime owns only cross-cutting primitives: extension metadata and
 * typed events. Feature implementations, editor UI, state, languages, package
 * management, and future assistant behavior attach from packages instead of
 * living inside `@cheesejs/core`.
 */
export interface CoreRuntime<TEvents extends EventMap = EventMap> {
  extensions: ExtensionRegistry;
  events: TypedEventBus<TEvents>;
  snapshot: () => CoreRuntimeSnapshot;
}

/**
 * Create an isolated core runtime instance.
 *
 * Use one instance per app host or test harness. Keeping this factory explicit
 * avoids hidden globals and makes future extension loading easier to reason
 * about.
 */
export function createCoreRuntime<
  TEvents extends EventMap = EventMap,
>(): CoreRuntime<TEvents> {
  const extensions = createExtensionRegistry();
  const events = createEventBus<TEvents>();

  return {
    extensions,
    events,
    snapshot: () => ({
      extensions: extensions.snapshot().extensions,
    }),
  };
}
