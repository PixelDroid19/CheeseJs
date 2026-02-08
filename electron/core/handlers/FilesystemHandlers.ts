/**
 * Filesystem Handlers Module
 *
 * Provides IPC handlers for filesystem operations used by the AI agent.
 * Includes: readFile, writeFile, listFiles, searchInFiles, executeCommand, deleteFile
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

interface SearchResult {
  file: string;
  line: number;
  content: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recursively get all files in a directory
 */
async function getFilesRecursive(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, and other common large directories
      if (
        entry.name !== 'node_modules' &&
        entry.name !== '.git' &&
        entry.name !== 'dist' &&
        entry.name !== 'build' &&
        entry.name !== '.next'
      ) {
        const subFiles = await getFilesRecursive(fullPath);
        files.push(...subFiles);
      }
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Search for a pattern in a file and return matching lines
 */
async function searchInFile(
  filePath: string,
  pattern: RegExp
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        results.push({
          file: filePath,
          line: i + 1, // 1-indexed line numbers
          content: lines[i].trim(),
        });
      }
    }
  } catch {
    // Skip files that can't be read (binary, permissions, etc.)
  }

  return results;
}

// ============================================================================
// HANDLER REGISTRATION
// ============================================================================

export function registerFilesystemHandlers(): void {
  // --------------------------------------------------------------------------
  // READ FILE
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:readFile',
    async (
      _event,
      filePath: string,
      options?: { startLine?: number; endLine?: number }
    ) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // If line range is specified, extract those lines
        if (
          options?.startLine !== undefined ||
          options?.endLine !== undefined
        ) {
          const lines = content.split('\n');
          const start = (options.startLine ?? 1) - 1; // Convert to 0-indexed
          const end = options.endLine ?? lines.length;
          const selectedLines = lines.slice(start, end);
          return { success: true, content: selectedLines.join('\n') };
        }

        return { success: true, content };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // WRITE FILE
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:writeFile',
    async (_event, filePath: string, content: string) => {
      try {
        // Ensure the directory exists
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // LIST FILES
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:listFiles',
    async (_event, dirPath: string, recursive: boolean = false) => {
      try {
        if (recursive) {
          const files = await getFilesRecursive(dirPath);
          return { success: true, files };
        } else {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          const files = entries.map((entry) => {
            const fullPath = path.join(dirPath, entry.name);
            return entry.isDirectory() ? fullPath + path.sep : fullPath;
          });
          return { success: true, files };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // SEARCH IN FILES
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:searchInFiles',
    async (_event, pattern: string, directory: string) => {
      try {
        const regex = new RegExp(pattern, 'gi');
        const files = await getFilesRecursive(directory);
        const allResults: SearchResult[] = [];

        // Limit to text files by extension
        const textExtensions = [
          '.ts',
          '.tsx',
          '.js',
          '.jsx',
          '.json',
          '.md',
          '.txt',
          '.html',
          '.css',
          '.scss',
          '.less',
          '.yaml',
          '.yml',
          '.xml',
          '.py',
          '.sh',
          '.bash',
          '.zsh',
          '.env',
          '.config',
          '.gitignore',
          '.eslintrc',
          '.prettierrc',
        ];

        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          const basename = path.basename(file);

          // Include files with text extensions or no extension (like Makefile, Dockerfile)
          if (textExtensions.includes(ext) || !ext) {
            // Skip common binary/large files
            if (
              basename !== 'package-lock.json' &&
              basename !== 'yarn.lock' &&
              basename !== 'pnpm-lock.yaml'
            ) {
              const results = await searchInFile(file, regex);
              allResults.push(...results);
            }
          }
        }

        // Limit results to prevent overwhelming responses
        const limitedResults = allResults.slice(0, 100);

        return {
          success: true,
          results: limitedResults,
          totalMatches: allResults.length,
          truncated: allResults.length > 100,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // EXECUTE COMMAND
  // --------------------------------------------------------------------------
  ipcMain.handle(
    'fs:executeCommand',
    async (_event, command: string, cwd?: string) => {
      try {
        const options: { cwd?: string; timeout: number; maxBuffer: number } = {
          timeout: 30000, // 30 second timeout
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        };

        if (cwd) {
          options.cwd = cwd;
        }

        const { stdout, stderr } = await execAsync(command, options);
        return { success: true, stdout, stderr };
      } catch (error) {
        // exec errors include stdout/stderr in the error object
        const execError = error as {
          message?: string;
          stdout?: string;
          stderr?: string;
        };
        return {
          success: false,
          error: execError.message || String(error),
          stdout: execError.stdout || '',
          stderr: execError.stderr || '',
        };
      }
    }
  );

  // --------------------------------------------------------------------------
  // DELETE FILE
  // --------------------------------------------------------------------------
  ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
    try {
      await fs.rm(filePath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // --------------------------------------------------------------------------
  // GET WORKSPACE PATH
  // --------------------------------------------------------------------------
  ipcMain.handle('fs:getWorkspacePath', async () => {
    return process.cwd();
  });
}
