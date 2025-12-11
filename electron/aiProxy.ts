// AI API Proxy for Electron Main Process
// Handles AI API calls to avoid CORS issues in renderer
import { ipcMain } from 'electron';

interface AIProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface AIProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

// Register IPC handler for AI API calls
export function registerAIProxy(): void {
  ipcMain.handle('ai:proxy', async (_event, request: AIProxyRequest): Promise<AIProxyResponse> => {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response body as text
      const body = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body,
      };
    } catch (error) {
      console.error('[AIProxy] Error:', error);
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Error',
        headers: {},
        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      };
    }
  });

  // Handle streaming requests
  ipcMain.handle('ai:proxy:stream', async (event, request: AIProxyRequest): Promise<{ streamId: string }> => {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        event.sender.send(`ai:stream:error:${streamId}`, {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });
        return { streamId };
      }

      if (!response.body) {
        event.sender.send(`ai:stream:end:${streamId}`);
        return { streamId };
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const readChunk = async () => {
        try {
          const { done, value } = await reader.read();

          if (done) {
            event.sender.send(`ai:stream:end:${streamId}`);
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          event.sender.send(`ai:stream:chunk:${streamId}`, chunk);

          // Continue reading
          await readChunk();
        } catch (error) {
          event.sender.send(`ai:stream:error:${streamId}`, {
            status: 500,
            statusText: 'Stream Error',
            body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
          });
        }
      };

      // Start reading in background
      readChunk();
    } catch (error) {
      event.sender.send(`ai:stream:error:${streamId}`, {
        status: 500,
        statusText: 'Fetch Error',
        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      });
    }

    return { streamId };
  });

  console.log('[AIProxy] Registered');
}


