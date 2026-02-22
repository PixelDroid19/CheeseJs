import path from 'path';
import { app } from 'electron';

// Lazy-loaded to avoid loading heavy ONNX runtime at startup
let transformersModule: typeof import('@xenova/transformers') | null = null;
async function getTransformers() {
  if (!transformersModule) {
    transformersModule = await import('@xenova/transformers');
    // Configure model paths on first load
    transformersModule.env.localModelPath = path.join(
      app.getPath('userData'),
      'huggingface',
      'models'
    );
    transformersModule.env.allowRemoteModels = true;
    transformersModule.env.allowLocalModels = true;
  }
  return transformersModule;
}

class EmbeddingsService {
  private static instance: EmbeddingsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pipe: any = null;
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
      const { pipeline } = await getTransformers();
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

  /**
   * Generate embeddings for multiple texts using batch processing.
   * @xenova/transformers supports passing an array of strings to the pipeline,
   * which is more efficient than processing one at a time.
   */
  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length === 1) {
      return [await this.generateEmbedding(texts[0])];
    }

    if (!this.pipe) {
      await this.init();
    }
    if (!this.pipe) {
      throw new Error('Failed to initialize embeddings pipeline');
    }

    // Batch process all texts at once through the pipeline
    const output = await this.pipe(texts, { pooling: 'mean', normalize: true });

    // output.data is a flat Float32Array of shape [texts.length, embeddingDim]
    // We need to split it into individual embeddings
    const embeddingDim = output.dims[output.dims.length - 1];
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const start = i * embeddingDim;
      const end = start + embeddingDim;
      embeddings.push(Array.from(output.data.slice(start, end)) as number[]);
    }

    return embeddings;
  }
}

export const embeddingsService = EmbeddingsService.getInstance();
