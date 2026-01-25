import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTestStore } from '../../src/store/useTestStore';

describe('useTestStore', () => {
  beforeEach(() => {
    useTestStore.setState({
      files: new Map(),
      activeFile: null,
      coverage: new Map(),
      status: 'idle',
      isReady: false,
      error: null,
    });

    // Mock window.testRunner
    vi.stubGlobal('window', {
      testRunner: {
        run: vi.fn(),
        runSingle: vi.fn(),
        stop: vi.fn(),
      },
    });
  });

  it('should have initial state', () => {
    const state = useTestStore.getState();
    expect(state.status).toBe('idle');
    expect(state.files.size).toBe(0);
  });

  it('should add test file', () => {
    useTestStore.getState().addTestFile('test.spec.ts');

    const store = useTestStore.getState();
    expect(store.files.has('test.spec.ts')).toBe(true);
    expect(store.files.get('test.spec.ts')).toEqual({
      path: 'test.spec.ts',
      tests: [],
      status: 'idle',
    });
  });

  it('should update test result', () => {
    useTestStore.getState().addTestFile('test.spec.ts');

    useTestStore.getState().updateTestResult('test.spec.ts', {
      name: 'should work',
      fullName: 'Feature > should work',
      status: 'passed',
      duration: 5,
    });

    const store = useTestStore.getState();
    const file = store.files.get('test.spec.ts');
    expect(file?.tests).toHaveLength(1);
    expect(file?.tests[0].status).toBe('passed');
  });

  it('should update file status and calculate overall status', () => {
    useTestStore.getState().addTestFile('test.spec.ts');

    useTestStore.getState().updateFileStatus('test.spec.ts', 'running');
    expect(useTestStore.getState().status).toBe('running');

    useTestStore.getState().updateFileStatus('test.spec.ts', 'passed');
    expect(useTestStore.getState().status).toBe('passed');

    useTestStore.getState().addTestFile('fail.spec.ts');
    useTestStore.getState().updateFileStatus('fail.spec.ts', 'failed');
    expect(useTestStore.getState().status).toBe('failed');
  });

  it('should clear results', () => {
    useTestStore.getState().addTestFile('test.spec.ts');
    useTestStore.getState().updateTestResult('test.spec.ts', {
      name: 'test',
      fullName: 'test',
      status: 'passed',
    });

    useTestStore.getState().clearResults();

    const store = useTestStore.getState();
    const file = store.files.get('test.spec.ts');
    expect(file?.tests).toHaveLength(0);
    expect(file?.status).toBe('idle');
    expect(store.status).toBe('idle');
  });
});
