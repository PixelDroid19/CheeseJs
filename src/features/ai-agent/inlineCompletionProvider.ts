// Monaco Inline Completion Provider - Copilot-style ghost text
// Uses Monaco 0.55+ InlineCompletionsProvider API correctly
import type * as Monaco from 'monaco-editor';
import { aiService } from './aiService';
import { useAISettingsStore } from '../../store/useAISettingsStore';
import type { PromptContext } from './prompts';
import {
  AI_COMPLETION_DEBOUNCE_MS,
  AI_COMPLETION_MAX_CACHE_SIZE,
  AI_COMPLETION_CACHE_TTL_MS,
} from '../../constants';

// ---------------------------------------------------------------------------
// Cache - LRU by timestamp with size cap
// ---------------------------------------------------------------------------
interface CacheEntry {
  completion: string;
  timestamp: number;
}

const completionCache = new Map<string, CacheEntry>();
const CACHE_TTL = AI_COMPLETION_CACHE_TTL_MS;
const MAX_CACHE_SIZE = AI_COMPLETION_MAX_CACHE_SIZE;

function getCacheKey(prefix: string, suffix: string): string {
  // Use last 150 chars of prefix + first 80 of suffix as fingerprint
  return `${prefix.slice(-150)}|||${suffix.slice(0, 80)}`;
}

function getFromCache(key: string): string | null {
  const entry = completionCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.completion;
  }
  if (entry) completionCache.delete(key);
  return null;
}

function setToCache(key: string, completion: string): void {
  // Evict oldest entries if at capacity
  if (completionCache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [k, v] of completionCache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) completionCache.delete(oldestKey);
  }
  completionCache.set(key, { completion, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Request lifecycle - one in-flight request at a time
// ---------------------------------------------------------------------------
let currentAbortController: AbortController | null = null;

function cancelInflight(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

// ---------------------------------------------------------------------------
// Response cleaning - minimal & safe
// ---------------------------------------------------------------------------
export function cleanCompletionResponse(
  raw: string,
  textBeforeCursor: string
): string {
  let cleaned = raw;

  // 1. Strip markdown fences that some models wrap around output
  cleaned = cleaned.replace(/^```[\w]*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```$/gm, '');
  cleaned = cleaned.replace(/```/g, '');

  // 2. Strip common chatty prefixes the model may add
  cleaned = cleaned.replace(
    /^(Here('s| is).*?:|Output:|Completion:|Result:|Answer:|Code:|Response:)\s*/i,
    ''
  );

  // 3. Trim but preserve intentional leading whitespace on first line
  // (e.g. completing after `if (x) ` should keep the space)
  cleaned = cleaned.replace(/^\n+/, ''); // remove leading blank lines
  cleaned = cleaned.replace(/\s+$/, ''); // trim trailing whitespace

  if (!cleaned) return '';

  // 4. Remove duplication of what the user already typed on the current line
  const lines = textBeforeCursor.split('\n');
  const currentLine = lines[lines.length - 1] || '';

  // Find the longest suffix of currentLine that is a prefix of the completion
  // and strip it to avoid duplication (e.g. user typed "cons" and model returns "const x = 1")
  if (currentLine.length > 0) {
    const maxOverlap = Math.min(currentLine.length, cleaned.length);
    let overlap = 0;
    for (let len = maxOverlap; len > 0; len--) {
      const suffix = currentLine.slice(-len);
      if (cleaned.startsWith(suffix)) {
        overlap = len;
        break;
      }
    }
    if (overlap > 0) {
      cleaned = cleaned.slice(overlap);
    }
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Ensure AI service is configured before making requests
// ---------------------------------------------------------------------------
function ensureServiceReady(): boolean {
  if (aiService.isReady()) return true;

  const settings = useAISettingsStore.getState();
  const apiKey = settings.getCurrentApiKey();
  if (!apiKey) return false;

  try {
    if (settings.provider === 'local') {
      const localCfg = settings.getLocalConfig();
      aiService.configure(settings.provider, '', '', {
        baseURL: localCfg.baseURL,
        modelId: localCfg.modelId,
      });
    } else {
      const customCfg = settings.getCustomConfig();
      aiService.configure(
        settings.provider,
        apiKey,
        settings.getCurrentModel(),
        undefined,
        customCfg
      );
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------
export function createInlineCompletionProvider(
  monaco: typeof Monaco
): Monaco.languages.InlineCompletionsProvider {
  return {
    // Monaco 0.55 debounces calls for us - no manual setTimeout needed
    debounceDelayMs: AI_COMPLETION_DEBOUNCE_MS,

    provideInlineCompletions: async (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _context: Monaco.languages.InlineCompletionContext,
      token: Monaco.CancellationToken
    ): Promise<Monaco.languages.InlineCompletions | null> => {
      // ---- Guard: feature enabled? ----
      const settings = useAISettingsStore.getState();
      if (!settings.enableInlineCompletion) return null;
      if (!settings.getCurrentApiKey()) return null;

      // ---- Cancel previous in-flight request ----
      cancelInflight();

      if (token.isCancellationRequested) return null;

      // ---- Gather context around cursor ----
      const lineCount = model.getLineCount();
      const contextLinesBefore = 50;
      const contextLinesAfter = 10;

      const prefixStartLine = Math.max(
        1,
        position.lineNumber - contextLinesBefore
      );
      const suffixEndLine = Math.min(
        lineCount,
        position.lineNumber + contextLinesAfter
      );

      const textBeforeCursor = model.getValueInRange({
        startLineNumber: prefixStartLine,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const textAfterCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: suffixEndLine,
        endColumn: model.getLineMaxColumn(suffixEndLine),
      });

      // ---- Skip if not enough context to be useful ----
      if (textBeforeCursor.trim().length < 5) return null;

      // ---- Skip if cursor is at start of empty line with no prior code ----
      const currentLineText = model.getLineContent(position.lineNumber);
      const textBeforeOnLine = currentLineText.substring(
        0,
        position.column - 1
      );
      // If the line is empty and there is nothing meaningful before, skip
      if (
        textBeforeOnLine.trim() === '' &&
        textBeforeCursor.trim().length < 10
      ) {
        return null;
      }

      // ---- Cache lookup ----
      const cacheKey = getCacheKey(textBeforeCursor, textAfterCursor);
      const cached = getFromCache(cacheKey);
      if (cached) {
        return {
          items: [
            {
              insertText: cached,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              completeBracketPairs: true,
            },
          ],
          enableForwardStability: true,
        };
      }

      // ---- Ensure AI service is ready ----
      if (!ensureServiceReady()) return null;

      // ---- Abort controller for this request ----
      const abortController = new AbortController();
      currentAbortController = abortController;

      // Wire up Monaco cancellation token to our abort controller
      const onCancel = token.onCancellationRequested(() => {
        abortController.abort();
      });

      try {
        if (token.isCancellationRequested) return null;

        const language = model.getLanguageId();
        const context: PromptContext = {
          language,
          codeBefore: textBeforeCursor,
          codeAfter: textAfterCursor,
        };

        const rawCompletion = await aiService.generateInlineCompletion(
          context,
          150 // enough for multi-line but not excessive
        );

        // Check cancellation after await
        if (token.isCancellationRequested || abortController.signal.aborted) {
          return null;
        }

        if (!rawCompletion || rawCompletion.trim().length === 0) {
          return null;
        }

        // Clean the response
        const completion = cleanCompletionResponse(
          rawCompletion,
          textBeforeCursor
        );

        if (!completion || completion.length === 0) return null;

        // Don't suggest if the text after cursor already matches
        const afterTrimmed = textAfterCursor.trim();
        if (
          afterTrimmed.length > 0 &&
          afterTrimmed.startsWith(completion.trim())
        ) {
          return null;
        }

        // Cache for reuse
        setToCache(cacheKey, completion);

        return {
          items: [
            {
              insertText: completion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              completeBracketPairs: true,
            },
          ],
          enableForwardStability: true,
        };
      } catch (error: unknown) {
        // Silently ignore aborted requests
        if (error instanceof Error && error.name === 'AbortError') return null;
        // Don't spam console for routine network issues
        console.warn('[InlineCompletion] Request failed:', error);
        return null;
      } finally {
        // Only clear if this controller is still the current one
        if (currentAbortController === abortController) {
          currentAbortController = null;
        }
        onCancel.dispose();
      }
    },

    // Required by Monaco 0.55 - called when completions are no longer needed
    disposeInlineCompletions(
      _completions: Monaco.languages.InlineCompletions,
      _reason: Monaco.languages.InlineCompletionsDisposeReason
    ): void {
      // Nothing to dispose per-completions; abort is handled per-request
    },
  };
}

// ---------------------------------------------------------------------------
// Public utilities
// ---------------------------------------------------------------------------
export function clearInlineCompletionCache(): void {
  completionCache.clear();
  cancelInflight();
}
