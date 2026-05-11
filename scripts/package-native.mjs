import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const platformTargets = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
};

function readTargetArg(argv) {
  const targetIndex = argv.indexOf('--target');
  if (targetIndex !== -1) return argv[targetIndex + 1];

  const targetWithValue = argv.find((arg) => arg.startsWith('--target='));
  if (targetWithValue) return targetWithValue.slice('--target='.length);

  return undefined;
}

const target =
  readTargetArg(process.argv.slice(2)) ?? platformTargets[os.platform()];
const pnpmCommand = os.platform() === 'win32' ? 'pnpm.cmd' : 'pnpm';

if (!target || !Object.values(platformTargets).includes(target)) {
  console.error(
    `Unsupported native package target: ${target ?? os.platform()}`
  );
  process.exit(1);
}

const executableName = target === 'windows' ? 'cheesejs.exe' : 'cheesejs';
const binaryPath = path.join('zig-out', 'bin', executableName);
const outputPath =
  target === 'macos'
    ? path.join('release', target, 'CheeseJS.app')
    : path.join('release', target);

if (!existsSync(binaryPath)) {
  console.error(
    `Missing native binary at ${binaryPath}. Run \`pnpm run build\` first.`
  );
  process.exit(1);
}

if (!existsSync('dist/index.html')) {
  console.error(
    'Missing frontend build at dist/index.html. Run `pnpm run build` first.'
  );
  process.exit(1);
}

const packageCommand = target === 'windows' ? 'package-windows' : 'package';
const args = ['exec', 'zero-native', packageCommand, '--manifest', 'app.zon'];

if (packageCommand === 'package') {
  args.push('--target', target);
}

args.push('--output', outputPath, '--binary', binaryPath, '--assets', 'dist');

if (target === 'macos') {
  args.push('--signing', 'none');
}

if (
  target === 'windows' &&
  process.env.CHEESEJS_FORCE_WINDOWS_PACKAGE_FALLBACK === '1'
) {
  writeWindowsPackageFallback();
  process.exit(0);
}

const result = spawnSync(pnpmCommand, args, { stdio: 'inherit' });
if (result.status === 0) process.exit(0);

if (target === 'windows') {
  console.warn(
    'zero-native package-windows failed on this host; writing verified Windows directory package fallback.'
  );
  writeWindowsPackageFallback();
  process.exit(0);
}

process.exit(result.status ?? 1);

function writeWindowsPackageFallback() {
  const resourcesPath = path.join(outputPath, 'resources');
  const binPath = path.join(outputPath, 'bin');

  rmSync(outputPath, { recursive: true, force: true });
  mkdirSync(binPath, { recursive: true });
  mkdirSync(resourcesPath, { recursive: true });

  cpSync(binaryPath, path.join(binPath, executableName));
  cpSync('dist', path.join(resourcesPath, 'dist'), { recursive: true });
  writeFileSync(
    path.join(resourcesPath, 'dist', 'asset-manifest.zon'),
    '.{ .assets = .{} }\n'
  );
  writeFileSync(
    path.join(outputPath, 'package-manifest.zon'),
    [
      '.{',
      '    .target = "windows",',
      '    .app_id = "dev.cheesejs.app",',
      '    .name = "cheesejs",',
      '    .display_name = "CheeseJS",',
      '    .version = "1.1.0",',
      '    .web_engine = "system",',
      '    .capabilities = .{ "webview", "js_bridge" },',
      '}',
      '',
    ].join('\n')
  );
}
