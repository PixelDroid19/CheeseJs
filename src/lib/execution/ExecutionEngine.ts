import { getMetrics } from '../metrics';
import { createExecutionError, shouldDisplayError } from '../errors';
import { DEFAULT_TIMEOUT } from '../../constants';

export interface ExecutionOptions {
    timeout?: number;
    showUndefined?: boolean;
    showTopLevelResults?: boolean;
    loopProtection?: boolean;
    magicComments?: boolean;
    workingDirectory?: string;
    language?: 'javascript' | 'typescript' | 'python';
}

export interface ExecutionResultData {
    type: 'result' | 'console' | 'debug' | 'error' | 'complete';
    id: string;
    data?: unknown;
    line?: number;
    jsType?: string;
    consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

export interface ExecutionCallbacks {
    onOutput: (result: {
        content: string;
        type: 'execution' | 'error';
        consoleType?: string;
        jsType?: string;
        lineNumber?: number;
    }) => void;
    onComplete: (historyData: {
        code: string;
        language: 'javascript' | 'typescript' | 'python';
        status: 'success' | 'error';
        executionTime: number;
    }) => void;
    onError: (errorMsg: string) => void;
}

class WorkerUnavailableError extends Error {
    constructor() {
        super('Code runner not available. Please ensure you are running in Electron.');
        this.name = 'WorkerUnavailableError';
    }
}

/**
 * Single Execution session handler to manage IPC subscriptions/lifecycle
 */
export class ExecutionSession {
    private executionId: string;
    private unsubscribe?: () => void;

    constructor(
        private code: string,
        private language: 'javascript' | 'typescript' | 'python',
        private callbacks: ExecutionCallbacks
    ) {
        this.executionId = `exec-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    public async start(options: ExecutionOptions) {
        const startTime = Date.now();
        const metrics = getMetrics();

        try {
            if (!window.codeRunner) {
                throw new WorkerUnavailableError();
            }

            const isReady = await window.codeRunner.waitForReady(this.language);
            if (!isReady) {
                throw new Error(`Worker for ${this.language} failed to initialize`);
            }

            this.unsubscribe = window.codeRunner.onResult((result: ExecutionResultData) => {
                if (result.id !== this.executionId) return;

                if (result.type === 'debug') {
                    this.callbacks.onOutput({
                        content: (result.data as { content: string })?.content ?? String(result.data),
                        type: 'execution',
                        jsType: result.jsType,
                        lineNumber: result.line,
                    });
                } else if (result.type === 'console') {
                    const content = (result.data as { content: string })?.content ?? String(result.data);

                    if (!this.isCancellationMessage(content)) {
                        const prefix = result.consoleType === 'error' ? '❌ ' : result.consoleType === 'warn' ? '⚠️ ' : '';
                        this.callbacks.onOutput({
                            content: prefix + content,
                            type: 'execution',
                            consoleType: result.consoleType,
                        });
                    }
                } else if (result.type === 'error') {
                    const { message, shouldDisplay } = this.formatError(result.data);
                    if (shouldDisplay) {
                        this.callbacks.onOutput({ content: message, type: 'error' });
                    }
                } else if (result.type === 'complete') {
                    metrics.recordExecution({
                        language: this.language,
                        duration: Date.now() - startTime,
                        success: true,
                        codeLength: this.code.length,
                    });

                    this.cleanup();
                    this.callbacks.onComplete({
                        code: this.code,
                        language: this.language,
                        status: 'success',
                        executionTime: Date.now() - startTime,
                    });
                }
            });

            const response = await window.codeRunner.execute(this.executionId, this.code, {
                timeout: DEFAULT_TIMEOUT,
                ...options,
                language: this.language,
            });

            if (!response.success) {
                if (response.error?.includes('timeout')) {
                    this.callbacks.onOutput({ content: `❌ ${response.error}`, type: 'error' });
                } else if (!this.unsubscribe) {
                    this.callbacks.onOutput({ content: `❌ ${response.error ?? 'Unknown error'}`, type: 'error' });
                }
            }
        } catch (error) {
            const execError = createExecutionError(error, this.language);
            metrics.recordExecution({
                language: this.language,
                duration: Date.now() - startTime,
                success: false,
                error: execError.originalMessage,
                codeLength: this.code.length,
            });

            const { message, shouldDisplay } = this.formatError(error);
            if (shouldDisplay) {
                this.callbacks.onError(message);
                this.callbacks.onComplete({
                    code: this.code,
                    language: this.language,
                    status: 'error',
                    executionTime: Date.now() - startTime,
                });
            }
        }
    }

    public cancel() {
        if (window.codeRunner) {
            window.codeRunner.cancel(this.executionId);
        }
        this.cleanup();
    }

    private cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = undefined;
        }
    }

    private isCancellationMessage(content: string): boolean {
        return (
            content.includes('KeyboardInterrupt') ||
            content.includes('Execution cancelled') ||
            content.includes('_pyodide/_future_helper.py') ||
            content.includes('pyodide/webloop.py') ||
            (content.includes('Traceback') && content.includes('cancelled'))
        );
    }

    private formatError(error: unknown) {
        const execError = createExecutionError(error, this.language);
        if (!shouldDisplayError(execError)) {
            return { message: '', shouldDisplay: false };
        }
        return {
            message: execError.getFormattedMessage(),
            shouldDisplay: true,
        };
    }
}

export class ExecutionEngine {
    private currentSession?: ExecutionSession;

    public async run(
        code: string,
        language: 'javascript' | 'typescript' | 'python',
        options: ExecutionOptions,
        callbacks: ExecutionCallbacks
    ) {
        this.cancel();
        this.currentSession = new ExecutionSession(code, language, callbacks);
        await this.currentSession.start(options);
    }

    public cancel() {
        if (this.currentSession) {
            this.currentSession.cancel();
            this.currentSession = undefined;
        }
    }
}

export const executionEngine = new ExecutionEngine();
