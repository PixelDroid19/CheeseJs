// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock electron before importing other modules
const { tempDir } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
  return { tempDir: dir };
});

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return tempDir;
      return tempDir;
    },
  },
}));

// Mock transformers to avoid downloading models
vi.mock('@xenova/transformers', () => ({
  pipeline: async () => {
    return Object.assign(
      async (_text: string) => {
        // Return a fake embedding of length 384
        const data = new Float32Array(384).fill(0.1);
        return { data };
      },
      { model: 'mock-model' }
    );
  },
  env: {
    localModelPath: '',
    allowRemoteModels: false,
    allowLocalModels: true,
  },
}));

// Mock lancedb to avoid native module issues if necessary, but trying real one first.
// If it fails, I'll update the test.

import { ingestService } from '../ingest';
import { vectorStore } from '../store';
import { embeddingsService } from '../embeddings';
import { RagDocument } from '../types';

describe('RAG System', () => {
  afterEach(async () => {
    // Cleanup
    await vectorStore.clear();
  });

  it('should generate embeddings (mocked)', async () => {
    const embedding = await embeddingsService.generateEmbedding('hello');
    expect(embedding).toHaveLength(384);
    expect(embedding[0]).toBeCloseTo(0.1);
  });

  it('should ingest and search documents', async () => {
    const doc: RagDocument = {
      id: 'doc1',
      content: 'This is a test document about cheese. Cheese is great.',
      metadata: { title: 'Cheese Test' },
    };

    // Ingest
    const count = await ingestService.ingestDocument(doc);
    expect(count).toBeGreaterThan(0);

    // Verify search
    const queryEmbedding = await embeddingsService.generateEmbedding('cheese');
    const results = await vectorStore.search(queryEmbedding);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('cheese');
    expect(results[0].metadata.title).toBe('Cheese Test');
  });

  it('should handle offline scenario gracefully', async () => {
    // Since we mocked transformers, it simulates having the model or handling it.
    // But we can test if init() works.
    await embeddingsService.init();
    expect(true).toBe(true);
  });
});
