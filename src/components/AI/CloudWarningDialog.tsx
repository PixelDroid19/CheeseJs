/**
 * Cloud Warning Dialog Component
 * Shows a warning before sending code to cloud providers
 */
import { m, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Cloud, Shield, X } from 'lucide-react';


interface CloudWarningDialogProps {
  isOpen: boolean;
  providerName: string;
  sensitiveItems?: string[];
  onConfirm: () => void;
  onCancel: () => void;
  onEnableLocalMode?: () => void;
}

export function CloudWarningDialog({
  isOpen,
  providerName,
  sensitiveItems = [],
  onConfirm,
  onCancel,
  onEnableLocalMode,
}: CloudWarningDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-amber-500/10 border-b border-amber-500/20">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Cloud Provider Warning
                </h3>
                <p className="text-xs text-muted-foreground">
                  Your code will be sent externally
                </p>
              </div>
              <button
                onClick={onCancel}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Cloud className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p className="text-foreground">
                    You are about to send your code to{' '}
                    <strong>{providerName}</strong>.
                  </p>
                  <p className="text-muted-foreground mt-1">
                    This data will leave your machine and be processed by
                    external servers.
                  </p>
                </div>
              </div>

              {sensitiveItems.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-400 font-medium">
                      Potentially sensitive data detected:
                    </p>
                    <ul className="list-disc list-inside text-red-400/80 mt-1 space-y-0.5">
                      {sensitiveItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground mt-2 text-xs">
                      These will be automatically redacted before sending.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 bg-muted/30 border-t border-border">
              {onEnableLocalMode && (
                <button
                  onClick={onEnableLocalMode}
                  className="mr-auto text-xs text-primary hover:underline"
                >
                  Enable Local Mode
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors shadow-lg shadow-amber-900/20"
              >
                <Shield className="w-4 h-4" />
                Proceed Anyway
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
