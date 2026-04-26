import { AnimatePresence, m } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { ElementType, ReactNode } from 'react';

export interface SettingsTabDefinition<TTab extends string> {
  icon: ElementType;
  id: TTab;
  label: string;
}

export interface SettingsDialogProps<TTab extends string> {
  activeTab: TTab;
  children: ReactNode;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tab: TTab) => void;
  tabs: SettingsTabDefinition<TTab>[];
  title: string;
}

/**
 * Shared settings dialog shell with sidebar tabs and slot-based content.
 */
export function SettingsDialog<TTab extends string>({
  activeTab,
  children,
  description,
  isOpen,
  onClose,
  onTabChange,
  tabs,
  title,
}: SettingsDialogProps<TTab>) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <m.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={clsx(
              'max-w-4xl w-full mx-4 h-[600px] max-h-[90vh] flex rounded-xl shadow-2xl overflow-hidden border',
              'bg-background text-foreground border-border'
            )}
          >
            <div
              className={clsx(
                'w-72 flex flex-col py-6 border-r',
                'bg-muted/30 border-border'
              )}
            >
              <h2
                className={clsx('px-6 mb-8 text-xl font-bold text-foreground')}
              >
                {title}
              </h2>

              <div className="space-y-1 px-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={clsx(
                        'w-full px-4 py-3 text-sm font-medium rounded-md transition-all flex items-center gap-3',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                      )}
                    >
                      <Icon
                        className={clsx(
                          'w-5 h-5',
                          isActive ? 'text-primary' : 'opacity-70'
                        )}
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div
                className={clsx(
                  'flex items-center justify-between px-8 py-6 border-b',
                  'border-border'
                )}
              >
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                  </h3>
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className={clsx(
                    'p-2 rounded-full transition-colors',
                    'hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-2xl space-y-8">{children}</div>
              </div>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
