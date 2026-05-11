import { existsSync, statSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const platformTargets = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
};

const target = process.argv[2] ?? platformTargets[os.platform()];

if (!target) {
  console.error(`Unsupported native package platform: ${os.platform()}`);
  process.exit(1);
}

const executableName = target === 'windows' ? 'cheesejs.exe' : 'cheesejs';
const releaseRoot = path.join('release', target);
const packageRoot =
  target === 'macos' ? path.join(releaseRoot, 'CheeseJS.app') : releaseRoot;
const resourcesRoot =
  target === 'macos'
    ? path.join(packageRoot, 'Contents', 'Resources')
    : path.join(packageRoot, 'resources');

const requiredFiles = [
  path.join(resourcesRoot, 'dist', 'index.html'),
  path.join(resourcesRoot, 'dist', 'asset-manifest.zon'),
];

if (target === 'linux') {
  requiredFiles.push(
    path.join(packageRoot, 'package-manifest.zon'),
    path.join(packageRoot, 'bin', executableName),
    path.join(packageRoot, 'share', 'applications', 'cheesejs.desktop'),
    path.join(packageRoot, 'share', 'icons', 'app-icon.png')
  );
} else if (target === 'windows') {
  requiredFiles.push(
    path.join(packageRoot, 'package-manifest.zon'),
    path.join(packageRoot, 'bin', executableName)
  );
} else if (target === 'macos') {
  requiredFiles.push(
    path.join(packageRoot, 'Contents', 'Info.plist'),
    path.join(packageRoot, 'Contents', 'PkgInfo'),
    path.join(packageRoot, 'Contents', 'MacOS', 'cheesejs'),
    path.join(resourcesRoot, 'package-manifest.zon')
  );
}

const missing = requiredFiles.filter((filePath) => !existsSync(filePath));
if (missing.length > 0) {
  console.error('Native package check failed. Missing files:');
  for (const filePath of missing) console.error(`- ${filePath}`);
  process.exit(1);
}

const nonEmpty = requiredFiles.filter((filePath) => {
  try {
    return statSync(filePath).isFile() && statSync(filePath).size === 0;
  } catch {
    return false;
  }
});

if (nonEmpty.length > 0) {
  console.error('Native package check failed. Empty files:');
  for (const filePath of nonEmpty) console.error(`- ${filePath}`);
  process.exit(1);
}

const packageManifestPath =
  target === 'macos'
    ? path.join(resourcesRoot, 'package-manifest.zon')
    : path.join(packageRoot, 'package-manifest.zon');
const packageManifest = readFileSync(packageManifestPath, 'utf8');
const indexHtml = readFileSync(
  path.join(resourcesRoot, 'dist', 'index.html'),
  'utf8'
);

const requiredManifestSnippets = [
  `.target = "${target}"`,
  '.app_id = "dev.cheesejs.app"',
  '.web_engine = "system"',
  '.capabilities = .{',
  '"webview"',
  '"js_bridge"',
];

const missingManifestSnippets = requiredManifestSnippets.filter(
  (snippet) => !packageManifest.includes(snippet)
);

if (missingManifestSnippets.length > 0) {
  console.error('Native package check failed. Missing manifest entries:');
  for (const snippet of missingManifestSnippets) console.error(`- ${snippet}`);
  process.exit(1);
}

if (!indexHtml.includes('<div id="root"')) {
  console.error('Native package check failed. Packaged index.html is invalid.');
  process.exit(1);
}

console.log(`Native package check passed for ${target}: ${packageRoot}`);
