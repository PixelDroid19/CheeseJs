/**
 * Native Package Manager for Electron
 * 
 * Handles npm package installation in a temporary directory
 * and makes them available for code execution in the VM sandbox.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface PackageInstallResult {
  success: boolean
  packageName: string
  version?: string
  error?: string
}

export interface InstalledPackage {
  name: string
  version: string
  path: string
}

// Directory where packages are installed
let packagesDir: string

/**
 * Initialize the packages directory
 */
export async function initPackagesDirectory(): Promise<string> {
  // Use app.getPath('userData') for persistent storage
  packagesDir = path.join(app.getPath('userData'), 'packages')
  
  try {
    await fs.mkdir(packagesDir, { recursive: true })
    
    // Create package.json if it doesn't exist
    const packageJsonPath = path.join(packagesDir, 'package.json')
    try {
      await fs.access(packageJsonPath)
    } catch {
      await fs.writeFile(packageJsonPath, JSON.stringify({
        name: 'cheesejs-packages',
        version: '1.0.0',
        private: true,
        description: 'CheeseJS installed packages'
      }, null, 2))
    }
    
    // Create a dummy index.js for Module.createRequire
    const indexJsPath = path.join(packagesDir, 'index.js')
    try {
      await fs.access(indexJsPath)
    } catch {
      await fs.writeFile(indexJsPath, '// CheeseJS packages entry point\n')
    }
    
    // Ensure node_modules directory exists
    const nodeModulesPath = path.join(packagesDir, 'node_modules')
    await fs.mkdir(nodeModulesPath, { recursive: true })
    
    console.log('[PackageManager] Packages directory initialized:', packagesDir)
    return packagesDir
  } catch (error) {
    console.error('[PackageManager] Failed to initialize packages directory:', error)
    throw error
  }
}

/**
 * Get the packages directory path
 */
export function getPackagesDir(): string {
  return packagesDir
}

/**
 * Get the node_modules path
 */
export function getNodeModulesPath(): string {
  return path.join(packagesDir, 'node_modules')
}

/**
 * Install a package using npm
 */
export async function installPackage(packageName: string): Promise<PackageInstallResult> {
  if (!packagesDir) {
    await initPackagesDirectory()
  }

  console.log(`[PackageManager] Installing package: ${packageName}`)

  return new Promise((resolve) => {
    // Parse package name and version
    const [name, version] = packageName.includes('@') && !packageName.startsWith('@')
      ? packageName.split('@')
      : [packageName, 'latest']
    
    const packageSpec = version && version !== 'latest' ? `${name}@${version}` : name

    // Use npm to install the package
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const args = ['install', packageSpec, '--save', '--legacy-peer-deps']

    console.log(`[PackageManager] Running: ${npm} ${args.join(' ')} in ${packagesDir}`)

    const child = spawn(npm, args, {
      cwd: packagesDir,
      shell: true,
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
      console.log(`[PackageManager] stdout: ${data}`)
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
      console.log(`[PackageManager] stderr: ${data}`)
    })

    child.on('close', async (code) => {
      if (code === 0) {
        // Get installed version from package.json
        try {
          const installedVersion = await getPackageVersion(name)
          console.log(`[PackageManager] Successfully installed ${name}@${installedVersion}`)
          resolve({
            success: true,
            packageName: name,
            version: installedVersion
          })
        } catch {
          resolve({
            success: true,
            packageName: name,
            version: version
          })
        }
      } else {
        console.error(`[PackageManager] Failed to install ${packageName}:`, stderr)
        resolve({
          success: false,
          packageName: name,
          error: stderr || `npm install failed with code ${code}`
        })
      }
    })

    child.on('error', (error) => {
      console.error(`[PackageManager] Spawn error:`, error)
      resolve({
        success: false,
        packageName: name,
        error: error.message
      })
    })
  })
}

/**
 * Uninstall a package
 */
export async function uninstallPackage(packageName: string): Promise<PackageInstallResult> {
  if (!packagesDir) {
    await initPackagesDirectory()
  }

  console.log(`[PackageManager] Uninstalling package: ${packageName}`)

  return new Promise((resolve) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const args = ['uninstall', packageName, '--save']

    const child = spawn(npm, args, {
      cwd: packagesDir,
      shell: true,
      env: { ...process.env }
    })

    let stderr = ''

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[PackageManager] Successfully uninstalled ${packageName}`)
        resolve({
          success: true,
          packageName
        })
      } else {
        console.error(`[PackageManager] Failed to uninstall ${packageName}:`, stderr)
        resolve({
          success: false,
          packageName,
          error: stderr || `npm uninstall failed with code ${code}`
        })
      }
    })

    child.on('error', (error) => {
      resolve({
        success: false,
        packageName,
        error: error.message
      })
    })
  })
}

/**
 * Get version of an installed package
 */
async function getPackageVersion(packageName: string): Promise<string> {
  const packageJsonPath = path.join(packagesDir, 'node_modules', packageName, 'package.json')
  const content = await fs.readFile(packageJsonPath, 'utf-8')
  const pkg = JSON.parse(content)
  return pkg.version
}

/**
 * List all installed packages
 */
export async function listInstalledPackages(): Promise<InstalledPackage[]> {
  if (!packagesDir) {
    await initPackagesDirectory()
  }

  const packages: InstalledPackage[] = []
  const packageJsonPath = path.join(packagesDir, 'package.json')

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    const dependencies = pkg.dependencies || {}

    for (const [name, version] of Object.entries(dependencies)) {
      packages.push({
        name,
        version: (version as string).replace(/^\^|~/, ''),
        path: path.join(packagesDir, 'node_modules', name)
      })
    }
  } catch (error) {
    console.error('[PackageManager] Failed to list packages:', error)
  }

  return packages
}

/**
 * Check if a package is installed
 */
export async function isPackageInstalled(packageName: string): Promise<boolean> {
  const nodeModulesPath = path.join(packagesDir, 'node_modules', packageName)
  try {
    await fs.access(nodeModulesPath)
    return true
  } catch {
    return false
  }
}

/**
 * Create a require function that can load installed packages
 */
export function createPackageRequire(): (moduleName: string) => unknown {
  const nodeModulesPath = getNodeModulesPath()
  
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Module = require('module')
  
  return (moduleName: string) => {
    // Try to resolve from our packages directory
    const modulePath = path.join(nodeModulesPath, moduleName)
    try {
      // Create a require function that looks in our node_modules
      const customRequire = Module.createRequire(path.join(packagesDir, 'index.js'))
      return customRequire(moduleName)
    } catch (error) {
      console.error(`[PackageManager] Failed to require ${moduleName} from ${modulePath}:`, error)
      throw new Error(`Cannot find module '${moduleName}'. Please install it first.`)
    }
  }
}
