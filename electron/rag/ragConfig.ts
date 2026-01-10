import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { RagConfig, DEFAULT_RAG_CONFIG } from './types';

class RagConfigManager {
  private static instance: RagConfigManager;
  private configPath: string;
  private config: RagConfig = { ...DEFAULT_RAG_CONFIG };
  private initPromise: Promise<void>;

  private constructor() {
    this.configPath = path.join(app.getPath('userData'), 'rag-config.json');
    this.initPromise = this.loadConfig();
  }

  public static getInstance(): RagConfigManager {
    if (!RagConfigManager.instance) {
      RagConfigManager.instance = new RagConfigManager();
    }
    return RagConfigManager.instance;
  }

  private async ensureLoaded() {
    await this.initPromise;
  }

  private async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const savedConfig = JSON.parse(data);
      // Merge with defaults to handle new fields
      this.config = { ...DEFAULT_RAG_CONFIG, ...savedConfig };
    } catch (_error) {
      // File doesn't exist or is invalid, use defaults
      this.config = { ...DEFAULT_RAG_CONFIG };
    }
  }

  private async saveConfig() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  public async getConfig(): Promise<RagConfig> {
    await this.ensureLoaded();
    return { ...this.config };
  }

  public async setConfig(newConfig: Partial<RagConfig>): Promise<RagConfig> {
    await this.ensureLoaded();

    // Validate and clamp values
    if (newConfig.retrievalLimit !== undefined) {
      this.config.retrievalLimit = Math.max(
        1,
        Math.min(10, newConfig.retrievalLimit)
      );
    }
    if (newConfig.retrievalThreshold !== undefined) {
      this.config.retrievalThreshold = Math.max(
        0,
        Math.min(1, newConfig.retrievalThreshold)
      );
    }
    if (newConfig.injectionStrategy !== undefined) {
      this.config.injectionStrategy = newConfig.injectionStrategy;
    }
    if (newConfig.maxContextTokens !== undefined) {
      this.config.maxContextTokens = Math.max(
        100,
        Math.min(32000, newConfig.maxContextTokens)
      );
    }

    await this.saveConfig();
    return { ...this.config };
  }

  public async resetToDefaults(): Promise<RagConfig> {
    await this.ensureLoaded();
    this.config = { ...DEFAULT_RAG_CONFIG };
    await this.saveConfig();
    return { ...this.config };
  }
}

export const ragConfigManager = RagConfigManager.getInstance();
