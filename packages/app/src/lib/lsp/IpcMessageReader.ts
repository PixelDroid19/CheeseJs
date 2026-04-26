import {
  AbstractMessageReader,
  DataCallback,
  type Disposable,
} from 'vscode-jsonrpc';

export class IpcMessageReader extends AbstractMessageReader {
  private state: 'initial' | 'listening' | 'closed' = 'initial';
  private callback: DataCallback | null = null;
  private disposeListener: (() => void) | null = null;
  private buffer: string = '';

  constructor(private langId: string) {
    super();
  }

  public listen(callback: DataCallback): Disposable {
    if (this.state === 'initial' || this.state === 'listening') {
      this.state = 'listening';
      this.callback = callback;

      this.disposeListener = window.lspBridge.onMessage((msg) => {
        if (msg.langId === this.langId) {
          this.buffer += msg.data;
          this.processBuffer();
        }
      });

      return {
        dispose: () => {
          this.state = 'closed';
          this.callback = null;
          if (this.disposeListener) {
            this.disposeListener();
            this.disposeListener = null;
          }
        },
      };
    }
    throw new Error('Reader is closed');
  }

  private processBuffer() {
    while (true) {
      const match = this.buffer.match(/Content-Length:\s*(\d+)\s*\r\n\r\n/);
      if (!match) {
        break; // Not enough data for headers
      }

      const headerLength = match[0].length;
      const contentLength = parseInt(match[1], 10);

      if (this.buffer.length >= headerLength + contentLength) {
        const messageString = this.buffer.slice(
          headerLength,
          headerLength + contentLength
        );
        this.buffer = this.buffer.slice(headerLength + contentLength);

        try {
          const message = JSON.parse(messageString);
          this.callback?.(message);
        } catch (err) {
          this.fireError(err as Error);
        }
      } else {
        break; // Not enough data for body
      }
    }
  }
}
