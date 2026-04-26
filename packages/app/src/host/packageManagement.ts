export async function installNpmPackage(packageName: string) {
  if (!window.packageManager) {
    throw new Error('Package manager not available');
  }

  return window.packageManager.install(packageName);
}

export async function listInstalledNpmPackages() {
  if (!window.packageManager) {
    return { success: false as const, packages: [] as const };
  }

  return window.packageManager.list();
}

export async function uninstallNpmPackage(packageName: string) {
  if (!window.packageManager) {
    throw new Error('Package manager not available');
  }

  return window.packageManager.uninstall(packageName);
}

export async function installPythonPackage(packageName: string) {
  if (!window.pythonPackageManager) {
    throw new Error('Python package manager not available');
  }

  return window.pythonPackageManager.install(packageName);
}

export async function listInstalledPythonPackages() {
  if (!window.pythonPackageManager) {
    return { success: false as const, packages: [] as const };
  }

  return window.pythonPackageManager.listInstalled();
}
