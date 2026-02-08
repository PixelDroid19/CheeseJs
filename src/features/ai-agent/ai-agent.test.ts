import { describe, it, expect, vi } from 'vitest';
import { cleanCompletionResponse } from './inlineCompletionProvider';
import { SYSTEM_PROMPTS, buildInlineCompletionPrompt } from './prompts';
import { processEditorActions } from './codeAgent';

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
});
