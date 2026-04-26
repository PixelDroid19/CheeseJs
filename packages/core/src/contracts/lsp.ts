/** Language server configuration for a single Monaco language. */
export interface LspLanguageConfig {
  name: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  initializationOptions?: Record<string, unknown>;
  enabled?: boolean;
}

export interface LspConfig {
  languages: Record<string, LspLanguageConfig>;
}

export interface LspSaveResult {
  success: boolean;
  error?: string;
}

export interface LspBridgeMessage {
  langId: string;
  data: string;
}

/** Typed preload API used by the renderer to read and persist LSP config. */
export interface LspConfigApi {
  getConfig: () => Promise<LspConfig>;
  saveConfig: (config: LspConfig) => Promise<LspSaveResult>;
}

/** Typed preload API used by Monaco clients to talk to spawned LSP servers. */
export interface LspBridgeApi {
  start: (langId: string) => Promise<LspSaveResult>;
  stop: (langId: string) => void;
  sendMessage: (langId: string, message: string) => void;
  onMessage: (callback: (msg: LspBridgeMessage) => void) => () => void;
}
