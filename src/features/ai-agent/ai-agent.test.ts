import { describe, it, expect, vi } from 'vitest';
import { cleanCompletionResponse } from './inlineCompletionProvider';
import { SYSTEM_PROMPTS, buildInlineCompletionPrompt } from './prompts';
import {
  processEditorActions,
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

// Mock dependencies
vi.mock('./aiService', () => ({
  aiService: {
    generateInlineCompletion: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('../../store/useAISettingsStore', () => ({
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

  describe('processEditorActions', () => {
    it('should extract and execute EDITOR_ACTION', () => {
      const callbacks = {
        onToolInvocation: vi.fn(),
        onReplaceAll: vi.fn(),
      };

      const text = `
Here is the code:
<<<EDITOR_ACTION>>>
{"action": "replaceAll", "code": "const x = 1;"}
<<<END_ACTION>>>
Hope that helps!
      `;

      processEditorActions(text, callbacks);

      expect(callbacks.onReplaceAll).toHaveBeenCalledWith('const x = 1;');
      expect(callbacks.onToolInvocation).toHaveBeenCalledTimes(2); // running, completed
      expect(callbacks.onToolInvocation).toHaveBeenLastCalledWith(
        expect.objectContaining({
          state: 'completed',
          output: { success: true },
        })
      );
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const callbacks = {
        onToolInvocation: vi.fn(),
      };

      const text = `
<<<EDITOR_ACTION>>>
{invalid json}
<<<END_ACTION>>>
      `;

      processEditorActions(text, callbacks);

      expect(callbacks.onToolInvocation).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse editor action'),
        expect.any(Error)
      );
      consoleSpy.mockRestore();
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
  });
});
