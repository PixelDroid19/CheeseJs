import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion as m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Server,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAISettingsStore } from '../../../store/storeHooks';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { SectionHeader } from '../ui/SectionHeader';
import { Slider } from '../ui/Slider';
import {
  AI_PROVIDERS,
  type AgentProfile,
  type ToolPolicyPreset,
  getProviderConfig,
  aiService,
  validateApiKeyFormat,
  validateLocalServerURL,
  type AIProvider,
} from '../../../features/ai-agent';
import type { AgentExecutionMode } from '../../../store/storeHooks';

interface LocalModel {
  id: string;
  name: string;
}

export function AITab() {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle');
  const [testMessage, setTestMessage] = useState('');
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    provider,
    apiKeys,
    selectedModels,
    customConfigs,
    enableInlineCompletion,
    enableChat,
    executionMode,
    agentProfile,
    enableVerifierSubagent,
    toolPolicyPreset,
    maxTokens,
    temperature,
    localConfig,
    setProvider,
    setApiKey,
    setSelectedModel,
    setCustomConfig,
    setEnableInlineCompletion,
    setEnableChat,
    setExecutionMode,
    setAgentProfile,
    setEnableVerifierSubagent,
    setToolPolicyPreset,
    setMaxTokens,
    setTemperature,
    setLocalConfig,
  } = useAISettingsStore();

  const currentApiKey = apiKeys[provider] || '';
  const currentModel = selectedModels[provider] || '';
  const currentCustomConfig = useMemo(
    () => customConfigs[provider] || {},
    [customConfigs, provider]
  );
  const providerConfig = getProviderConfig(provider);
  const isLocalProvider = provider === 'local';
  const supportsCustomURL = providerConfig?.supportsCustomURL ?? false;

  // Fetch models from local server
  const fetchLocalModels = useCallback(async () => {
    if (!localConfig.baseURL) return;

    setLoadingModels(true);
    try {
      let baseURL = localConfig.baseURL.replace(/\/+$/, '');
      if (!baseURL.endsWith('/v1')) {
        baseURL = baseURL + '/v1';
      }

      const response = await fetch(`${baseURL}/models`);
      if (response.ok) {
        const data = await response.json();
        const models =
          data.data?.map((m: { id: string }) => ({
            id: m.id,
            name: m.id,
          })) || [];
        setLocalModels(models);

        if (models.length > 0 && !localConfig.modelId) {
          setLocalConfig({ modelId: models[0].id });
        }
      }
    } catch (error) {
      console.error('[AITab] Failed to fetch local models:', error);
      setLocalModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [localConfig.baseURL, localConfig.modelId, setLocalConfig]);

  useEffect(() => {
    if (isLocalProvider && localConfig.baseURL) {
      fetchLocalModels();
    }
  }, [isLocalProvider, localConfig.baseURL, fetchLocalModels]);

  // Show advanced if custom URL is set
  useEffect(() => {
    if (currentCustomConfig.baseURL || currentCustomConfig.modelId) {
      setShowAdvanced(true);
    }
  }, [currentCustomConfig]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setTestStatus('idle');
    setTestMessage('');

    if (newProvider === 'local') {
      if (localConfig.baseURL) {
        try {
          aiService.configure(newProvider, '', '', {
            baseURL: localConfig.baseURL,
            modelId: localConfig.modelId,
          });
        } catch {
          // Silent fail
        }
      }
    } else {
      const apiKey = apiKeys[newProvider];
      const model = selectedModels[newProvider];
      const customCfg = customConfigs[newProvider];
      if (apiKey && model) {
        aiService.configure(newProvider, apiKey, model, undefined, customCfg);
      }
    }
  };

  const handleApiKeyChange = (key: string) => {
    setApiKey(provider, key);
    if (key && currentModel) {
      try {
        aiService.configure(
          provider,
          key,
          currentModel,
          undefined,
          currentCustomConfig
        );
      } catch {
        // Silent fail
      }
    }
  };

  const handleModelChange = (model: string) => {
    if (isLocalProvider) {
      setLocalConfig({ modelId: model });
      if (localConfig.baseURL) {
        try {
          aiService.configure(provider, '', '', {
            baseURL: localConfig.baseURL,
            modelId: model,
          });
        } catch {
          // Silent fail
        }
      }
    } else {
      setSelectedModel(provider, model);
      if (currentApiKey) {
        try {
          aiService.configure(
            provider,
            currentApiKey,
            model,
            undefined,
            currentCustomConfig
          );
        } catch {
          // Silent fail
        }
      }
    }
  };

  const handleCustomURLChange = (url: string) => {
    setCustomConfig(provider, { baseURL: url });
    if (currentApiKey && currentModel) {
      try {
        aiService.configure(provider, currentApiKey, currentModel, undefined, {
          ...currentCustomConfig,
          baseURL: url,
        });
      } catch {
        // Silent fail
      }
    }
  };

  const handleCustomModelChange = (modelId: string) => {
    setCustomConfig(provider, { modelId });
    if (currentApiKey) {
      try {
        const effectiveModel = modelId || currentModel;
        aiService.configure(
          provider,
          currentApiKey,
          effectiveModel,
          undefined,
          { ...currentCustomConfig, modelId }
        );
      } catch {
        // Silent fail
      }
    }
  };

  const handleLocalURLChange = (url: string) => {
    setLocalConfig({ baseURL: url });
    setTestStatus('idle');
    setTestMessage('');
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      if (isLocalProvider) {
        if (!localConfig.baseURL) {
          setTestStatus('error');
          setTestMessage(
            t('settings.ai.local.noBaseURL', 'Please enter a server URL first')
          );
          return;
        }
        if (!validateLocalServerURL(localConfig.baseURL)) {
          setTestStatus('error');
          setTestMessage(
            t('settings.ai.local.invalidURL', 'Invalid server URL format')
          );
          return;
        }
        aiService.configure(provider, '', '', {
          baseURL: localConfig.baseURL,
          modelId: localConfig.modelId,
        });
      } else {
        if (!currentApiKey) {
          setTestStatus('error');
          setTestMessage(
            t('settings.ai.noApiKey', 'Please enter an API key first')
          );
          return;
        }
        if (!validateApiKeyFormat(provider, currentApiKey)) {
          setTestStatus('error');
          setTestMessage(
            t('settings.ai.invalidKeyFormat', 'Invalid API key format')
          );
          return;
        }
        const effectiveModel = currentCustomConfig.modelId || currentModel;
        aiService.configure(
          provider,
          currentApiKey,
          effectiveModel,
          undefined,
          currentCustomConfig
        );
      }

      const result = await aiService.testConnection();
      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message);
      } else {
        setTestStatus('error');
        setTestMessage(result.message);
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(
        error instanceof Error ? error.message : 'Connection test failed'
      );
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Provider Selection */}
      <div className="space-y-4">
        <SectionHeader title={t('settings.ai.provider', 'AI Provider')} />

        {/* Provider Dropdown */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('settings.ai.selectProvider', 'Provider')}
          </label>
          <Select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Local Provider Configuration */}
        {isLocalProvider && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {t(
                  'settings.ai.local.serverConfig',
                  'Local Server Configuration'
                )}
              </span>
            </div>

            {/* Server URL */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('settings.ai.local.baseURL', 'Server URL')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localConfig.baseURL}
                  onChange={(e) => handleLocalURLChange(e.target.value)}
                  placeholder="http://127.0.0.1:1234/v1"
                  className={clsx(
                    'flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                    'bg-background border-border text-foreground placeholder:text-muted-foreground'
                  )}
                />
                <button
                  onClick={fetchLocalModels}
                  disabled={loadingModels || !localConfig.baseURL}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm transition-all',
                    'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  title={t(
                    'settings.ai.local.refreshModels',
                    'Refresh available models'
                  )}
                >
                  <RefreshCw
                    className={clsx('w-4 h-4', loadingModels && 'animate-spin')}
                  />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  'settings.ai.local.baseURLHint',
                  'The base URL of your local AI server (LM Studio, Ollama, etc.). Usually ends with /v1'
                )}
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('settings.ai.model', 'Model')}
              </label>
              {localModels.length > 0 ? (
                <Select
                  value={localConfig.modelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {localModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <input
                  type="text"
                  value={localConfig.modelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  placeholder={t(
                    'settings.ai.local.modelPlaceholder',
                    'Model name (e.g., llama3)'
                  )}
                  className={clsx(
                    'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                    'bg-background border-border text-foreground placeholder:text-muted-foreground'
                  )}
                />
              )}
            </div>
          </div>
        )}

        {/* Cloud Provider Configuration */}
        {!isLocalProvider && (
          <>
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('settings.ai.model', 'Model')}
              </label>
              <Select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {providerConfig?.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('settings.ai.apiKey', 'API Key')}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={currentApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder={t(
                      'settings.ai.apiKeyPlaceholder',
                      'Enter your API key...'
                    )}
                    className={clsx(
                      'w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                      'bg-background border-border text-foreground placeholder:text-muted-foreground'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    'bg-primary text-primary-foreground hover:bg-primary/90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {testStatus === 'testing' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : testStatus === 'success' ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : testStatus === 'error' ? (
                    <XCircle className="w-4 h-4" />
                  ) : null}
                  {t('settings.ai.testConnection', 'Test')}
                </button>
              </div>
              {testMessage && (
                <p
                  className={clsx(
                    'text-xs mt-1',
                    testStatus === 'success' ? 'text-green-500' : 'text-red-500'
                  )}
                >
                  {testMessage}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  'settings.ai.apiKeyHint',
                  'Your API key is stored locally and never sent to our servers.'
                )}
              </p>
            </div>

            {/* Advanced Settings (Custom URL/Model) */}
            {supportsCustomURL && (
              <div className="pt-2">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                  <span>Advanced Settings</span>
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Custom Base URL (Optional)
                      </label>
                      <input
                        type="text"
                        value={currentCustomConfig.baseURL || ''}
                        onChange={(e) => handleCustomURLChange(e.target.value)}
                        placeholder={`https://api.${provider}.com/v1`}
                        className={clsx(
                          'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                          'bg-background border-border text-foreground placeholder:text-muted-foreground'
                        )}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use a custom endpoint (e.g., Azure OpenAI, proxy, or
                        compatible API)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Custom Model ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={currentCustomConfig.modelId || ''}
                        onChange={(e) =>
                          handleCustomModelChange(e.target.value)
                        }
                        placeholder="e.g., gpt-4-custom"
                        className={clsx(
                          'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                          'bg-background border-border text-foreground placeholder:text-muted-foreground'
                        )}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Override the model ID (useful for custom deployments)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Test Button for Local Provider */}
        {isLocalProvider && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !localConfig.baseURL}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {testStatus === 'testing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : testStatus === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : testStatus === 'error' ? (
                <XCircle className="w-4 h-4" />
              ) : null}
              {t('settings.ai.testConnection', 'Test')}
            </button>
            {testMessage && (
              <span
                className={clsx(
                  'text-xs',
                  testStatus === 'success' ? 'text-green-500' : 'text-red-500'
                )}
              >
                {testMessage}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="space-y-4">
        <SectionHeader title={t('settings.ai.features', 'Features')} />

        <div className="space-y-3">
          <Toggle
            label={t('settings.ai.inlineCompletion', 'Inline Completion')}
            description={t(
              'settings.ai.inlineCompletionDesc',
              'Get AI-powered code suggestions as you type'
            )}
            checked={enableInlineCompletion}
            onChange={setEnableInlineCompletion}
          />

          <Toggle
            label={t('settings.ai.chatPanel', 'AI Chat Panel')}
            description={t(
              'settings.ai.chatPanelDesc',
              'Open chat panel to ask questions about your code'
            )}
            checked={enableChat}
            onChange={setEnableChat}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('settings.ai.executionMode', 'Execution Mode')}
            </label>
            <Select
              value={executionMode}
              onChange={(e) =>
                setExecutionMode(e.target.value as AgentExecutionMode)
              }
            >
              <option value="agent">
                {t(
                  'settings.ai.executionModeAgent',
                  'Agent Mode (act directly)'
                )}
              </option>
              <option value="plan">
                {t(
                  'settings.ai.executionModePlan',
                  'Plan Mode (read-only planning)'
                )}
              </option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('settings.ai.agentProfile', 'Agent Profile')}
            </label>
            <Select
              value={agentProfile}
              onChange={(e) => setAgentProfile(e.target.value as AgentProfile)}
            >
              <option value="build">
                {t(
                  'settings.ai.agentProfileBuild',
                  'Build (read + write tools)'
                )}
              </option>
              <option value="plan">
                {t('settings.ai.agentProfilePlan', 'Plan (read-only tools)')}
              </option>
            </Select>
          </div>

          <Toggle
            label={t(
              'settings.ai.verifierSubagent',
              'Enable @verifier subagent'
            )}
            description={t(
              'settings.ai.verifierSubagentDesc',
              'Allow quick isolated validation with @verifier in chat'
            )}
            checked={enableVerifierSubagent}
            onChange={setEnableVerifierSubagent}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('settings.ai.toolPolicy', 'Tool Policy')}
            </label>
            <Select
              value={toolPolicyPreset}
              onChange={(e) =>
                setToolPolicyPreset(
                  e.target.value as Exclude<ToolPolicyPreset, 'custom'>
                )
              }
            >
              <option value="standard">
                {t('settings.ai.toolPolicyStandard', 'Standard (balanced)')}
              </option>
              <option value="safe">
                {t('settings.ai.toolPolicySafe', 'Safe (no write tools)')}
              </option>
              <option value="readonly">
                {t('settings.ai.toolPolicyReadonly', 'Read-only (analysis)')}
              </option>
              {toolPolicyPreset === 'custom' && (
                <option value="custom">
                  {t('settings.ai.toolPolicyCustom', 'Custom')}
                </option>
              )}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {toolPolicyPreset === 'standard'
                ? t(
                  'settings.ai.toolPolicyStandardHint',
                  'Balanced defaults with approval prompts for mutating tools.'
                )
                : toolPolicyPreset === 'safe'
                  ? t(
                    'settings.ai.toolPolicySafeHint',
                    'Blocks write/runtime groups; useful for safer review sessions.'
                  )
                  : toolPolicyPreset === 'readonly'
                    ? t(
                      'settings.ai.toolPolicyReadonlyHint',
                      'Restricts the agent to read/analysis-oriented tooling.'
                    )
                    : t(
                      'settings.ai.toolPolicyCustomHint',
                      'Custom policy is active from internal overrides.'
                    )}
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="space-y-4">
        <SectionHeader title={t('settings.ai.advanced', 'Advanced')} />

        <div className="space-y-4">
          <Slider
            label={t('settings.ai.maxTokens', 'Max Tokens')}
            value={maxTokens}
            onChange={setMaxTokens}
            min={256}
            max={8192}
            step={256}
          />

          <Slider
            label={t('settings.ai.temperature', 'Temperature')}
            value={temperature}
            onChange={setTemperature}
            min={0}
            max={2}
            step={0.1}
          />
          <p className="text-xs text-muted-foreground">
            {t(
              'settings.ai.temperatureHint',
              'Lower values for more focused output, higher for more creative'
            )}
          </p>
        </div>
      </div>
    </m.div>
  );
}
