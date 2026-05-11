import { spawnSync } from 'node:child_process';
import os from 'node:os';

function commandExists(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const platform = os.platform();

if (!commandExists('zig', ['version'])) {
  fail('Missing Zig. Install Zig 0.16.0+ before running the native shell.');
}

if (platform === 'linux') {
  if (!commandExists('pkg-config', ['--exists', 'gtk4'])) {
    fail(
      'Missing GTK4 development libraries. Install gtk4 before running CheeseJS natively on Linux.'
    );
  }

  if (!commandExists('pkg-config', ['--exists', 'webkitgtk-6.0'])) {
    fail(
      [
        'Missing WebKitGTK 6.0 development libraries.',
        'Zero Native 0.1.9 supports the Linux native WebView through WebKitGTK, not the Chromium/CEF shim.',
        'Install one of these distro packages, then rerun `pnpm dev`:',
        '  Arch/Manjaro: sudo pacman -S webkitgtk-6.0',
        '  Debian/Ubuntu: sudo apt install libwebkitgtk-6.0-dev',
        'Temporary web-only fallback for this checkout: pnpm run dev:web',
      ].join('\n')
    );
  }
}

if (platform === 'win32') {
  console.warn(
    'Windows native builds use the system WebView2 host from Zero Native. Verify WebView2 Runtime is installed.'
  );
}
