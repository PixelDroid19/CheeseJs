/**
 * Capture Controls Component
 *
 * Simple screenshot button that captures code and output
 * in a beautiful, shareable code card format.
 *
 * Features:
 * - Code + Output capture
 * - Configurable background theme (via Settings)
 * - Configurable output inclusion (via Settings)
 * - Native file saving
 * - "Show in Folder" integration
 */

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, X, Copy, FolderOpen } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useCodeStore } from '../store/useCodeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { CodeCard } from './CodeCard';

// ============================================================================
// TYPES
// ============================================================================

interface CaptureResult {
  success: boolean;
  message: string;
  blob?: Blob;
  filePath?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CaptureControls() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const { captureTheme, captureIncludeOutput } = useSettingsStore();
  const cardRef = useRef<HTMLDivElement>(null);

  // Get code and output from store
  const code = useCodeStore((s) => s.code);
  const result = useCodeStore((s) => s.result);

  // Extract output text from results
  const getOutputText = useCallback(() => {
    if (!result || result.length === 0) return '';
    return result
      .map((r) => {
        const content = r.element?.content;
        if (content === null || content === undefined) return '';
        if (typeof content === 'object') {
          return JSON.stringify(content, null, 2);
        }
        return String(content);
      })
      .filter((text) => text.trim().length > 0)
      .join('\n');
  }, [result]);

  const handleCapture = async () => {
    if (!cardRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // Wait for next frame to ensure render
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // High DPI
        logging: false,
        useCORS: true,
        windowWidth: 1200, // Ensure good context width for off-screen element
      });

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      // Create preview
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCapturedBlob(blob);

      // Auto-save to disk using native API if available
      if (window.electronAPI?.saveImage) {
        const buffer = await blob.arrayBuffer();
        const filename = `cheesejs-${Date.now()}.png`;
        const result = await window.electronAPI.saveImage(buffer, filename);

        if (result.success) {
          setLastResult({
            success: true,
            message: 'Saved to Pictures!',
            blob,
            filePath: result.filePath,
          });
          setShowToast(true);
        } else {
          throw new Error(result.error || 'Failed to save to disk');
        }
      } else {
        // Fallback or just show preview
        setLastResult({
          success: true,
          message: 'Captured!',
          blob,
        });
        setShowToast(true);
      }
    } catch (error) {
      setLastResult({
        success: false,
        message: error instanceof Error ? error.message : 'Capture failed',
      });
      setShowToast(true);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!capturedBlob) return;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': capturedBlob }),
      ]);
      setLastResult({
        success: true,
        message: 'Copied to clipboard!',
        blob: capturedBlob,
        filePath: lastResult?.filePath,
      });
      setShowToast(true);
    } catch {
      setLastResult({
        success: false,
        message: 'Failed to copy',
        blob: capturedBlob,
        filePath: lastResult?.filePath,
      });
      setShowToast(true);
    }
  };

  const handleShowInFolder = () => {
    if (lastResult?.filePath) {
      window.electronAPI.showItemInFolder(lastResult.filePath);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCapturedBlob(null);
  };

  // Hide toast after 3 seconds
  const hideToast = () => setShowToast(false);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCapture}
        disabled={isCapturing}
        className="p-3 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 relative group transition-colors"
        title="Capture Code Card"
      >
        <Camera className="w-5 h-5" />
      </motion.button>

      {/* Hidden Code Card for rendering */}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '900px', // Fixed width for consistent captures
            height: 'auto',
            pointerEvents: 'none',
            visibility: 'visible', // Ensure visibility for html2canvas
          }}
        >
          <CodeCard
            ref={cardRef}
            code={code}
            output={captureIncludeOutput ? getOutputText() : undefined}
            showLineNumbers={true}
            title="CheeseJS"
            background={captureTheme}
          />
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {createPortal(
        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
              onClick={closePreview}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-full max-h-full flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={closePreview}
                  className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                  title="Close Preview"
                >
                  <X className="w-6 h-6" />
                </button>

                {/* Preview Image */}
                <img
                  src={previewUrl}
                  alt="Code Card Preview"
                  className="rounded-lg shadow-2xl max-h-[70vh] object-contain border border-white/10"
                />

                {/* Actions */}
                <div className="flex justify-center gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyToClipboard}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors border border-white/5"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Image
                  </motion.button>

                  {lastResult?.filePath && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleShowInFolder}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl font-medium transition-colors border border-blue-500/30"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Show in Folder
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Toast Notification */}
      {createPortal(
        <AnimatePresence>
          {showToast && lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              onAnimationComplete={() => {
                if (lastResult.success) {
                  setTimeout(hideToast, 4000);
                }
              }}
              className="fixed bottom-24 right-6 z-[100]"
            >
              <div
                className={`p-4 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center gap-4 ${
                  lastResult.success
                    ? 'bg-[#1e2025]/90 border-green-500/30 text-white'
                    : 'bg-red-950/90 border-red-500/30 text-red-200'
                }`}
              >
                <div
                  className={`p-2 rounded-full ${lastResult.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                >
                  {lastResult.success ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {lastResult.message}
                  </span>
                  {lastResult.filePath && (
                    <button
                      onClick={handleShowInFolder}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline text-left mt-0.5"
                    >
                      Show in folder
                    </button>
                  )}
                </div>

                <button
                  onClick={hideToast}
                  className="p-1 rounded hover:bg-white/10 transition-colors ml-2"
                >
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default CaptureControls;
