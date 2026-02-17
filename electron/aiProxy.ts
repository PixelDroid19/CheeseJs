/**
 * AI API Proxy for Electron Main Process (SECURITY HARDENED)
 *
 * Handles AI API calls to avoid CORS issues in renderer.
 * SECURITY: Only whitelisted domains are allowed to prevent SSRF attacks.
 */
import { ipcMain } from 'electron';

// Whitelist of allowed AI API domains
const ALLOWED_DOMAINS = new Set([
  // OpenAI
  'api.openai.com',
  'challenges.cloudflare.com', // For Turnstile verification

  // Anthropic
  'api.anthropic.com',

  // Google AI
  'generativelanguage.googleapis.com',
  'aiplatform.googleapis.com',

  // Other common AI providers
  'api.together.xyz',
  'api.deepseek.com',
  'api.mistral.ai',
  'api.perplexity.ai',
  'api.cohere.ai',

  // Local development (only in development mode)
  ...(process.env.NODE_ENV === 'development' ? ['localhost', '127.0.0.1'] : []),
]);

// Blocked private IP ranges to prevent SSRF
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
  /^0\.0\.0\.0/, // All interfaces
  /^::1$/, // IPv6 loopback
  /^fe80:/, // IPv6 link-local
  /^fc00:/, // IPv6 private
  /^fd00:/, // IPv6 private
];

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

const activeStreams = new Map<string, AbortController>();

function isAllowedUrl(urlString: string): {
  allowed: boolean;
  reason?: string;
} {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS (except localhost in development)
    if (url.protocol !== 'https:') {
      if (
        process.env.NODE_ENV === 'development' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      ) {
        // Allow HTTP for local development
      } else {
        return { allowed: false, reason: 'Only HTTPS URLs are allowed' };
      }
    }

    // Check if domain is whitelisted
    if (!ALLOWED_DOMAINS.has(url.hostname)) {
      return {
        allowed: false,
        reason: `Domain '${url.hostname}' is not in the allowed list. Allowed domains: ${Array.from(ALLOWED_DOMAINS).join(', ')}`,
      };
    }

    // Check for private IP patterns (SSRF protection)
    const hostname = url.hostname;
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        // Allow if it's whitelisted (like localhost in dev)
        if (!ALLOWED_DOMAINS.has(hostname)) {
          return {
            allowed: false,
            reason: 'Access to private IP addresses is not allowed',
          };
        }
      }
    }

    return { allowed: true };
  } catch (_error) {
    return { allowed: false, reason: 'Invalid URL format' };
  }
}

export function registerAIProxy(): void {
  // Regular (non-streaming) proxy
  ipcMain.handle(
    'ai:proxy',
    async (_event, request: AIProxyRequest): Promise<AIProxyResponse> => {
      // Validate URL
      const validation = isAllowedUrl(request.url);
      if (!validation.allowed) {
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          body: JSON.stringify({
            error: `Security: ${validation.reason}`,
          }),
        };
      }

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

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
          body: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        };
      }
    }
  );

  // Streaming proxy
  ipcMain.handle(
    'ai:proxy:stream',
    async (
      event,
      request: AIProxyRequest
    ): Promise<{ streamId: string } | { error: string }> => {
      // Validate URL
      const validation = isAllowedUrl(request.url);
      if (!validation.allowed) {
        event.sender.send('ai:stream:error:security', {
          error: `Security: ${validation.reason}`,
        });
        return { error: validation.reason || 'URL not allowed' };
      }

      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const abortController = new AbortController();
      activeStreams.set(streamId, abortController);

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          event.sender.send(`ai:stream:error:${streamId}`, {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
          });
          activeStreams.delete(streamId);
          return { streamId };
        }

        if (!response.body) {
          event.sender.send(`ai:stream:end:${streamId}`);
          activeStreams.delete(streamId);
          return { streamId };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const readChunk = async () => {
          try {
            const { done, value } = await reader.read();

            if (done) {
              event.sender.send(`ai:stream:end:${streamId}`);
              activeStreams.delete(streamId);
              return;
            }

            const chunk = decoder.decode(value, { stream: true });
            event.sender.send(`ai:stream:chunk:${streamId}`, chunk);

            await readChunk();
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              event.sender.send(`ai:stream:end:${streamId}`);
            } else {
              event.sender.send(`ai:stream:error:${streamId}`, {
                status: 500,
                statusText: 'Stream Error',
                body: JSON.stringify({
                  error:
                    error instanceof Error ? error.message : 'Unknown error',
                }),
              });
            }
            activeStreams.delete(streamId);
          }
        };

        readChunk();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          event.sender.send(`ai:stream:end:${streamId}`);
        } else {
          event.sender.send(`ai:stream:error:${streamId}`, {
            status: 500,
            statusText: 'Fetch Error',
            body: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          });
        }
        activeStreams.delete(streamId);
      }

      return { streamId };
    }
  );

  // Handle stream abort
  ipcMain.on('ai:proxy:stream:abort', (_event, streamId: string) => {
    const controller = activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      activeStreams.delete(streamId);
    }
  });

  console.log(
    '[AIProxy] Registered with domain whitelist (SSRF protection enabled)'
  );
}

export function addAllowedDomain(domain: string): void {
  ALLOWED_DOMAINS.add(domain);
}

export function removeAllowedDomain(domain: string): void {
  ALLOWED_DOMAINS.delete(domain);
}

export function getAllowedDomains(): string[] {
  return Array.from(ALLOWED_DOMAINS);
}
