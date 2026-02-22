import { useAppStore } from '../index';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      const state = useAppStore.getState().snippets;
      state.snippets.forEach((s) => state.removeSnippet(s.id));
    });
  });

  describe('initial state', () => {
    it('should start with empty snippets', () => {
      expect(useAppStore.getState().snippets.snippets).toEqual([]);
    });
  });

  describe('addSnippet', () => {
    it('should add a snippet with generated id', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({
          name: 'Hello World',
          code: 'console.log("hello")',
        });
      });
      const snippets = useAppStore.getState().snippets.snippets;
      expect(snippets).toHaveLength(1);
      expect(snippets[0]).toMatchObject({
        id: 'test-uuid-1',
        name: 'Hello World',
        code: 'console.log("hello")',
      });
    });

    it('should add multiple snippets', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({ name: 'A', code: 'a' });
        useAppStore.getState().snippets.addSnippet({ name: 'B', code: 'b' });
      });
      expect(useAppStore.getState().snippets.snippets).toHaveLength(2);
    });
  });

  describe('removeSnippet', () => {
    it('should remove a snippet by id', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({ name: 'A', code: 'a' });
        useAppStore.getState().snippets.addSnippet({ name: 'B', code: 'b' });
      });
      const idToRemove = useAppStore.getState().snippets.snippets[0].id;
      act(() => {
        useAppStore.getState().snippets.removeSnippet(idToRemove);
      });
      const snippets = useAppStore.getState().snippets.snippets;
      expect(snippets).toHaveLength(1);
      expect(snippets[0].name).toBe('B');
    });

    it('should do nothing for non-existent id', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({ name: 'A', code: 'a' });
        useAppStore.getState().snippets.removeSnippet('nonexistent');
      });
      expect(useAppStore.getState().snippets.snippets).toHaveLength(1);
    });
  });

  describe('updateSnippet', () => {
    it('should update snippet name', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({ name: 'Old', code: 'code' });
      });
      const id = useAppStore.getState().snippets.snippets[0].id;
      act(() => {
        useAppStore.getState().snippets.updateSnippet(id, { name: 'New' });
      });
      expect(useAppStore.getState().snippets.snippets[0].name).toBe('New');
      expect(useAppStore.getState().snippets.snippets[0].code).toBe('code');
    });

    it('should update snippet code', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({ name: 'Test', code: 'old' });
      });
      const id = useAppStore.getState().snippets.snippets[0].id;
      act(() => {
        useAppStore.getState().snippets.updateSnippet(id, { code: 'new code' });
      });
      expect(useAppStore.getState().snippets.snippets[0].code).toBe('new code');
    });

    it('should not affect other snippets', () => {
      act(() => {
        useAppStore.getState().snippets.addSnippet({ name: 'A', code: 'a' });
        useAppStore.getState().snippets.addSnippet({ name: 'B', code: 'b' });
      });
      const id = useAppStore.getState().snippets.snippets[0].id;
      act(() => {
        useAppStore.getState().snippets.updateSnippet(id, { name: 'Updated A' });
      });
      expect(useAppStore.getState().snippets.snippets[1].name).toBe('B');
    });
  });
});
