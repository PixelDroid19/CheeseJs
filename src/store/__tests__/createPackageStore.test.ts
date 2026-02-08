import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPackageStore,
  MAX_INSTALL_ATTEMPTS,
  selectPendingPackages,
  selectPackageByName,
} from '../createPackageStore';

describe('createPackageStore', () => {
  let useStore: ReturnType<typeof createPackageStore>;

  beforeEach(() => {
    useStore = createPackageStore();
  });

  describe('initial state', () => {
    it('should start with empty packages and no installing flag', () => {
      const state = useStore.getState();
      expect(state.packages).toEqual([]);
      expect(state.detectedMissingPackages).toEqual([]);
      expect(state.isInstalling).toBe(false);
    });
  });

  describe('addPackage', () => {
    it('should add a new package', () => {
      useStore.getState().addPackage('lodash');
      const state = useStore.getState();
      expect(state.packages).toHaveLength(1);
      expect(state.packages[0]).toMatchObject({
        name: 'lodash',
        installing: false,
        isInstalled: false,
        installAttempts: 0,
      });
    });

    it('should add a package with version', () => {
      useStore.getState().addPackage('lodash', '4.17.21');
      expect(useStore.getState().packages[0].version).toBe('4.17.21');
    });

    it('should not duplicate an existing package without error', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().addPackage('lodash');
      expect(useStore.getState().packages).toHaveLength(1);
    });

    it('should reset error state on re-add if under max attempts', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().setPackageError('lodash', 'failed');
      // Re-add should clear the error
      useStore.getState().addPackage('lodash');
      const pkg = useStore.getState().packages[0];
      expect(pkg.error).toBeUndefined();
      expect(pkg.installing).toBe(false);
      expect(pkg.isInstalled).toBe(false);
    });

    it('should not reset if max attempts reached', () => {
      useStore.getState().addPackage('lodash');
      // Max out attempts
      for (let i = 0; i < MAX_INSTALL_ATTEMPTS; i++) {
        useStore.getState().incrementInstallAttempt('lodash');
      }
      useStore.getState().setPackageError('lodash', 'failed');
      useStore.getState().addPackage('lodash');
      // Error should persist
      expect(useStore.getState().packages[0].error).toBe('failed');
    });
  });

  describe('setPackageInstalling', () => {
    it('should set installing flag on specific package', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().setPackageInstalling('lodash', true);
      const state = useStore.getState();
      expect(state.packages[0].installing).toBe(true);
      expect(state.isInstalling).toBe(true);
    });

    it('should clear error when setting installing', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().setPackageError('lodash', 'prev error');
      useStore.getState().setPackageInstalling('lodash', true);
      expect(useStore.getState().packages[0].error).toBeUndefined();
    });

    it('should update global isInstalling based on any package installing', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().addPackage('axios');
      useStore.getState().setPackageInstalling('lodash', true);
      expect(useStore.getState().isInstalling).toBe(true);
      useStore.getState().setPackageInstalling('lodash', false);
      expect(useStore.getState().isInstalling).toBe(false);
    });
  });

  describe('setPackageInstalled', () => {
    it('should mark package as installed', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().setPackageInstalled('lodash', '4.17.21');
      const pkg = useStore.getState().packages[0];
      expect(pkg.isInstalled).toBe(true);
      expect(pkg.installing).toBe(false);
      expect(pkg.error).toBeUndefined();
      expect(pkg.version).toBe('4.17.21');
    });

    it('should keep existing version if none provided', () => {
      useStore.getState().addPackage('lodash', '4.0.0');
      useStore.getState().setPackageInstalled('lodash');
      expect(useStore.getState().packages[0].version).toBe('4.0.0');
    });
  });

  describe('setPackageError', () => {
    it('should set error on a package', () => {
      useStore.getState().addPackage('badpkg');
      useStore.getState().setPackageError('badpkg', 'Network error', 'NETWORK');
      const pkg = useStore.getState().packages[0];
      expect(pkg.error).toBe('Network error');
      expect(pkg.installing).toBe(false);
      expect(pkg.isInstalled).toBe(false);
      expect(pkg.lastError).toMatchObject({
        code: 'NETWORK',
        message: 'Network error',
      });
      expect(pkg.lastError?.timestamp).toBeGreaterThan(0);
    });

    it('should use default error code if none provided', () => {
      useStore.getState().addPackage('badpkg');
      useStore.getState().setPackageError('badpkg', 'Something broke');
      expect(useStore.getState().packages[0].lastError?.code).toBe(
        'INSTALL_ERROR'
      );
    });

    it('should clear lastError when error message is undefined', () => {
      useStore.getState().addPackage('badpkg');
      useStore.getState().setPackageError('badpkg', 'err');
      useStore.getState().setPackageError('badpkg', undefined);
      expect(useStore.getState().packages[0].lastError).toBeUndefined();
    });
  });

  describe('removePackage', () => {
    it('should remove a package by name', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().addPackage('axios');
      useStore.getState().removePackage('lodash');
      expect(useStore.getState().packages).toHaveLength(1);
      expect(useStore.getState().packages[0].name).toBe('axios');
    });
  });

  describe('resetPackageAttempts', () => {
    it('should reset attempts, error, and lastError', () => {
      useStore.getState().addPackage('pkg');
      useStore.getState().incrementInstallAttempt('pkg');
      useStore.getState().setPackageError('pkg', 'err');
      useStore.getState().resetPackageAttempts('pkg');
      const pkg = useStore.getState().packages[0];
      expect(pkg.installAttempts).toBe(0);
      expect(pkg.error).toBeUndefined();
      expect(pkg.lastError).toBeUndefined();
    });
  });

  describe('canRetryInstall', () => {
    it('should return true for unknown packages', () => {
      expect(useStore.getState().canRetryInstall('unknown')).toBe(true);
    });

    it('should return true when under max attempts', () => {
      useStore.getState().addPackage('pkg');
      useStore.getState().incrementInstallAttempt('pkg');
      expect(useStore.getState().canRetryInstall('pkg')).toBe(true);
    });

    it('should return false when at max attempts', () => {
      useStore.getState().addPackage('pkg');
      for (let i = 0; i < MAX_INSTALL_ATTEMPTS; i++) {
        useStore.getState().incrementInstallAttempt('pkg');
      }
      expect(useStore.getState().canRetryInstall('pkg')).toBe(false);
    });
  });

  describe('incrementInstallAttempt', () => {
    it('should increment and return new count', () => {
      useStore.getState().addPackage('pkg');
      expect(useStore.getState().incrementInstallAttempt('pkg')).toBe(1);
      expect(useStore.getState().incrementInstallAttempt('pkg')).toBe(2);
      expect(useStore.getState().packages[0].installAttempts).toBe(2);
    });
  });

  describe('setDetectedMissingPackages', () => {
    it('should set the missing packages list', () => {
      useStore.getState().setDetectedMissingPackages(['lodash', 'axios']);
      expect(useStore.getState().detectedMissingPackages).toEqual([
        'lodash',
        'axios',
      ]);
    });
  });

  describe('selectors', () => {
    it('selectPendingPackages returns only non-installed packages', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().addPackage('axios');
      useStore.getState().setPackageInstalled('lodash');
      const pending = selectPendingPackages(useStore.getState());
      expect(pending).toHaveLength(1);
      expect(pending[0].name).toBe('axios');
    });

    it('selectPackageByName returns the right package', () => {
      useStore.getState().addPackage('lodash');
      useStore.getState().addPackage('axios');
      const selector = selectPackageByName('axios');
      const pkg = selector(useStore.getState());
      expect(pkg?.name).toBe('axios');
    });

    it('selectPackageByName returns undefined for missing', () => {
      const selector = selectPackageByName('nope');
      expect(selector(useStore.getState())).toBeUndefined();
    });
  });
});
