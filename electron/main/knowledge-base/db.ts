import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { LibSQLVector } from '@mastra/libsql';
import { app } from 'electron';

// Polyfill for Mastra if needed
if (typeof global.crypto === 'undefined' || !('subtle' in global.crypto)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).crypto = crypto as any;
}

let db: Client;
let vectorStore: LibSQLVector;

async function initDB(db: Client) {
    try {
        await db.batch([
            `CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        embedding_model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
            `CREATE TABLE IF NOT EXISTS kb_file (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kb_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        chunk_count INTEGER DEFAULT 0,
        total_chunks INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processing_started_at DATETIME,
        FOREIGN KEY (kb_id) REFERENCES knowledge_base(id)
      )`.trim(),
        ]);

        console.log('[RAG DB] Database schema initialized successfully');
    } catch (error) {
        console.error('[RAG DB] Failed to initialize database schema:', error);
        throw error;
    }
}

export async function initializeDatabase() {
    const dbPath = path.join(app.getPath('userData'), 'databases', 'rag_kb.db');

    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
        console.log('[RAG DB] Initializing vector store at:', dbPath);
        vectorStore = new LibSQLVector({
            id: 'rag-vector-db',
            url: `file:${dbPath}`,
        });

        // Access the underlying turso client properly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db = (vectorStore as any).turso;

        await initDB(db);
    } catch (error) {
        console.error('[RAG DB] Failed to initialize vector store:', error);
        throw error;
    }
}

export function getDatabase(): Client {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}

export function getVectorStore(): LibSQLVector {
    if (!vectorStore) {
        throw new Error('Vector store not initialized');
    }
    return vectorStore;
}
