/**
 * Token Counter Service
 *
 * Provides token counting/estimation for text content.
 * Uses a simple heuristic (~4 characters per token) which is
 * accurate enough for context window management.
 *
 * For more accurate counting, this could be extended to use
 * the actual tokenizer from the embedding model.
 */

class TokenCounter {
  private static instance: TokenCounter;

  // Average characters per token for English text
  // This is a reasonable approximation for most LLM tokenizers
  private readonly CHARS_PER_TOKEN = 4;

  private constructor() {}

  public static getInstance(): TokenCounter {
    if (!TokenCounter.instance) {
      TokenCounter.instance = new TokenCounter();
    }
    return TokenCounter.instance;
  }

  /**
   * Estimate token count using character-based heuristic
   * Fast and suitable for context window decisions
   */
  public estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Estimate tokens for multiple texts
   */
  public estimateTokensMultiple(texts: string[]): number {
    return texts.reduce((sum, text) => sum + this.estimateTokens(text), 0);
  }

  /**
   * Check if content fits within a token budget
   */
  public fitsWithinBudget(text: string, maxTokens: number): boolean {
    return this.estimateTokens(text) <= maxTokens;
  }

  /**
   * Calculate how much of the budget content would use
   * Returns a value between 0 and 1+
   */
  public budgetUsage(text: string, maxTokens: number): number {
    if (maxTokens <= 0) return Infinity;
    return this.estimateTokens(text) / maxTokens;
  }

  /**
   * Truncate text to fit within token budget
   * Returns the truncated text
   */
  public truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;

    // Find last space before max to avoid cutting words
    const truncated = text.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxChars * 0.8) {
      return truncated.slice(0, lastSpace) + '...';
    }
    return truncated + '...';
  }
}

export const tokenCounter = TokenCounter.getInstance();
