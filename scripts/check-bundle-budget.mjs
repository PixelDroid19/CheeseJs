import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const maxEntryBytes = 250 * 1024;
const indexHtml = readFileSync('dist/index.html', 'utf8');
const entryMatch = indexHtml.match(/<script[^>]+src="([^"]+index-[^"]+\.js)"/);

if (!entryMatch) {
  console.error('Unable to find the Vite entry script in dist/index.html.');
  process.exit(1);
}

const entryPath = path.join('dist', entryMatch[1].replace(/^\//, ''));
const entrySize = statSync(entryPath).size;

if (entrySize > maxEntryBytes) {
  console.error(
    `Entry bundle too large: ${entryPath} is ${entrySize} bytes; limit is ${maxEntryBytes} bytes.`
  );
  process.exit(1);
}

console.log(
  `Bundle budget passed: ${entryPath} is ${entrySize} bytes of ${maxEntryBytes} bytes.`
);
