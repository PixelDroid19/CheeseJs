import { pipeline, env, Pipeline } from '@xenova/transformers';
import path from 'path';
import { app } from 'electron';

// Configuration for offline usage
// Set cache directory to userData/huggingface
env.localModelPath = path.join(
  app.getPath('userData'),
  'huggingface',
  'models'
);
env.allowRemoteModels = true; // Allow first-time download
env.allowLocalModels = true;

class EmbeddingsService {
  private static instance: EmbeddingsService;
  private pipe: Pipeline | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  private constructor() {}

  public static getInstance(): EmbeddingsService {
    if (!EmbeddingsService.instance) {
      EmbeddingsService.instance = new EmbeddingsService();
    }
    return EmbeddingsService.instance;
  }

  public async init() {
    if (!this.pipe) {
      console.log('Initializing embeddings model:', this.modelName);
      try {
        this.pipe = await pipeline('feature-extraction', this.modelName, {
          quantized: true,
        });
        console.log('Embeddings model initialized');
      } catch (error) {
        console.error('Failed to initialize embeddings model:', error);
        throw error;
      }
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    if (!this.pipe) {
      await this.init();
    }

    if (!this.pipe) {
      throw new Error('Failed to initialize embeddings pipeline');
    }

    // Generate embedding
    const output = await this.pipe(text, { pooling: 'mean', normalize: true });

    // Convert Tensor to array
    const embedding = Array.from(output.data) as number[];
    return embedding;
  }

  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text));
    }
    return embeddings;
  }
}

export const embeddingsService = EmbeddingsService.getInstance();
