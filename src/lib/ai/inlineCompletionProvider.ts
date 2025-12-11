// Monaco Inline Completion Provider using AI SDK 6
// https://ai-sdk.dev/docs/ai-sdk-core
import type * as Monaco from 'monaco-editor';
import { aiService } from './aiService';
import { useAISettingsStore } from '../../store/useAISettingsStore';
import type { PromptContext } from './prompts';

// Simple in-memory cache for completions - OPTIMIZED for low memory
interface CacheEntry {
  completion: string;
  timestamp: number;
}

const completionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 15000; // 15 seconds (reduced from 30)
const MAX_CACHE_SIZE = 20; // Reduced from 50

function getCacheKey(prefix: string, suffix: string): string {
  return `${prefix.slice(-100)}|${suffix.slice(0, 50)}`;
}

function getFromCache(key: string): string | null {
  const entry = completionCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.completion;
  }
  completionCache.delete(key);
  return null;
}

function setToCache(key: string, completion: string): void {
  if (completionCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = completionCache.keys().next().value;
    if (oldestKey) {
      completionCache.delete(oldestKey);
    }
  }
  completionCache.set(key, { completion, timestamp: Date.now() });
}

// Request management - prevent multiple simultaneous requests
let currentAbortController: AbortController | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastRequestId = 0;
let isRequestInProgress = false;

// Clean up AI completion response - more aggressive cleaning
function cleanCompletionResponse(
  completion: string,
  textBeforeCursor: string
): string {
  let cleaned = completion;

  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```[\w]*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```$/gm, '');
  cleaned = cleaned.replace(/```/g, '');
  
  // Remove leading/trailing quotes
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');
  
  // Remove common AI prefixes
  cleaned = cleaned.replace(/^(Output|Completion|Result|Answer|Code|Here|The|Response):\s*/i, '');
  cleaned = cleaned.replace(/^(Here's|Here is|The completion is|Completing).*?:\s*/i, '');
  
  // Trim whitespace but preserve leading space if it's part of the completion
  const hadLeadingSpace = cleaned.startsWith(' ') || cleaned.startsWith('\t');
  cleaned = cleaned.trim();
  
  if (!cleaned) return '';

  // Get current line being typed
  const lines = textBeforeCursor.split('\n');
  const currentLine = lines[lines.length - 1] || '';
  const currentLineTrimmed = currentLine.trim();

  // If the model repeated the current line, remove it
  if (cleaned.startsWith(currentLine) && currentLine.length > 0) {
    cleaned = cleaned.slice(currentLine.length);
  }
  
  // If the model repeated the trimmed current line, find and remove it
  if (currentLineTrimmed.length > 3 && cleaned.startsWith(currentLineTrimmed)) {
    cleaned = cleaned.slice(currentLineTrimmed.length);
  }

  // Check for partial line repetition
  for (let i = Math.min(currentLine.length, 50); i > 3; i--) {
    const endOfLine = currentLine.slice(-i);
    if (cleaned.startsWith(endOfLine)) {
      cleaned = cleaned.slice(endOfLine.length);
      break;
    }
  }

  // Specific check: if typing "const x = " and model returns "function x(...", 
  // just return the function without the name if it matches
  const varDeclMatch = currentLine.match(/^(const|let|var)\s+(\w+)\s*=\s*$/);
  if (varDeclMatch) {
    const varName = varDeclMatch[2];
    // Remove "function varName" if model added it
    const funcPattern = new RegExp(`^function\\s+${varName}\\s*`);
    cleaned = cleaned.replace(funcPattern, '');
    // Also check for arrow function repetition
    const arrowPattern = new RegExp(`^${varName}\\s*=\\s*`);
    cleaned = cleaned.replace(arrowPattern, '');
  }

  // Remove any leading newlines (completion should continue on same line first)
  cleaned = cleaned.replace(/^\n+/, '');

  return cleaned;
}

export function createInlineCompletionProvider(
  monaco: typeof Monaco
): Monaco.languages.InlineCompletionsProvider {
  return {
    provideInlineCompletions: async (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
      _context: Monaco.languages.InlineCompletionContext,
      token: Monaco.CancellationToken
    ): Promise<Monaco.languages.InlineCompletions | null> => {
      // Check if inline completion is enabled
      const settings = useAISettingsStore.getState();
      if (!settings.enableInlineCompletion) {
        return { items: [] };
      }

      // Check if AI service is configured
      const apiKey = settings.getCurrentApiKey();
      if (!apiKey) {
        return { items: [] };
      }

      // Cancel any previous request immediately
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      
      // Clear pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      // If a request is in progress, skip this one
      if (isRequestInProgress) {
        return { items: [] };
      }

      // Configure service if needed
      if (!aiService.isReady()) {
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
        } catch {
          return { items: [] };
        }
      }

      // Get context around cursor
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: Math.max(1, position.lineNumber - 20),
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const textAfterCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 3),
        endColumn: model.getLineMaxColumn(
          Math.min(model.getLineCount(), position.lineNumber + 3)
        ),
      });

      // Skip if not enough context
      const trimmedBefore = textBeforeCursor.trim();
      if (trimmedBefore.length < 8) {
        return { items: [] };
      }

      // Skip if we're in a comment
      const currentLine = model.getLineContent(position.lineNumber);
      const beforeCursorOnLine = currentLine.substring(0, position.column - 1);
      if (beforeCursorOnLine.includes('//') || beforeCursorOnLine.includes('/*')) {
        return { items: [] };
      }

      // Check cache first
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
            },
          ],
        };
      }

      const currentRequestId = ++lastRequestId;

      return new Promise((resolve) => {
        // Debounce with longer delay to wait for user pause
        debounceTimer = setTimeout(async () => {
          // Double-check cancellation
          if (token.isCancellationRequested || currentRequestId !== lastRequestId) {
            resolve({ items: [] });
            return;
          }

          // Prevent concurrent requests
          if (isRequestInProgress) {
            resolve({ items: [] });
            return;
          }

          isRequestInProgress = true;
          currentAbortController = new AbortController();

          try {
            const language = model.getLanguageId();
            const context: PromptContext = {
              language,
              codeBefore: textBeforeCursor,
              codeAfter: textAfterCursor,
            };

            const completion = await aiService.generateInlineCompletion(context, 100);

            // Check if cancelled or superseded
            if (token.isCancellationRequested || currentRequestId !== lastRequestId) {
              resolve({ items: [] });
              return;
            }

            if (!completion || completion.trim().length === 0) {
              resolve({ items: [] });
              return;
            }

            // Clean up the completion
            const cleanCompletion = cleanCompletionResponse(completion, textBeforeCursor);

            // Don't suggest if empty after cleaning
            if (!cleanCompletion || cleanCompletion.length === 0) {
              resolve({ items: [] });
              return;
            }

            // Don't suggest if it's just repeating what's already there
            if (textAfterCursor.trim().startsWith(cleanCompletion.trim())) {
              resolve({ items: [] });
              return;
            }

            // Cache the result
            setToCache(cacheKey, cleanCompletion);

            resolve({
              items: [
                {
                  insertText: cleanCompletion,
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column
                  ),
                },
              ],
            });
          } catch (error) {
            // Don't log aborted requests
            if (error instanceof Error && error.name !== 'AbortError') {
              console.error('[InlineCompletion] Error:', error);
            }
            resolve({ items: [] });
          } finally {
            isRequestInProgress = false;
            currentAbortController = null;
          }
        }, 800); // 800ms debounce - wait for user to stop typing
      });
    },

    // Monaco requires this method to clean up completions
    freeInlineCompletions: (_completions: Monaco.languages.InlineCompletions) => {
      // Cancel any pending request when completions are freed
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },

    // Some Monaco versions call this instead of freeInlineCompletions
    disposeInlineCompletions: (_completions: Monaco.languages.InlineCompletions) => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}

// Clear cache utility
export function clearInlineCompletionCache(): void {
  completionCache.clear();
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  isRequestInProgress = false;
}
