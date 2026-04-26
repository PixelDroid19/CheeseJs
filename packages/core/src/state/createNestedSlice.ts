import type { StateCreator } from 'zustand';

type RootSet<TState> = (
  partial:
    | TState
    | Partial<TState>
    | ((state: TState) => TState | Partial<TState>),
  replace?: boolean
) => void;

/**
 * Adapts a flat Zustand store so slices can keep their own local state shape.
 */
export function createNestedSlice<TState extends object, TSlice extends object>(
  set: RootSet<TState>,
  get: () => TState,
  sliceKey: keyof TState,
  sliceCreator: StateCreator<TSlice, [], []>
): TSlice {
  const nestedSet = (
    partial:
      | TSlice
      | Partial<TSlice>
      | ((state: TSlice) => TSlice | Partial<TSlice>),
    replace?: boolean
  ) => {
    set((state: TState) => {
      const currentSlice = state[sliceKey] as unknown as TSlice;
      const nextSlice =
        typeof partial === 'function'
          ? (partial as (sliceState: TSlice) => TSlice | Partial<TSlice>)(
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
      } as TState | Partial<TState>;
    }, replace);
  };

  const nestedGet = () => get()[sliceKey] as unknown as TSlice;

  return sliceCreator(
    nestedSet as Parameters<typeof sliceCreator>[0],
    nestedGet as Parameters<typeof sliceCreator>[1],
    {} as Parameters<typeof sliceCreator>[2]
  );
}
