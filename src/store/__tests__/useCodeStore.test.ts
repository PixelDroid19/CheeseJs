import { useAppStore } from '../index';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCodeStore } from '../storeHooks';
import { MAX_RESULTS } from '../../types/workerTypes';

describe('useCodeStore', () => {
  beforeEach(() => {
    // Reset store to default values
    useCodeStore.setState({
      code: 'console.log("Hello World");',
      result: [],
      isExecuting: false,
      isPendingRun: false,
    });
    localStorage.clear();
  });

  describe('code management', () => {
    it('should have default code', () => {
      const state = useAppStore.getState().code;
      expect(state.code).toBe('console.log("Hello World");');
    });

    it('should update code', () => {
      const { setCode } = useAppStore.getState().code;
      setCode('const x = 5;');
      expect(useAppStore.getState().code.code).toBe('const x = 5;');
    });

    it('should handle empty code', () => {
      const { setCode } = useAppStore.getState().code;
      setCode('');
      expect(useAppStore.getState().code.code).toBe('');
    });
  });

  describe('result management', () => {
    it('should start with empty results', () => {
      const state = useAppStore.getState().code;
      expect(state.result).toEqual([]);
    });

    it('should set results', () => {
      const { setResult } = useAppStore.getState().code;
      const mockResult = [
        {
          element: { content: 'test' },
          type: 'execution' as const,
          lineNumber: 1,
        },
      ];
      setResult(mockResult);
      expect(useAppStore.getState().code.result).toEqual(mockResult);
    });

    it('should append results', () => {
      const { setResult, appendResult } = useAppStore.getState().code;
      setResult([
        {
          element: { content: 'first' },
          type: 'execution' as const,
          lineNumber: 1,
        },
      ]);
      appendResult({
        element: { content: 'second' },
        type: 'execution' as const,
        lineNumber: 2,
      });
      expect(useAppStore.getState().code.result).toHaveLength(2);
    });

    it('should clear results', () => {
      const { setResult, clearResult } = useAppStore.getState().code;
      setResult([
        {
          element: { content: 'test' },
          type: 'execution' as const,
          lineNumber: 1,
        },
      ]);
      clearResult();
      expect(useAppStore.getState().code.result).toEqual([]);
    });

    it('should enforce MAX_RESULTS limit on setResult', () => {
      const { setResult } = useAppStore.getState().code;
      const manyResults = Array.from({ length: MAX_RESULTS + 50 }, (_, i) => ({
        element: { content: `result-${i}` },
        type: 'execution' as const,
        lineNumber: i,
      }));
      setResult(manyResults);
      expect(useAppStore.getState().code.result).toHaveLength(MAX_RESULTS);
    });

    it('should enforce MAX_RESULTS limit on appendResult', () => {
      const { setResult, appendResult } = useAppStore.getState().code;
      // Set MAX_RESULTS items
      const initialResults = Array.from({ length: MAX_RESULTS }, (_, i) => ({
        element: { content: `result-${i}` },
        type: 'execution' as const,
        lineNumber: i,
      }));
      setResult(initialResults);

      // Append one more
      appendResult({
        element: { content: 'extra' },
        type: 'execution' as const,
        lineNumber: MAX_RESULTS,
      });

      expect(useAppStore.getState().code.result).toHaveLength(MAX_RESULTS);
      // The newest result should be present
      expect(
        useAppStore.getState().code.result[MAX_RESULTS - 1].element.content
      ).toBe('extra');
    });
  });

  describe('execution state', () => {
    it('should start with isExecuting false', () => {
      const state = useAppStore.getState().code;
      expect(state.isExecuting).toBe(false);
    });

    it('should update isExecuting', () => {
      const { setIsExecuting } = useAppStore.getState().code;
      setIsExecuting(true);
      expect(useAppStore.getState().code.isExecuting).toBe(true);
    });

    it('should start with isPendingRun false', () => {
      const state = useAppStore.getState().code;
      expect(state.isPendingRun).toBe(false);
    });

    it('should update isPendingRun', () => {
      const { setIsPendingRun } = useAppStore.getState().code;
      setIsPendingRun(true);
      expect(useAppStore.getState().code.isPendingRun).toBe(true);
    });
  });

  describe('result types', () => {
    it('should handle execution type results', () => {
      const { appendResult } = useAppStore.getState().code;
      appendResult({
        element: { content: 42 },
        type: 'execution',
        lineNumber: 1,
      });

      const result = useAppStore.getState().code.result[0];
      expect(result.type).toBe('execution');
    });

    it('should handle error type results', () => {
      const { appendResult } = useAppStore.getState().code;
      appendResult({
        element: { content: 'Error: Something went wrong' },
        type: 'error',
        lineNumber: 1,
      });

      const result = useAppStore.getState().code.result[0];
      expect(result.type).toBe('error');
    });

    it('should handle results with actions', () => {
      const { appendResult } = useAppStore.getState().code;
      appendResult({
        element: { content: 'Module not found: lodash' },
        type: 'error',
        lineNumber: 1,
        action: {
          type: 'install-package',
          payload: 'lodash',
        },
      });

      const result = useAppStore.getState().code.result[0];
      expect(result.action).toBeDefined();
      expect(result.action?.type).toBe('install-package');
      expect(result.action?.payload).toBe('lodash');
    });

    it('should handle different content types', () => {
      const { setResult } = useAppStore.getState().code;
      setResult([
        { element: { content: 'string' }, type: 'execution', lineNumber: 1 },
        { element: { content: 123 }, type: 'execution', lineNumber: 2 },
        { element: { content: true }, type: 'execution', lineNumber: 3 },
        {
          element: { content: { key: 'value' } },
          type: 'execution',
          lineNumber: 4,
        },
        { element: { content: null }, type: 'execution', lineNumber: 5 },
      ]);

      const results = useAppStore.getState().code.result;
      expect(results[0].element.content).toBe('string');
      expect(results[1].element.content).toBe(123);
      expect(results[2].element.content).toBe(true);
      expect(results[3].element.content).toEqual({ key: 'value' });
      expect(results[4].element.content).toBeNull();
    });

    it('should handle console types', () => {
      const { appendResult } = useAppStore.getState().code;
      appendResult({
        element: { content: 'log message', consoleType: 'log' },
        type: 'execution',
        lineNumber: 1,
      });

      const result = useAppStore.getState().code.result[0];
      expect(result.element.consoleType).toBe('log');
    });
  });
});
