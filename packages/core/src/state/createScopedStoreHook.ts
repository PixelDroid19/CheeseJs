import type { StoreApi } from 'zustand';

export type StoreHook<TState> = {
  (): TState;
  <T>(selector: (state: TState) => T): T;
  getState: () => TState;
  setState: (
    partial: Partial<TState> | ((state: TState) => Partial<TState> | TState),
    replace?: boolean
  ) => void;
  subscribe: (
    listener: (state: TState, prevState: TState) => void
  ) => () => void;
};

interface RootStoreLike<TRootState> {
  <T>(selector: (state: TRootState) => T): T;
  getState: () => TRootState;
  setState: StoreApi<TRootState>['setState'];
  subscribe: <T>(
    selector: (state: TRootState) => T,
    listener: (state: T, prevState: T) => void
  ) => () => void;
}

/**
 * Creates a Zustand-compatible hook scoped to a nested root-store slice.
 */
export function createScopedStoreHook<TRootState extends object, TSlice>(
  getRootStore: () => RootStoreLike<TRootState>,
  sliceKey: keyof TRootState
): StoreHook<TSlice> {
  const hook = (<T>(selector?: (state: TSlice) => T) => {
    const useRootStore = getRootStore();
    return useRootStore((state) => {
      const slice = state[sliceKey] as TSlice;
      return selector ? selector(slice) : (slice as unknown as T);
    });
  }) as StoreHook<TSlice>;

  hook.getState = () => getRootStore().getState()[sliceKey] as TSlice;
  hook.setState = (partial, replace) => {
    const useRootStore = getRootStore();
    useRootStore.setState((state: TRootState) => {
      const currentSlice = state[sliceKey] as TSlice;
      const nextSlice =
        typeof partial === 'function'
          ? (partial as (sliceState: TSlice) => Partial<TSlice> | TSlice)(
              currentSlice
            )
          : partial;

      return {
        ...state,
        [sliceKey]: replace
          ? nextSlice
          : {
              ...(state[sliceKey] as object),
              ...(nextSlice as object),
            },
      } as TRootState | Partial<TRootState>;
    });
  };
  hook.subscribe = (listener) =>
    getRootStore().subscribe((state) => state[sliceKey] as TSlice, listener);

  return hook;
}
