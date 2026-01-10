import { embeddingsService } from './embeddings';
import { vectorStore } from './store';
import { RagChunk, RagDocument } from './types';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
import * as cheerio from 'cheerio';

export class IngestService {
  // Extract text from various file formats
  async extractText(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    try {
      if (ext === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);
        return data.text;
      } else if (ext === '.docx') {
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

  // Simple Recursive Character Text Splitter implementation
  // Default chunk size 800 tokens approx (3200 chars). User asked for 200-800 tokens.
  // 1 token ~ 4 chars. 800 tokens ~ 3200 chars.
  // Let's stick to 1000 chars to be safe and granular.
  private splitText(
    text: string,
    chunkSize = 1000,
    chunkOverlap = 100
  ): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    if (!text || text.trim().length === 0) return [];

    while (startIndex < text.length) {
      let endIndex = startIndex + chunkSize;

      // If we are not at the end, try to find a natural break
      if (endIndex < text.length) {
        // Priority: Double newline (paragraph), Newline, Period, Space

        let splitIndex = -1;

        // 1. Paragraphs
        const lastDoubleNewline = text.lastIndexOf('\n\n', endIndex);
        if (lastDoubleNewline > startIndex) splitIndex = lastDoubleNewline + 2;

        // 2. Newlines
        if (splitIndex === -1) {
          const lastNewline = text.lastIndexOf('\n', endIndex);
          if (lastNewline > startIndex) splitIndex = lastNewline + 1;
        }

        // 3. Sentences (Period followed by space)
        if (splitIndex === -1) {
          const lastPeriod = text.lastIndexOf('. ', endIndex);
          if (lastPeriod > startIndex) splitIndex = lastPeriod + 2;
        }

        // 4. Spaces
        if (splitIndex === -1) {
          const lastSpace = text.lastIndexOf(' ', endIndex);
          if (lastSpace > startIndex) splitIndex = lastSpace + 1;
        }

        // If found a split point
        if (splitIndex !== -1) {
          endIndex = splitIndex;
        }
      } else {
        endIndex = text.length;
      }

      const chunk = text.slice(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // If we reached the end of the text, we are done
      if (endIndex === text.length) break;

      // Calculate next start index with overlap
      // Ensure we advance at least 1 char to avoid loops
      const nextStart = Math.max(startIndex + 1, endIndex - chunkOverlap);
      startIndex = nextStart;

      // Break if we reached the end
      if (startIndex >= text.length) break;
    }

    return chunks;
  }

  async ingestDocument(doc: RagDocument) {
    console.log(`Ingesting document: ${doc.id}`);

    // 1. Chunking
    const textChunks = this.splitText(doc.content);
    console.log(`Split into ${textChunks.length} chunks`);

    if (textChunks.length === 0) return 0;

    // 2. Embeddings
    // Process in batches to avoid OOM or timeout
    const batchSize = 10;
    let processedChunks = 0;

    for (let i = 0; i < textChunks.length; i += batchSize) {
      const batch = textChunks.slice(i, i + batchSize);
      const embeddings = await embeddingsService.generateEmbeddings(batch);

      // 3. Prepare RagChunks
      const ragChunks: RagChunk[] = batch.map((content, idx) => ({
        id: `${doc.id}_${i + idx}`,
        documentId: doc.id,
        content,
        metadata: {
          ...doc.metadata,
          chunkIndex: i + idx,
          totalChunks: textChunks.length,
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
