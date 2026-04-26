import type { BasePackageInfo } from '@cheesejs/core';

export interface NpmPackageStoreAdapter {
  addPackage: (name: string, version?: string) => void;
  detectedMissingPackages: string[];
  incrementInstallAttempt: (name: string) => number;
  packages: BasePackageInfo[];
  removePackage: (name: string) => void;
  setPackageError: (name: string, error?: string, errorCode?: string) => void;
  setPackageInstalled: (name: string, version?: string) => void;
  setPackageInstalling: (name: string, installing: boolean) => void;
}

export interface PythonPackageStoreAdapter {
  addPackage: (name: string, version?: string) => void;
  detectedMissingPackages: string[];
  packages: BasePackageInfo[];
  removePackage: (name: string) => void;
  setPackageError: (name: string, error?: string, errorCode?: string) => void;
  setPackageInstalled: (name: string, version?: string) => void;
  setPackageInstalling: (name: string, installing: boolean) => void;
}

export interface NpmPackageSettingsAdapter {
  autoInstallPackages: boolean;
  autoRunAfterInstall: boolean;
  npmRcContent: string;
  setAutoInstallPackages: (value: boolean) => void;
  setAutoRunAfterInstall: (value: boolean) => void;
  setNpmRcContent: (value: string) => void;
}
