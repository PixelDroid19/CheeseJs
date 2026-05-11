export type ExtensionCapability =
  | 'runtime'
  | 'language'
  | 'editor-command'
  | 'settings-tab'
  | 'package-manager'
  | 'theme'
  | 'assistant';

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

export class ExtensionRegistry {
  private readonly extensions = new Map<string, RegisteredExtension>();

  register<TConfig>(
    contribution: ExtensionContribution<TConfig>
  ): RegisteredExtension<TConfig> {
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
