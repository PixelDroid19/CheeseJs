import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = '5173';
const readyUrl = `http://${host}:${port}/`;
let keepAliveTimer;
let child;

async function isServerReady() {
  try {
    const response = await fetch(readyUrl, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

function keepProcessAlive() {
  console.log(`Vite dev server already available at ${readyUrl}`);
  keepAliveTimer = setInterval(() => {}, 2 ** 31 - 1);
}

function stop(signal) {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  if (child && !child.killed) child.kill(signal);
}

if (await isServerReady()) {
  keepProcessAlive();
} else {
  child = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', '--host', host, '--port', port],
    { stdio: 'inherit' }
  );

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

process.on('SIGINT', () => {
  stop('SIGINT');
  process.exit(130);
});

process.on('SIGTERM', () => {
  stop('SIGTERM');
  process.exit(143);
});
