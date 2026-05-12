import { describe, expect, it, vi } from 'vitest';
import { createCoreRuntime } from './coreRuntime';

interface CoreRuntimeTestEvents {
  'runtime.ready': { runtimeId: string };
}

describe('createCoreRuntime', () => {
  it('keeps extension metadata and event dispatch in the core layer', () => {
    const runtime = createCoreRuntime<CoreRuntimeTestEvents>();
    const handler = vi.fn();

    runtime.events.subscribe('runtime.ready', handler);
    runtime.extensions.register({
      id: 'javascript.runtime',
      capability: 'runtime',
      displayName: 'JavaScript Runtime',
    });

    runtime.events.emit('runtime.ready', { runtimeId: 'javascript' });

    expect(handler).toHaveBeenCalledWith({ runtimeId: 'javascript' });
    expect(runtime.snapshot().extensions).toEqual([
      {
        id: 'javascript.runtime',
        capability: 'runtime',
        displayName: 'JavaScript Runtime',
        enabled: true,
      },
    ]);
  });
});
