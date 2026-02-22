import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import { RegisteredDocument } from './types';

class DocumentRegistry {
  private static instance: DocumentRegistry;
  private registryPath: string;
  private documents: RegisteredDocument[] = [];
  private initPromise: Promise<void>;

  private constructor() {
    this.registryPath = path.join(app.getPath('userData'), 'rag-registry.json');
    this.initPromise = this.loadRegistry();
  }

  public static getInstance(): DocumentRegistry {
    if (!DocumentRegistry.instance) {
      DocumentRegistry.instance = new DocumentRegistry();
    }
    return DocumentRegistry.instance;
  }

  private async ensureLoaded() {
    await this.initPromise;
  }

  private async loadRegistry() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      this.documents = JSON.parse(data);
    } catch (_error) {
      this.documents = [];
    }
  }

  private async saveRegistry() {
    await fs.writeFile(
      this.registryPath,
      JSON.stringify(this.documents, null, 2)
    );
  }

  public async getDocuments(): Promise<RegisteredDocument[]> {
    await this.ensureLoaded();
    return this.documents;
  }

  public async addDocument(doc: RegisteredDocument) {
    await this.ensureLoaded();
    const existingIndex = this.documents.findIndex((d) => d.id === doc.id);
    if (existingIndex >= 0) {
      this.documents[existingIndex] = doc;
    } else {
      this.documents.push(doc);
    }
    await this.saveRegistry();
  }

  public async removeDocument(id: string) {
    await this.ensureLoaded();
    this.documents = this.documents.filter((d) => d.id !== id);
    await this.saveRegistry();
  }

  public async updateDocumentStatus(
    id: string,
    status: RegisteredDocument['status'],
    error?: string,
    chunkCount?: number
  ) {
    await this.ensureLoaded();
    const doc = this.documents.find((d) => d.id === id);
    if (doc) {
      doc.status = status;
      if (error) doc.error = error;
      if (chunkCount !== undefined) doc.chunkCount = chunkCount;
      await this.saveRegistry();
    }
  }

  public async getDocument(id: string) {
    await this.ensureLoaded();
    return this.documents.find((d) => d.id === id);
  }
}

export const documentRegistry = DocumentRegistry.getInstance();
