/**
 * A feature surface that can be contributed by a package or future external
 * plugin. Capabilities are intentionally coarse: they describe what a feature
 * is allowed to extend without coupling core to implementation details.
 */
export type ExtensionCapability =
  | 'runtime'
  | 'language'
  | 'editor-command'
  | 'settings-tab'
  | 'package-manager'
  | 'theme'
  | 'assistant';

/**
 * Metadata provided by a feature package when it attaches to the core layer.
 *
 * @template TConfig Serializable configuration owned by the contributing
 * package. Core stores it as opaque data and never interprets feature-specific
 * fields.
 */
export interface ExtensionContribution<TConfig = unknown> {
  id: string;
  capability: ExtensionCapability;
  displayName: string;
  config?: TConfig;
}

export interface RegisteredExtension<
  TConfig = unknown,
> extends ExtensionContribution<TConfig> {
  enabled: boolean;
}

export interface ExtensionRegistrySnapshot {
  extensions: RegisteredExtension[];
}

/**
 * In-memory registry for modular CheeseJS features.
 *
 * Core deliberately stores only metadata here. Feature code remains in packages
 * or plugins, which keeps the core small and prevents package-specific logic
 * from leaking into the core layer.
 */
export class ExtensionRegistry {
  private readonly extensions = new Map<string, RegisteredExtension>();

  /** Register a contribution and enable it immediately. */
  register<TConfig>(
    contribution: ExtensionContribution<TConfig>
  ): RegisteredExtension<TConfig> {
    validateContribution(contribution);
    if (this.extensions.has(contribution.id)) {
      throw new Error(`Extension already registered: ${contribution.id}`);
    }

    const registered: RegisteredExtension<TConfig> = {
      ...contribution,
      enabled: true,
    };
    this.extensions.set(contribution.id, registered);
    return registered;
  }

  unregister(extensionId: string): boolean {
    return this.extensions.delete(extensionId);
  }

  /**
   * Toggle whether a registered contribution participates in active lookups.
   *
   * @throws Error when the id is not registered.
   */
  setEnabled(extensionId: string, enabled: boolean): void {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Unknown extension: ${extensionId}`);
    }

    extension.enabled = enabled;
  }

  list(capability?: ExtensionCapability): RegisteredExtension[] {
    const values = Array.from(this.extensions.values());
    return capability
      ? values.filter((extension) => extension.capability === capability)
      : values;
  }

  snapshot(): ExtensionRegistrySnapshot {
    return { extensions: this.list().map((extension) => ({ ...extension })) };
  }
}

export function createExtensionRegistry(): ExtensionRegistry {
  return new ExtensionRegistry();
}

function validateContribution(contribution: ExtensionContribution): void {
  if (!contribution.id.trim()) {
    throw new Error('Extension id is required.');
  }

  if (!contribution.displayName.trim()) {
    throw new Error(`Extension displayName is required: ${contribution.id}`);
  }
}
