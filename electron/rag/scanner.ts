import fs from 'fs/promises';
import path from 'path';
import { RagDocument } from './types';

const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vscode',
  'coverage',
  'release',
  'out',
  'temp',
];
const ALLOWED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.md',
  '.json',
  '.css',
  '.html',
  '.txt',
];

export async function scanDirectory(dir: string): Promise<RagDocument[]> {
  const documents: RagDocument[] = [];

  async function walk(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ALLOWED_EXTENSIONS.includes(ext)) {
            try {
              const stats = await fs.stat(fullPath);
              // Skip files larger than 500KB to keep things fast
              if (stats.size > 500 * 1024) continue;

              const content = await fs.readFile(fullPath, 'utf-8');

              documents.push({
                id: fullPath, // Use path as ID
                content,
                metadata: {
                  source: 'codebase',
                  path: fullPath,
                  filename: entry.name,
                  extension: ext,
                  language: ext.slice(1),
                },
              });
            } catch (e) {
              console.warn(`Failed to read file ${fullPath}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error scanning directory ${currentDir}:`, e);
    }
  }

  await walk(dir);
  return documents;
}
