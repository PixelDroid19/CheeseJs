/**
 * Context Injection Strategy
 *
 * Decides whether to inject full document content or use retrieval
 * based on document size, available context budget, and configuration.
 */

import { RagConfig, StrategyDecision, RagDocument } from './types';
import { tokenCounter } from './tokenCounter';
import { ragConfigManager } from './ragConfig';

export class ContextStrategyService {
  private static instance: ContextStrategyService;

  private constructor() {}

  public static getInstance(): ContextStrategyService {
    if (!ContextStrategyService.instance) {
      ContextStrategyService.instance = new ContextStrategyService();
    }
    return ContextStrategyService.instance;
  }

  /**
   * Decide the best strategy for injecting document context
   *
   * @param documents - Documents to potentially inject
   * @param query - User's query (for context)
   * @param configOverride - Optional config override
   */
  public async chooseStrategy(
    documents: RagDocument[],
    _query: string, // Reserved for future query-aware strategy
    configOverride?: Partial<RagConfig>
  ): Promise<StrategyDecision> {
    const config = await ragConfigManager.getConfig();
    const effectiveConfig = { ...config, ...configOverride };

    // If strategy is fixed, return it
    if (effectiveConfig.injectionStrategy === 'always-retrieve') {
      return {
        strategy: 'retrieve',
        reason: 'Configuration set to always use retrieval',
      };
    }

    if (effectiveConfig.injectionStrategy === 'always-inject') {
      const totalTokens = this.calculateTotalTokens(documents);
      return {
        strategy: 'inject-full',
        reason: 'Configuration set to always inject full content',
        tokenCount: totalTokens,
        documentsToInject: documents.map((d) => d.id),
      };
    }

    // Auto strategy: decide based on content size
    return this.autoDecide(documents, effectiveConfig);
  }

  /**
   * Auto-decide based on token count and budget
   */
  private autoDecide(
    documents: RagDocument[],
    config: RagConfig
  ): StrategyDecision {
    if (documents.length === 0) {
      return {
        strategy: 'retrieve',
        reason: 'No documents provided',
        tokenCount: 0,
      };
    }

    const totalTokens = this.calculateTotalTokens(documents);
    const maxTokens = config.maxContextTokens;

    // Use 70% threshold like LM Studio reference
    const threshold = maxTokens * 0.7;

    console.log(
      `[ContextStrategy] Total tokens: ${totalTokens}, threshold: ${threshold}`
    );

    if (totalTokens <= threshold) {
      return {
        strategy: 'inject-full',
        reason: `Content fits within context budget (${totalTokens} tokens <= ${threshold} threshold)`,
        tokenCount: totalTokens,
        documentsToInject: documents.map((d) => d.id),
      };
    }

    // Try to find subset that fits
    const fittingDocs = this.selectDocumentsThatFit(documents, threshold);

    if (fittingDocs.length > 0 && fittingDocs.length === documents.length) {
      // All docs fit
      return {
        strategy: 'inject-full',
        reason: `All documents fit within context budget`,
        tokenCount: totalTokens,
        documentsToInject: fittingDocs.map((d) => d.id),
      };
    }

    // Content too large, use retrieval
    return {
      strategy: 'retrieve',
      reason: `Content exceeds context budget (${totalTokens} tokens > ${threshold} threshold). Using retrieval.`,
      tokenCount: totalTokens,
    };
  }

  /**
   * Calculate total tokens for all documents
   */
  private calculateTotalTokens(documents: RagDocument[]): number {
    return documents.reduce(
      (sum, doc) => sum + tokenCounter.estimateTokens(doc.content),
      0
    );
  }

  /**
   * Select documents that fit within the token budget
   * Prioritizes smaller documents first
   */
  private selectDocumentsThatFit(
    documents: RagDocument[],
    maxTokens: number
  ): RagDocument[] {
    // Sort by size (smallest first)
    const sorted = [...documents].sort(
      (a, b) => a.content.length - b.content.length
    );

    const selected: RagDocument[] = [];
    let usedTokens = 0;

    for (const doc of sorted) {
      const docTokens = tokenCounter.estimateTokens(doc.content);
      if (usedTokens + docTokens <= maxTokens) {
        selected.push(doc);
        usedTokens += docTokens;
      }
    }

    return selected;
  }

  /**
   * Get strategy recommendation message for UI
   */
  public getRecommendationMessage(decision: StrategyDecision): string {
    if (decision.strategy === 'inject-full') {
      return `✓ Full content injection (${decision.tokenCount} tokens)`;
    }
    return `⚡ Using retrieval search (content too large: ${decision.tokenCount} tokens)`;
  }
}

export const contextStrategyService = ContextStrategyService.getInstance();
