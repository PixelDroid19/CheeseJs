import { app, ipcMain } from 'electron';
import path from 'node:path';
import { ingestService } from './ingest';
import { vectorStore } from './store';
import { embeddingsService } from './embeddings';
import { scanDirectory } from './scanner';
import {
  RagDocument,
  RegisteredDocument,
  SearchOptions,
  RagConfig,
  PipelineOptions,
  PipelineResult,
} from './types';
import { documentRegistry } from './registry';
import { ragConfigManager } from './ragConfig';
import { tokenCounter } from './tokenCounter';
import { rewriteQuery } from './queryRewriter';
import { rerank } from './reranker';
import { distillContext } from './contextDistiller';
import { autoTrim } from './autoTrimmer';
import { v4 as uuidv4 } from 'uuid';

export function setupRagHandlers() {
  console.log('Setting up RAG IPC handlers');

  ipcMain.handle('rag:ingest', async (_, doc: RagDocument) => {
    try {
      console.log('Received ingestion request for:', doc.id);
      const count = await ingestService.ingestDocument(doc);
      return { success: true, count };
    } catch (error) {
      console.error('RAG Ingest Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('rag:search', async (_, query: string, limit: number = 5) => {
    try {
      console.log('Received search request:', query);
      const config = await ragConfigManager.getConfig();
      const queryEmbedding = await embeddingsService.generateEmbedding(query);
      const results = await vectorStore.searchWithThreshold(
        queryEmbedding,
        limit,
        config.retrievalThreshold
      );
      return { success: true, results };
    } catch (error) {
      console.error('RAG Search Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('rag:clear', async () => {
    try {
      await vectorStore.clear();
      // Also clear registry? Or just status?
      // Let's assume clear wipes everything.
      // But we might want to keep the list of added files but reset status.
      // For now, let's just clear DB.
      return { success: true };
    } catch (error) {
      console.error('RAG Clear Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('rag:index-codebase', async (event) => {
    const docId = 'codebase-root';
    try {
      let rootDir = process.cwd();
      if (app.isPackaged) {
        rootDir = path.join(process.resourcesPath, 'app');
      }

      // Register or update document
      const doc: RegisteredDocument = {
        id: docId,
        title: 'Project Codebase',
        type: 'file', // Special type? or just file
        pathOrUrl: rootDir,
        addedAt: Date.now(),
        status: 'processing',
        chunkCount: 0,
        metadata: { isCodebase: true },
      };

      // Remove existing document from registry and delete existing chunks
      // to prevent duplicates on re-indexing
      try {
        await documentRegistry.removeDocument(docId);
      } catch (_error) {
        // Document doesn't exist yet, which is fine
      }
      try {
        await vectorStore.deleteDocument(docId);
      } catch (_error) {
        // No existing chunks to delete, which is fine
      }
      await documentRegistry.addDocument(doc);

      event.sender.send('rag:progress', {
        id: docId,
        status: 'processing',
        message: 'Scanning directory...',
      });

      console.log('Indexing codebase from:', rootDir);
      const docs = await scanDirectory(rootDir);
      console.log(`Found ${docs.length} documents to ingest`);

      event.sender.send('rag:progress', {
        id: docId,
        status: 'processing',
        message: `Found ${docs.length} files. Ingesting...`,
      });

      let totalChunks = 0;
      let processed = 0;
      for (const d of docs) {
        // We could ingest each document separately but associate them with the codebase doc ID?
        // No, the chunks will have their own source metadata.
        // But we want to track total chunks for the "Project Codebase" document.
        // We can assign the chunks to the 'codebase-root' document ID?
        // No, each file is a document.
        // The "Project Codebase" is a *collection*.
        // But for the UI list, we want one entry "Project Codebase".
        // If we ingest with `d.id` (which is file path or uuid), the vector store has chunks for THAT file.
        // The UI document list shows `RegisteredDocument`s.
        // If we want to show ONE entry "Codebase", we track it as one RegisteredDocument.
        // But the vector store chunks will have different `documentId`s (the file paths).
        // This mismatch means `deleteDocument('codebase-root')` won't delete the chunks if they are stored with file IDs.
        // OPTION: Store all chunks with `documentId = 'codebase-root'` and use metadata for file path.
        // This allows easy deletion of the whole codebase index.
        // Let's do that.

        const chunks = await ingestService.ingestDocument({
          ...d,
          id: docId, // OVERRIDE id so all chunks belong to 'codebase-root'
          metadata: {
            ...d.metadata,
            originalId: d.id,
            filePath: d.metadata?.source,
          },
        });
        totalChunks += chunks;
        processed++;
        if (processed % 10 === 0) {
          event.sender.send('rag:progress', {
            id: docId,
            status: 'processing',
            message: `Ingesting ${processed}/${docs.length} files...`,
          });
        }
      }

      await documentRegistry.updateDocumentStatus(
        docId,
        'indexed',
        undefined,
        totalChunks
      );
      event.sender.send('rag:progress', {
        id: docId,
        status: 'indexed',
        message: 'Completed',
      });

      return { success: true, count: totalChunks, docs: docs.length };
    } catch (error) {
      const errorMsg = String(error);
      console.error('RAG Index Codebase Error:', error);
      await documentRegistry.updateDocumentStatus(docId, 'error', errorMsg);
      event.sender.send('rag:progress', {
        id: docId,
        status: 'error',
        message: errorMsg,
      });
      return { success: false, error: errorMsg };
    }
  });

  // --- New Handlers for Document Management ---

  ipcMain.handle('rag:get-documents', async () => {
    try {
      const docs = await documentRegistry.getDocuments();
      return { success: true, documents: docs };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('rag:add-file', async (event, filePath: string) => {
    try {
      const id = uuidv4();
      const title = path.basename(filePath);

      const doc: RegisteredDocument = {
        id,
        title,
        type: 'file',
        pathOrUrl: filePath,
        addedAt: Date.now(),
        status: 'pending',
        chunkCount: 0,
      };

      await documentRegistry.addDocument(doc);
      event.sender.send('rag:progress', {
        id,
        status: 'processing',
        message: 'Extracting text...',
      });

      // Process immediately
      try {
        const content = await ingestService.extractText(filePath);
        event.sender.send('rag:progress', {
          id,
          status: 'processing',
          message: 'Generating embeddings...',
        });

        const count = await ingestService.ingestDocument({
          id,
          content,
          metadata: { title, source: 'user-file', path: filePath },
        });

        await documentRegistry.updateDocumentStatus(
          id,
          'indexed',
          undefined,
          count
        );
        event.sender.send('rag:progress', {
          id,
          status: 'indexed',
          message: 'Completed',
        });

        return { success: true, document: doc };
      } catch (err) {
        const errorMsg = String(err);
        await documentRegistry.updateDocumentStatus(id, 'error', errorMsg);
        event.sender.send('rag:progress', {
          id,
          status: 'error',
          message: errorMsg,
        });
        throw err;
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('rag:add-url', async (event, url: string) => {
    try {
      const id = uuidv4();
      const title = url; // Can be updated after fetching if title tag exists

      const doc: RegisteredDocument = {
        id,
        title,
        type: 'url',
        pathOrUrl: url,
        addedAt: Date.now(),
        status: 'pending',
        chunkCount: 0,
      };

      await documentRegistry.addDocument(doc);
      event.sender.send('rag:progress', {
        id,
        status: 'processing',
        message: 'Fetching URL...',
      });

      try {
        const content = await ingestService.extractUrl(url);
        event.sender.send('rag:progress', {
          id,
          status: 'processing',
          message: 'Generating embeddings...',
        });

        const count = await ingestService.ingestDocument({
          id,
          content,
          metadata: { title, source: 'user-url', url },
        });

        await documentRegistry.updateDocumentStatus(
          id,
          'indexed',
          undefined,
          count
        );
        event.sender.send('rag:progress', {
          id,
          status: 'indexed',
          message: 'Completed',
        });

        return { success: true, document: doc };
      } catch (err) {
        const errorMsg = String(err);
        await documentRegistry.updateDocumentStatus(id, 'error', errorMsg);
        event.sender.send('rag:progress', {
          id,
          status: 'error',
          message: errorMsg,
        });
        throw err;
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('rag:remove-document', async (_, id: string) => {
    try {
      await documentRegistry.removeDocument(id);
      // Remove chunks from vector store
      // NOTE: LanceDB simple delete might be tricky if not supported directly by this version/wrapper
      // But typically table.delete(`documentId = '${id}'`)
      // If store doesn't support delete, we can't remove chunks easily without re-creating table.
      // Let's assume for now we just remove from registry so it doesn't show up in UI,
      // but chunks remain. This is suboptimal but acceptable for MVP if delete API is missing.
      // However, checking store.ts:
      // table.delete(predicate) is standard.
      try {
        await vectorStore.deleteDocument(id);
      } catch (e) {
        console.warn('Failed to delete chunks from vector store:', e);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // --- Configuration Handlers ---

  ipcMain.handle('rag:get-config', async () => {
    try {
      const config = await ragConfigManager.getConfig();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('rag:set-config', async (_, newConfig: Partial<RagConfig>) => {
    try {
      const config = await ragConfigManager.setConfig(newConfig);
      return { success: true, config };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // --- Advanced Search Handler ---

  ipcMain.handle(
    'rag:search-advanced',
    async (_, query: string, options: SearchOptions = {}) => {
      try {
        console.log('Received advanced search request:', query, options);
        const config = await ragConfigManager.getConfig();

        const limit = options.limit ?? config.retrievalLimit;
        const threshold = options.threshold ?? config.retrievalThreshold;
        const documentIds = options.documentIds;

        // Get query embedding
        const queryEmbedding = await embeddingsService.generateEmbedding(query);

        // Use metadata-aware search if filters or boosts are provided
        const results = options.metadataFilter
          ? await vectorStore.searchWithMetadata(
              queryEmbedding,
              limit,
              threshold,
              {
                documentIds,
                metadataFilter: options.metadataFilter,
              }
            )
          : await vectorStore.searchWithThreshold(
              queryEmbedding,
              limit,
              threshold,
              documentIds
            );

        // Serialize results - remove non-serializable embedding arrays
        const serializedResults = results.map((r) => ({
          id: r.id,
          documentId: r.documentId,
          content: r.content,
          score: r.score,
          metadata: r.metadata,
        }));

        return {
          success: true,
          results: serializedResults,
          meta: {
            limit,
            threshold,
            totalResults: results.length,
            hasMetadataFilter: !!options.metadataFilter,
          },
        };
      } catch (error) {
        console.error('RAG Advanced Search Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --- Strategy Decision Handler ---

  ipcMain.handle(
    'rag:get-chunks-by-documents',
    async (_, documentIds: string[], limit?: number) => {
      try {
        const results = await vectorStore.getChunksByDocumentIds(
          documentIds,
          limit
        );
        const serializedResults = results.map((r) => ({
          id: r.id,
          documentId: r.documentId,
          content: r.content,
          score: r.score,
          metadata: r.metadata,
        }));
        return { success: true, results: serializedResults };
      } catch (error) {
        console.error('RAG Get Chunks Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  ipcMain.handle(
    'rag:decide-strategy',
    async (_, documentIds: string[], _query: string) => {
      try {
        // Get document contents
        const docs = await documentRegistry.getDocuments();
        const selectedDocs = docs.filter((d) => documentIds.includes(d.id));

        const totalChunks = selectedDocs.reduce(
          (sum, d) => sum + d.chunkCount,
          0
        );
        const config = await ragConfigManager.getConfig();

        // For strategy decision, we need content. But RegisteredDocument doesn't have content.
        // We estimate tokens using the average chunk size from tokenCounter.
        // Average chunk is ~1000 chars → ~250 tokens at 4 chars/token.
        const avgTokensPerChunk = tokenCounter.estimateTokens('x'.repeat(1000));
        const estimatedTokens = totalChunks * avgTokensPerChunk;

        const decision = {
          strategy:
            estimatedTokens <= config.maxContextTokens * 0.7
              ? 'inject-full'
              : 'retrieve',
          reason:
            estimatedTokens <= config.maxContextTokens * 0.7
              ? `Content fits (${estimatedTokens} est. tokens)`
              : `Content too large (${estimatedTokens} est. tokens), using retrieval`,
          tokenCount: estimatedTokens,
        };

        return { success: true, decision };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // --- Full RAG Pipeline Handler ---

  ipcMain.handle(
    'rag:search-pipeline',
    async (_, query: string, options: PipelineOptions = {}) => {
      try {
        console.log('Received pipeline search request:', query, options);
        const config = await ragConfigManager.getConfig();

        const retrievalLimit = options.retrievalLimit ?? 15;
        const threshold = options.threshold ?? config.retrievalThreshold;
        const maxContextTokens =
          options.maxContextTokens ?? config.maxContextTokens;
        const documentIds = options.documentIds;
        const metadataFilter = options.metadataFilter;
        const vectorWeight = options.vectorWeight ?? 0.7;
        const bm25Weight = options.bm25Weight ?? 0.3;
        const includeAttribution = options.includeAttribution ?? true;
        const enableRewrite = options.enableRewrite ?? true;
        const enableHybrid = options.enableHybrid ?? true;
        const enableRerank = options.enableRerank ?? true;
        const enableDistill = options.enableDistill ?? true;

        // Step 1: Query rewriting
        let searchQuery = query;
        let expandedQuery = query;
        let wasRewritten = false;
        let rewrittenQuery: string | undefined;

        if (enableRewrite) {
          const rewritten = rewriteQuery(query);
          searchQuery = rewritten.primary;
          expandedQuery = rewritten.expanded;
          wasRewritten = rewritten.wasRewritten;
          if (wasRewritten) {
            rewrittenQuery = rewritten.primary;
          }
        }

        // Step 2: Generate embedding for the (rewritten) query
        const queryEmbedding =
          await embeddingsService.generateEmbedding(searchQuery);

        // Step 3: Search — hybrid or vector-only
        let results: import('./types').SearchResult[];

        if (enableHybrid) {
          results = await vectorStore.hybridSearch(
            queryEmbedding,
            expandedQuery,
            retrievalLimit,
            threshold,
            {
              documentIds,
              metadataFilter,
              vectorWeight,
              bm25Weight,
            }
          );
        } else {
          results = metadataFilter
            ? await vectorStore.searchWithMetadata(
                queryEmbedding,
                retrievalLimit,
                threshold,
                { documentIds, metadataFilter }
              )
            : await vectorStore.searchWithThreshold(
                queryEmbedding,
                retrievalLimit,
                threshold,
                documentIds
              );
        }

        const chunksRetrieved = results.length;

        // Step 4: Re-rank
        if (enableRerank && results.length > 0) {
          results = rerank(results, searchQuery, retrievalLimit);
        }

        // Step 5: Context distillation
        if (enableDistill && results.length > 0) {
          results = distillContext(results);
        }

        // Step 6: Auto-trim to fit token budget
        const trimResult = autoTrim(results, {
          maxTokens: maxContextTokens,
          includeAttribution,
        });

        const pipelineResult: PipelineResult = {
          context: trimResult.context,
          tokenCount: trimResult.tokenCount,
          chunksIncluded: trimResult.includedChunks,
          chunksRetrieved,
          rewrittenQuery,
          wasRewritten,
          sourceIds: trimResult.includedIds,
        };

        return { success: true, result: pipelineResult };
      } catch (error) {
        console.error('RAG Pipeline Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );
}
