import { describe, it, expect, vi } from 'vitest';
import { cleanCompletionResponse } from './inlineCompletionProvider';
import { SYSTEM_PROMPTS, buildInlineCompletionPrompt } from './prompts';
import {
  sanitizeAssistantOutput,
  extractCodeForDirectEdit,
  isDirectEditIntent,
  buildStructuredPlanPrompt,
  extractExecutionPlanFromText,
} from './codeAgent';
import {
  getDefaultProfileForMode,
  isToolAllowedForProfile,
} from './agentProfiles';
import { resolveToolsForExecution } from './toolRegistry';
import { getSystemPromptForMode, resolveAgentRuntime } from './agentRuntime';
import { getToolPolicyPreset } from './toolPolicy';
import { buildAssistantMessagePayload } from './messageParts';
import { getChatMessageDisplayContent } from './types';

// Mock dependencies
vi.mock('./aiService', () => ({
  aiService: {
    generateInlineCompletion: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../store/storeHooks', () => ({
  useAISettingsStore: {
    getState: vi.fn().mockReturnValue({
      enableInlineCompletion: true,
      getCurrentApiKey: vi.fn().mockReturnValue('test-key'),
    }),
  },
}));

describe('AI Agent Feature', () => {
  describe('cleanCompletionResponse', () => {
    it('should remove markdown code blocks', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const output = cleanCompletionResponse(input, '');
      expect(output).toBe('const x = 1;');
    });

    it('should preserve quoted strings (could be valid code)', () => {
      const input = '"const x = 1;"';
      const output = cleanCompletionResponse(input, '');
      expect(output).toBe('"const x = 1;"');
    });

    it('should remove common AI prefixes', () => {
      const input = 'Here is the code: const x = 1;';
      const output = cleanCompletionResponse(input, '');
      expect(output).toBe('const x = 1;');
    });

    it('should not repeat the current line', () => {
      const currentLine = 'const x = ';
      const input = 'const x = 1;';
      const output = cleanCompletionResponse(input, currentLine);
      expect(output).toBe('1;');
    });
  });

  describe('Prompts', () => {
    it('should have strict rules for inline completion', () => {
      expect(SYSTEM_PROMPTS.inlineCompletion).toContain('RULES');
      expect(SYSTEM_PROMPTS.inlineCompletion).toContain('NO markdown');
      expect(SYSTEM_PROMPTS.inlineCompletion).toContain('Output ONLY');
    });

    it('should build inline completion prompt correctly', () => {
      const context = {
        language: 'typescript',
        codeBefore: 'const x = ',
        codeAfter: '',
      };
      const prompt = buildInlineCompletionPrompt(context);
      expect(prompt).toContain('[LANG] typescript');
      expect(prompt).toContain('const x = <CURSOR>');
    });
  });

  describe('sanitizeAssistantOutput', () => {
    it('should remove think blocks and editor action blocks', () => {
      const input = `
Hello
<think>hidden chain of thought</think>
<<<EDITOR_ACTION>>>
{"action":"replaceAll","code":"const x = 1;"}
<<<END_ACTION>>>
Done.
      `;

      const output = sanitizeAssistantOutput(input);
      expect(output).toContain('Hello');
      expect(output).toContain('Done.');
      expect(output).not.toContain('<think>');
      expect(output).not.toContain('<<<EDITOR_ACTION>>>');
    });

    it('should hide trailing unclosed think block while streaming', () => {
      const input = 'Visible text\n<think>internal reasoning still streaming';
      expect(sanitizeAssistantOutput(input)).toBe('Visible text');
    });

    it('should keep think blocks when showThinking is enabled', () => {
      const input = 'Visible\n<think>internal</think>\nDone';
      expect(
        sanitizeAssistantOutput(input, {
          showThinking: true,
        })
      ).toContain('<think>internal</think>');
    });
  });

  describe('extractCodeForDirectEdit', () => {
    it('should extract code from fenced block', () => {
      const text = 'Here you go:\n```js\nfunction fib(n){return n;}\n```';
      expect(extractCodeForDirectEdit(text)).toBe('function fib(n){return n;}');
    });

    it('should return null for plain non-code prose', () => {
      const text = 'I suggest creating a function and testing edge cases.';
      expect(extractCodeForDirectEdit(text)).toBeNull();
    });
  });

  describe('isDirectEditIntent', () => {
    it('should detect direct edit intent in Spanish', () => {
      expect(isDirectEditIntent('crea una función fibonacci.js')).toBe(true);
    });

    it('should detect non-edit queries', () => {
      expect(isDirectEditIntent('explica este error de typescript')).toBe(
        false
      );
    });
  });

  describe('structured execution plan', () => {
    it('should include plan JSON markers in planning prompt', () => {
      const prompt = buildStructuredPlanPrompt('Refactor auth module');
      expect(prompt).toContain('<<<PLAN_JSON_START>>>');
      expect(prompt).toContain('<<<PLAN_JSON_END>>>');
      expect(prompt).toContain('Refactor auth module');
    });

    it('should parse valid plan JSON into normalized execution plan', () => {
      const raw = [
        'Summary in markdown',
        '<<<PLAN_JSON_START>>>',
        JSON.stringify({
          goal: 'Improve test reliability',
          assumptions: ['Tests are flaky in CI'],
          tasks: [
            {
              id: 'task-1',
              title: 'Stabilize test setup',
              description: 'Reset shared state before each test',
              dependencies: [],
              prompt: 'Update setup hooks and rerun tests',
            },
            {
              title: 'Add retries for known flaky suite',
              description: 'Only for e2e smoke tests',
              dependencies: ['task-1'],
              prompt: 'Configure retries in test runner',
            },
          ],
        }),
        '<<<PLAN_JSON_END>>>',
      ].join('\n');

      const plan = extractExecutionPlanFromText(raw);
      expect(plan).not.toBeNull();
      expect(plan?.goal).toBe('Improve test reliability');
      expect(plan?.status).toBe('ready');
      expect(plan?.tasks).toHaveLength(2);
      expect(plan?.tasks[0].status).toBe('pending');
      expect(plan?.tasks[1].id).toBe('task-2');
      expect(plan?.tasks[1].dependencies).toEqual(['task-1']);
    });

    it('should return null when markers are missing', () => {
      expect(extractExecutionPlanFromText('{"goal":"x"}')).toBeNull();
    });
  });

  describe('agent profiles and tool permissions', () => {
    it('should map execution mode to default profile', () => {
      expect(getDefaultProfileForMode('agent')).toBe('build');
      expect(getDefaultProfileForMode('plan')).toBe('plan');
      expect(getDefaultProfileForMode('verifier')).toBe('plan');
    });

    it('should allow write tools only for build profile', () => {
      expect(isToolAllowedForProfile('build', 'writeFile')).toBe(true);
      expect(isToolAllowedForProfile('plan', 'writeFile')).toBe(false);
      expect(isToolAllowedForProfile('plan', 'deleteFile')).toBe(false);
      expect(isToolAllowedForProfile('plan', 'readFile')).toBe(true);
    });

    it('should filter registry tools for plan profile in agent mode', () => {
      const registry = {
        readFile: { test: true },
        writeFile: { test: true },
        replaceAll: { test: true },
      };

      const filtered = resolveToolsForExecution(registry, 'agent', 'plan');
      expect(Object.keys(filtered)).toEqual(['readFile']);
    });

    it('should filter write tools automatically in plan mode', () => {
      const registry = {
        readFile: { test: true },
        writeFile: { test: true },
        replaceSelection: { test: true },
        getWorkspacePath: { test: true },
      };

      const filtered = resolveToolsForExecution(registry, 'plan', 'build');
      expect(Object.keys(filtered).sort()).toEqual(
        ['getWorkspacePath', 'readFile'].sort()
      );
    });

    it('should resolve runtime defaults and plan limits', () => {
      const defaultRuntime = resolveAgentRuntime();
      expect(defaultRuntime.mode).toBe('agent');
      expect(defaultRuntime.profile).toBe('build');
      expect(defaultRuntime.maxSteps).toBe(5);

      const planRuntime = resolveAgentRuntime({ mode: 'plan' });
      expect(planRuntime.profile).toBe('plan');
      expect(planRuntime.maxSteps).toBe(3);
    });

    it('should use legacy prompt when tools are disabled', () => {
      const prompt = getSystemPromptForMode('agent', true);
      expect(prompt).toContain('DIRECT ACCESS to the code editor');
      expect(prompt).toContain('<<<EDITOR_ACTION>>>');
    });

    it('should apply safe preset to block write tools', () => {
      const registry = {
        readFile: { test: true },
        writeFile: { test: true },
        replaceAll: { test: true },
      };

      const filtered = resolveToolsForExecution(registry, 'agent', 'build', [
        getToolPolicyPreset('safe'),
      ]);

      expect(Object.keys(filtered)).toEqual(['readFile']);
    });

    it('should apply readonly preset to keep analysis/workspace tools', () => {
      const registry = {
        readFile: { test: true },
        listFiles: { test: true },
        searchInFiles: { test: true },
        searchDocumentation: { test: true },
        writeFile: { test: true },
      };

      const filtered = resolveToolsForExecution(registry, 'agent', 'build', [
        getToolPolicyPreset('readonly'),
      ]);

      expect(Object.keys(filtered).sort()).toEqual(
        ['readFile', 'listFiles', 'searchInFiles', 'searchDocumentation'].sort()
      );
    });
  });

  describe('structured chat message payload', () => {
    it('should build assistant payload with markdown and tool parts', () => {
      const payload = buildAssistantMessagePayload({
        rawText: 'Hello from assistant',
        showThinking: false,
        runId: 42,
        mode: 'agent',
        model: 'test-model',
        toolInvocations: [
          {
            id: 'inv-1',
            toolName: 'readFile',
            state: 'completed',
            input: { path: 'src/index.ts' },
            output: { success: true },
          },
        ],
      });

      expect(payload.content).toBe('Hello from assistant');
      expect(payload.contentParts.some((p) => p.type === 'markdown')).toBe(
        true
      );
      expect(payload.contentParts.some((p) => p.type === 'tool-call')).toBe(
        true
      );
      expect(payload.metadata.runId).toBe(42);
      expect(payload.metadata.model).toBe('test-model');
    });

    it('should include reasoning parts when showThinking is enabled', () => {
      const payload = buildAssistantMessagePayload({
        rawText: 'Visible\n<think>private reasoning</think>\nDone',
        showThinking: true,
        runId: 1,
        mode: 'plan',
        model: 'planner',
      });

      expect(payload.content).toContain('Visible');
      expect(payload.content).toContain('Done');
      expect(payload.content).not.toContain('<think>');
      expect(payload.contentParts.some((p) => p.type === 'reasoning')).toBe(
        true
      );
    });
  });

  describe('chat display content fallback', () => {
    it('should prefer content when present', () => {
      const text = getChatMessageDisplayContent({
        id: 'm1',
        role: 'assistant',
        content: 'Primary content',
        timestamp: Date.now(),
        contentParts: [{ type: 'text', text: 'Secondary part' }],
      });

      expect(text).toBe('Primary content');
    });

    it('should derive fallback text from contentParts when content is empty', () => {
      const text = getChatMessageDisplayContent({
        id: 'm2',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        contentParts: [
          { type: 'markdown', text: 'First part' },
          {
            type: 'tool-call',
            toolName: 'readFile',
            state: 'completed',
            summary: 'input: path',
          },
        ],
      });

      expect(text).toContain('First part');
      expect(text).toContain('readFile');
    });
  });
});
