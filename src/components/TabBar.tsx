import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Plus, FileCode, FileJson, Hash } from 'lucide-react';
import clsx from 'clsx';
import { useEditorTabsStore } from '../store/storeHooks';

function getLanguageIcon(language: string) {
    switch (language) {
        case 'javascript':
        case 'typescript':
            return <FileCode className="w-3.5 h-3.5 text-yellow-500" />;
        case 'python':
            return <Hash className="w-3.5 h-3.5 text-blue-500" />;
        case 'json':
            return <FileJson className="w-3.5 h-3.5 text-green-500" />;
        default:
            return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />;
    }
}

export function TabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useEditorTabsStore();

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('text/plain', id);
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== targetId) {
            // Future implementation: Drag and drop to reorder
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div className="flex bg-background border-b border-border/40 overflow-x-auto overflow-y-hidden custom-scrollbar h-10 shrink-0 select-none">
            <AnimatePresence initial={false}>
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <m.div
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            key={tab.id}
                            className={clsx(
                                "group relative flex items-center min-w-[120px] max-w-[200px] h-full border-r border-border/40 cursor-pointer transition-colors",
                                isActive ? "bg-card" : "bg-muted/30 hover:bg-muted/50"
                            )}
                            onClick={() => setActiveTab(tab.id)}
                            draggable
                            onDragStart={(e: any) => handleDragStart(e, tab.id)}
                            onDrop={(e: any) => handleDrop(e, tab.id)}
                            onDragOver={(e: any) => handleDragOver(e)}
                        >
                            <div
                                className={clsx(
                                    "absolute top-0 left-0 w-full h-[2px] transition-colors",
                                    isActive ? "bg-primary" : "bg-transparent group-hover:bg-primary/20"
                                )}
                            />

                            <div className="flex flex-1 items-center gap-2 px-3 overflow-hidden">
                                <div className="shrink-0 flex items-center">
                                    {tab.isExecuting ? (
                                        <svg className="animate-spin h-3.5 w-3.5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        getLanguageIcon(tab.language)
                                    )}
                                </div>

                                <span className={clsx(
                                    "text-xs truncate transition-colors",
                                    isActive ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground/80"
                                )}>
                                    {tab.title}
                                </span>

                                {/* Pending execution dot */}
                                {tab.isPendingRun && !tab.isExecuting && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-auto shrink-0" />
                                )}
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className={clsx(
                                    "mx-1 shrink-0 p-1 rounded-md transition-all",
                                    isActive
                                        ? "opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground"
                                        : "opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 text-muted-foreground"
                                )}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </m.div>
                    );
                })}
            </AnimatePresence>

            <button
                onClick={() => addTab(`script-${tabs.length + 1}.js`)}
                className="flex items-center justify-center w-10 h-10 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground shrink-0 border-r border-border/40"
                title="Nueva Pestaña (Ctrl+T)"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
}
