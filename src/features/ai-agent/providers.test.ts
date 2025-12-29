import { describe, it, expect } from 'vitest';
import { validateApiKeyFormat, validateLocalServerURL } from './providers';

describe('AI Providers', () => {
  describe('Privacy & Validation', () => {
    it('should allow empty API key for local provider', () => {
      expect(validateApiKeyFormat('local', '')).toBe(true);
      expect(validateApiKeyFormat('local', '  ')).toBe(true);
    });

    it('should require API key for cloud providers', () => {
      expect(validateApiKeyFormat('openai', '')).toBe(false);
      expect(validateApiKeyFormat('anthropic', '')).toBe(false);
      expect(validateApiKeyFormat('google', '')).toBe(false);
    });

    it('should validate local server URL', () => {
      expect(validateLocalServerURL('http://localhost:1234')).toBe(true);
      expect(validateLocalServerURL('invalid-url')).toBe(false);
      expect(validateLocalServerURL('')).toBe(false);
    });
  });
});
