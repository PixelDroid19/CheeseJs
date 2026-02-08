import { embeddingsService } from './embeddings';
import { vectorStore } from './store';
import { RagChunk, RagDocument } from './types';
import { smartChunk } from './chunker';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'node:module';

// Lazy-loaded to avoid loading parsers at startup
const require = createRequire(import.meta.url);
let pdfParse: any;
let mammothLib: any;
let cheerioLib: typeof import('cheerio') | null = null;

async function getPdfParse() {
  if (!pdfParse) pdfParse = require('pdf-parse');
  return pdfParse;
}
async function getMammoth() {
  if (!mammothLib) mammothLib = require('mammoth');
  return mammothLib;
}
async function getCheerio() {
  if (!cheerioLib) cheerioLib = await import('cheerio');
  return cheerioLib;
}

export class IngestService {
  // Extract text from various file formats
  async extractText(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.pdf') {
        const pdf = await getPdfParse();
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
      } else if (ext === '.docx') {
        const mammoth = await getMammoth();
        const dataBuffer = await fs.readFile(filePath);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        return result.value;
      } else {
        // Assume text-based (txt, md, json, js, ts, etc.)
        return await fs.readFile(filePath, 'utf-8');
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  // Extract text from URL
  async extractUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      const html = await response.text();
      const cheerio = await getCheerio();
      const $ = cheerio.load(html);

      // Remove script and style elements
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('footer').remove();

      return $('body').text().replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error(`Error extracting text from URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Detect file extension from document metadata for smart chunking.
   */
  private getExtension(doc: RagDocument): string | undefined {
    // Try metadata fields that may contain the path or extension
    const meta = doc.metadata;
    if (typeof meta.extension === 'string') return meta.extension;
    if (typeof meta.path === 'string') return path.extname(meta.path);
    if (typeof meta.filePath === 'string') return path.extname(meta.filePath);
    if (typeof meta.source === 'string' && meta.source.includes('.')) {
      return path.extname(meta.source);
    }
    return undefined;
  }

  /**
   * Derive the document type category for metadata filtering.
   */
  private getDocumentType(ext: string | undefined, doc: RagDocument): string {
    if (typeof doc.metadata.source === 'string') {
      if (doc.metadata.source === 'user-url') return 'url';
    }
    if (!ext) return 'unknown';
    const codeExts = new Set([
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.c',
      '.cpp',
      '.h',
      '.hpp',
      '.cs',
      '.rb',
      '.php',
      '.swift',
      '.kt',
      '.css',
      '.html',
    ]);
    const proseExts = new Set(['.md', '.mdx', '.txt', '.rst']);
    if (codeExts.has(ext)) return 'code';
    if (proseExts.has(ext)) return 'prose';
    if (ext === '.json') return 'data';
    if (ext === '.pdf') return 'pdf';
    if (ext === '.docx') return 'document';
    return 'unknown';
  }

  /**
   * Derive programming language from file extension.
   */
  private getLanguage(ext: string | undefined): string | undefined {
    if (!ext) return undefined;
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.css': 'css',
      '.html': 'html',
      '.md': 'markdown',
      '.mdx': 'markdown',
      '.json': 'json',
    };
    return langMap[ext];
  }

  async ingestDocument(doc: RagDocument) {
    console.log(`Ingesting document: ${doc.id}`);

    // 1. Smart chunking based on file type
    const extension = this.getExtension(doc);
    const chunks = smartChunk(doc.content, extension);
    console.log(
      `Split into ${chunks.length} chunks (extension: ${extension ?? 'unknown'})`
    );

    if (chunks.length === 0) return 0;

    // Derive enriched metadata fields
    const language = this.getLanguage(extension);
    const documentType = this.getDocumentType(extension, doc);
    const dateIndexed = Date.now();

    // 2. Embeddings - process in batches to avoid OOM or timeout
    const batchSize = 10;
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);
      const embeddings = await embeddingsService.generateEmbeddings(texts);

      // 3. Prepare RagChunks with enriched metadata from smart chunker
      const ragChunks: RagChunk[] = batch.map((chunk, idx) => ({
        id: `${doc.id}_${i + idx}`,
        documentId: doc.id,
        content: chunk.content,
        metadata: {
          ...doc.metadata,
          chunkIndex: i + idx,
          totalChunks: chunks.length,
          startLine: chunk.meta.startLine,
          endLine: chunk.meta.endLine,
          chunkType: chunk.meta.chunkType,
          ...(chunk.meta.symbolName && { symbolName: chunk.meta.symbolName }),
          ...(chunk.meta.heading && { heading: chunk.meta.heading }),
          // Enriched metadata for filtering
          ...(extension && { fileExtension: extension }),
          ...(language && { language }),
          documentType,
          dateIndexed,
        },
        embedding: embeddings[idx],
      }));

      // 4. Store
      await vectorStore.addChunks(ragChunks);
      processedChunks += ragChunks.length;
    }

    console.log(`Stored ${processedChunks} chunks`);
    return processedChunks;
  }
}

export const ingestService = new IngestService();
