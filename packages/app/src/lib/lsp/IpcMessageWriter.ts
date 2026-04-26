import { AbstractMessageWriter, Message } from 'vscode-jsonrpc';

export class IpcMessageWriter extends AbstractMessageWriter {
  private errorCount: number = 0;

  constructor(private langId: string) {
    super();
  }

  public end(): void {
    window.lspBridge.stop(this.langId);
  }

  public write(msg: Message): Promise<void> {
    try {
      const content = JSON.stringify(msg);
      const byteLength = new TextEncoder().encode(content).length;
      const headers = `Content-Length: ${byteLength}\r\n\r\n`;
      window.lspBridge.sendMessage(this.langId, headers + content);
      return Promise.resolve();
    } catch (error) {
      this.errorCount++;
      this.fireError(error as Error, msg, this.errorCount);
      return Promise.reject(error);
    }
  }
}
