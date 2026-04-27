import { AbstractMessageWriter, Message } from 'vscode-jsonrpc';
import type { LspBridgeApi } from '@cheesejs/core';

export class IpcMessageWriter extends AbstractMessageWriter {
  private errorCount = 0;

  constructor(
    private readonly langId: string,
    private readonly lspBridge: Pick<LspBridgeApi, 'sendMessage' | 'stop'>
  ) {
    super();
  }

  public end(): void {
    this.lspBridge.stop(this.langId);
  }

  public write(msg: Message): Promise<void> {
    try {
      const content = JSON.stringify(msg);
      const byteLength = new TextEncoder().encode(content).length;
      const headers = `Content-Length: ${byteLength}\r\n\r\n`;
      this.lspBridge.sendMessage(this.langId, headers + content);
      return Promise.resolve();
    } catch (error) {
      this.errorCount++;
      this.fireError(error as Error, msg, this.errorCount);
      return Promise.reject(error);
    }
  }
}
