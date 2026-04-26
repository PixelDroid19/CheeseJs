export type EventMap = object;

export type EventHandler<TPayload> = (payload: TPayload) => void;

export interface TypedEventBus<TEvents extends EventMap> {
  emit<TKey extends keyof TEvents>(
    type: TKey,
    ...args: undefined extends TEvents[TKey]
      ? [payload?: TEvents[TKey]]
      : [payload: TEvents[TKey]]
  ): void;
  subscribe<TKey extends keyof TEvents>(
    type: TKey,
    handler: EventHandler<TEvents[TKey]>
  ): () => void;
  clear(): void;
}

/**
 * Creates a small typed event bus used to decouple app packages.
 */
export function createEventBus<
  TEvents extends EventMap,
>(): TypedEventBus<TEvents> {
  const listeners = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  return {
    emit(type, ...args) {
      const payload =
        args.length === 0 ? undefined : (args[0] as TEvents[typeof type]);
      const handlers = listeners.get(type);

      if (!handlers) {
        return;
      }

      handlers.forEach((handler) => {
        handler(payload as unknown);
      });
    },

    subscribe(type, handler) {
      const typedHandler = handler as EventHandler<unknown>;
      const handlers = listeners.get(type) ?? new Set<EventHandler<unknown>>();
      handlers.add(typedHandler);
      listeners.set(type, handlers);

      return () => {
        const currentHandlers = listeners.get(type);
        if (!currentHandlers) {
          return;
        }

        currentHandlers.delete(typedHandler);

        if (currentHandlers.size === 0) {
          listeners.delete(type);
        }
      };
    },

    clear() {
      listeners.clear();
    },
  };
}
