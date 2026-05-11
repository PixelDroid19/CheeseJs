import { describe, expect, it } from 'vitest';
import { createExtensionRegistry } from './extensionRegistry';

describe('ExtensionRegistry', () => {
  it('registers and filters extension contributions by capability', () => {
    const registry = createExtensionRegistry();

    registry.register({
      id: 'runtime.node-vm',
      capability: 'runtime',
      displayName: 'Node VM',
    });
    registry.register({
      id: 'theme.light',
      capability: 'theme',
      displayName: 'Light',
    });

    expect(registry.list('runtime')).toEqual([
      {
        id: 'runtime.node-vm',
        capability: 'runtime',
        displayName: 'Node VM',
        enabled: true,
      },
    ]);
  });

  it('prevents duplicate extension identifiers', () => {
    const registry = createExtensionRegistry();
    registry.register({
      id: 'language.python',
      capability: 'language',
      displayName: 'Python',
    });

    expect(() =>
      registry.register({
        id: 'language.python',
        capability: 'language',
        displayName: 'Python duplicate',
      })
    ).toThrow('Extension already registered: language.python');
  });

  it('can disable registered extensions without removing them', () => {
    const registry = createExtensionRegistry();
    registry.register({
      id: 'settings.formatting',
      capability: 'settings-tab',
      displayName: 'Formatting',
    });

    registry.setEnabled('settings.formatting', false);

    expect(registry.snapshot()).toEqual({
      extensions: [
        {
          id: 'settings.formatting',
          capability: 'settings-tab',
          displayName: 'Formatting',
          enabled: false,
        },
      ],
    });
  });
});
