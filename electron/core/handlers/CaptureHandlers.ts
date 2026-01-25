/**
 * Capture Handlers
 *
 * IPC handlers for shell operations related to capture functionality.
 */

import { ipcMain, shell, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { createMainLogger } from '../logger.js';

const log = createMainLogger('CaptureHandlers');

// ============================================================================
// HANDLER REGISTRATION
// ============================================================================

export function registerCaptureHandlers(): void {
  /**
   * Save image to disk
   */
  ipcMain.handle(
    'capture:save-image',
    async (
      _event: Electron.IpcMainInvokeEvent,
      buffer: ArrayBuffer,
      filename: string
    ) => {
      try {
        const picturesDir = app.getPath('pictures');
        const captureDir = path.join(picturesDir, 'CheeseJS Captures');

        try {
          await fs.access(captureDir);
        } catch {
          await fs.mkdir(captureDir, { recursive: true });
        }

        const filePath = path.join(captureDir, filename);
        await fs.writeFile(filePath, Buffer.from(buffer));

        log.info(`[CaptureHandlers] Saved screenshot to: ${filePath}`);
        return { success: true, filePath };
      } catch (error) {
        log.error('[CaptureHandlers] Failed to save image:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  /**
   * Show file in explorer/finder
   */
  ipcMain.handle(
    'shell:show-item-in-folder',
    async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
      try {
        shell.showItemInFolder(filePath);
      } catch (error) {
        log.error('[CaptureHandlers] Failed to show item in folder:', error);
      }
    }
  );

  log.debug('[CaptureHandlers] Registered shell handlers');
}
