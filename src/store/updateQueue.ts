/**
 * Limitador de ráfagas para actualizaciones asincrónicas en la UI de React/Electron.
 * Especial para Text Streaming super rápido donde iterar renderizados puede colgar la app.
 */

type Updater<T> = T | ((prev: T) => T);

export class UpdateQueue<T> {
  private queue: Array<Updater<T>> = [];
  private isProcessing = false;
  private readonly delayMs: number;
  private readonly getLatestState: () => Promise<T | null>;
  private readonly persistState: (state: T) => Promise<void>;

  constructor(
    getLatestState: () => Promise<T | null>,
    persistState: (state: T) => Promise<void>,
    delayMs = 150 // 150ms delay for throttling intensive UI operations
  ) {
    this.getLatestState = getLatestState;
    this.persistState = persistState;
    this.delayMs = delayMs;
  }

  public set(updater: Updater<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(updater);
      this.processQueue().then(resolve).catch(reject);
    });
  }

  private async processQueue(): Promise<T> {
    if (this.isProcessing) {
      return this.getLatestState() as Promise<T>;
    }
    this.isProcessing = true;

    try {
      let state = (await this.getLatestState()) as T | null;

      // Batch all currently pending updates
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.queue.length);
        for (const updater of batch) {
          if (state !== null) {
            state = (typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater) as T;
          } else {
            // Initial state population
            state = (typeof updater === 'function' ? (updater as (prev: T) => T)(null as unknown as T) : updater) as T;
          }
        }
      }

      if (state !== null) {
        await this.persistState(state);
      }

      if (this.delayMs > 0) {
        await new Promise((r) => setTimeout(r, this.delayMs));
      }

      return state as T;
    } finally {
      this.isProcessing = false;

      // If new items were pushed while processing or waiting
      if (this.queue.length > 0) {
         
        this.processQueue();
      }
    }
  }
}
