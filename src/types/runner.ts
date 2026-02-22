export interface ExecutionOptions {
    timeout?: number;
    showUndefined?: boolean;
    showTopLevelResults?: boolean;
    loopProtection?: boolean;
    magicComments?: boolean;
    language?: 'javascript' | 'typescript' | 'python';
}

export interface ExecutionResult {
    type: 'result' | 'console' | 'debug' | 'error' | 'complete';
    id: string;
    data?: unknown;
    line?: number;
    jsType?: string;
    consoleType?: 'log' | 'warn' | 'error' | 'info' | 'table' | 'dir';
}

export type ResultCallback = (result: ExecutionResult) => void;

export interface CodeRunner {
    execute: (
        id: string,
        code: string,
        options?: ExecutionOptions
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    cancel: (id: string) => void;
    isReady: (language?: string) => Promise<boolean>;
    waitForReady: (language?: string) => Promise<boolean>;
    onResult: (callback: ResultCallback) => () => void;
    removeResultListener: (callback: ResultCallback) => void;
    onInputRequest: (
        callback: (request: {
            id: string;
            data: { prompt: string; line: number; requestId?: string };
        }) => void
    ) => () => void;
    sendInputResponse: (id: string, value: string, requestId?: string) => void;
    onJSInputRequest: (
        callback: (request: {
            id: string;
            type: 'prompt-request' | 'alert-request';
            message: string;
        }) => void
    ) => () => void;
    sendJSInputResponse: (id: string, value: string) => void;
}
