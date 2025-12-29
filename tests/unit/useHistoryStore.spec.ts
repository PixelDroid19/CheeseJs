import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '../../src/store/useHistoryStore';

describe('useHistoryStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  it('should add item to history', () => {
    useHistoryStore.getState().addToHistory({
      code: 'console.log("test")',
      language: 'javascript',
      status: 'success',
      executionTime: 100,
    });

    const history = useHistoryStore.getState().history;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      code: 'console.log("test")',
      language: 'javascript',
      status: 'success',
      executionTime: 100,
    });
    expect(history[0].id).toBeDefined();
    expect(history[0].timestamp).toBeDefined();
  });

  it('should limit history items to maxItems', () => {
    // Set small limit
    useHistoryStore.getState().setMaxItems(2);

    // Add 3 items
    useHistoryStore
      .getState()
      .addToHistory({ code: '1', language: 'javascript', status: 'success' });
    useHistoryStore
      .getState()
      .addToHistory({ code: '2', language: 'javascript', status: 'success' });
    useHistoryStore
      .getState()
      .addToHistory({ code: '3', language: 'javascript', status: 'success' });

    const history = useHistoryStore.getState().history;

    // Should have 2 items, and '3' should be the first (LIFO/Stack behavior for UI mostly, but array is usually prepended)
    // The implementation does: [newItem, ...state.history].slice(0, maxItems)
    // So '3' should be at index 0, '2' at index 1. '1' is dropped.

    expect(history).toHaveLength(2);
    expect(history[0].code).toBe('3');
    expect(history[1].code).toBe('2');
  });

  it('should clear history', () => {
    useHistoryStore
      .getState()
      .addToHistory({ code: '1', language: 'javascript', status: 'success' });
    expect(useHistoryStore.getState().history).toHaveLength(1);

    useHistoryStore.getState().clearHistory();
    expect(useHistoryStore.getState().history).toHaveLength(0);
  });
});
