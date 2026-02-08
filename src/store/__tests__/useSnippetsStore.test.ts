import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSnippetsStore } from '../useSnippetsStore';
import { act } from '@testing-library/react';

// Mock crypto.randomUUID for deterministic IDs
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

describe('useSnippetsStore', () => {
  beforeEach(() => {
    uuidCounter = 0;
    act(() => {
      // Clear all snippets
      const state = useSnippetsStore.getState();
      state.snippets.forEach((s) => state.removeSnippet(s.id));
    });
  });

  describe('initial state', () => {
    it('should start with empty snippets', () => {
      expect(useSnippetsStore.getState().snippets).toEqual([]);
    });
  });

  describe('addSnippet', () => {
    it('should add a snippet with generated id', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({
          name: 'Hello World',
          code: 'console.log("hello")',
        });
      });
      const snippets = useSnippetsStore.getState().snippets;
      expect(snippets).toHaveLength(1);
      expect(snippets[0]).toMatchObject({
        id: 'test-uuid-1',
        name: 'Hello World',
        code: 'console.log("hello")',
      });
    });

    it('should add multiple snippets', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({ name: 'A', code: 'a' });
        useSnippetsStore.getState().addSnippet({ name: 'B', code: 'b' });
      });
      expect(useSnippetsStore.getState().snippets).toHaveLength(2);
    });
  });

  describe('removeSnippet', () => {
    it('should remove a snippet by id', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({ name: 'A', code: 'a' });
        useSnippetsStore.getState().addSnippet({ name: 'B', code: 'b' });
      });
      const idToRemove = useSnippetsStore.getState().snippets[0].id;
      act(() => {
        useSnippetsStore.getState().removeSnippet(idToRemove);
      });
      const snippets = useSnippetsStore.getState().snippets;
      expect(snippets).toHaveLength(1);
      expect(snippets[0].name).toBe('B');
    });

    it('should do nothing for non-existent id', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({ name: 'A', code: 'a' });
        useSnippetsStore.getState().removeSnippet('nonexistent');
      });
      expect(useSnippetsStore.getState().snippets).toHaveLength(1);
    });
  });

  describe('updateSnippet', () => {
    it('should update snippet name', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({ name: 'Old', code: 'code' });
      });
      const id = useSnippetsStore.getState().snippets[0].id;
      act(() => {
        useSnippetsStore.getState().updateSnippet(id, { name: 'New' });
      });
      expect(useSnippetsStore.getState().snippets[0].name).toBe('New');
      expect(useSnippetsStore.getState().snippets[0].code).toBe('code');
    });

    it('should update snippet code', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({ name: 'Test', code: 'old' });
      });
      const id = useSnippetsStore.getState().snippets[0].id;
      act(() => {
        useSnippetsStore.getState().updateSnippet(id, { code: 'new code' });
      });
      expect(useSnippetsStore.getState().snippets[0].code).toBe('new code');
    });

    it('should not affect other snippets', () => {
      act(() => {
        useSnippetsStore.getState().addSnippet({ name: 'A', code: 'a' });
        useSnippetsStore.getState().addSnippet({ name: 'B', code: 'b' });
      });
      const id = useSnippetsStore.getState().snippets[0].id;
      act(() => {
        useSnippetsStore.getState().updateSnippet(id, { name: 'Updated A' });
      });
      expect(useSnippetsStore.getState().snippets[1].name).toBe('B');
    });
  });
});
