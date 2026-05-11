import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const config = JSON.parse(
  fs.readFileSync(path.join(root, 'architecture/layers.json'), 'utf8')
);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const CONFIG_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  'app.zon',
  'build.zig',
  '.github/dependabot.yml',
  '.github/workflows/build.yml',
];
const IGNORE_DIRS = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'release',
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(absolute));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }

  return files;
}

function ownerForFile(relativePath) {
  const packageMatch = relativePath.match(/^packages\/([^/]+)\//);
  if (packageMatch) return { kind: 'package', name: packageMatch[1] };
  return null;
}

function importPackage(specifier) {
  const match = specifier.match(/^@cheesejs\/([^/]+)/);
  return match?.[1] ?? null;
}

function extractImports(source) {
  const imports = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function matchesAllowPath(relativePath, allowPattern) {
  if (allowPattern.endsWith('/')) return relativePath.startsWith(allowPattern);
  if (!allowPattern.includes('*')) return relativePath === allowPattern;

  const escaped = allowPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '[^/]*');
  return new RegExp(`^${escaped}$`).test(relativePath);
}

function isHostGlobalAllowed(relativePath) {
  return config.hostGlobalAllowPaths.some((allowPattern) =>
    matchesAllowPath(relativePath, allowPattern)
  );
}

function checkLayerImport(relativePath, specifier) {
  const targetPackage = importPackage(specifier);
  if (!targetPackage) return null;

  const owner = ownerForFile(relativePath);
  if (!owner) return null;

  if (owner.kind === 'package') {
    if (owner.name === targetPackage) return null;
    const allowed = config.packages[owner.name] ?? [];
    if (!allowed.includes(targetPackage)) {
      return `${relativePath}: package "${owner.name}" must not import @cheesejs/${targetPackage}`;
    }
  }

  return null;
}

function checkBannedActiveImports(relativePath, specifier) {
  if (!config.bannedActiveImports.includes(specifier)) return null;
  return `${relativePath}: active runtime must not import ${specifier}`;
}

function checkBannedActiveText(relativePath, source) {
  const normalized = source.toLowerCase();
  return config.bannedActiveImports
    .filter((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped.toLowerCase()}\\b`).test(normalized);
    })
    .map(
      (term) =>
        `${relativePath}: active config must not reference removed desktop host "${term}"`
    );
}

function checkHostGlobals(relativePath, source) {
  if (isHostGlobalAllowed(relativePath)) return [];

  return config.hostGlobals
    .filter((globalName) => source.includes(globalName))
    .map(
      (globalName) =>
        `${relativePath}: use packages/app/src/host/hostBridge.ts instead of ${globalName}`
    );
}

function checkActiveAiTerms(relativePath, source) {
  if (
    relativePath === 'AGENTS.md' ||
    relativePath.startsWith('architecture/') ||
    relativePath.startsWith('docs/')
  ) {
    return [];
  }

  const normalized = source.toLowerCase();
  return config.bannedActiveAiTerms
    .filter((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped.toLowerCase()}\\b`).test(normalized);
    })
    .map(
      (term) =>
        `${relativePath}: active AI/RAG term "${term}" is banned from runtime code`
    );
}

function checkWorkflowPolicy(relativePath, source) {
  if (relativePath !== '.github/workflows/build.yml') return [];

  const workflowErrors = [];
  const matrixMatches = [...source.matchAll(/os:\s*\[([^\]]+)\]/g)].map(
    (match) =>
      match[1].split(',').map((value) => value.trim().replaceAll("'", ''))
  );
  const requiredRunners = ['ubuntu-latest', 'macos-latest', 'windows-latest'];
  const completeMatrices = matrixMatches.filter((matrix) =>
    requiredRunners.every((runner) => matrix.includes(runner))
  );

  if (completeMatrices.length < 2) {
    workflowErrors.push(
      `${relativePath}: native platform and release jobs must both cover ubuntu-latest, macos-latest, and windows-latest`
    );
  }

  const requiredSnippets = [
    'node-version: 20',
    'version: 0.16.0',
    'needs: quality',
    'needs: [quality, native-platforms]',
    'pnpm install --frozen-lockfile',
    'pnpm run native:validate',
    'pnpm run native:doctor',
    'pnpm run arch:check',
    'pnpm run native:test',
    'pnpm run package:native',
    'pnpm run native:package:check',
    'pnpm run bundle:check',
    'libgtk-4-dev',
    'libwebkitgtk-6.0-dev',
    'pkg-config',
  ];

  for (const snippet of requiredSnippets) {
    if (!source.includes(snippet)) {
      workflowErrors.push(
        `${relativePath}: CI policy is missing required step or dependency "${snippet}"`
      );
    }
  }

  return workflowErrors;
}

function checkPackageScriptsPolicy(relativePath, source) {
  if (relativePath !== 'package.json') return [];

  const packageErrors = [];
  const packageJson = JSON.parse(source);
  const scripts = packageJson.scripts ?? {};

  const requiredScriptSnippets = {
    quality: [
      'pnpm run native:check',
      'pnpm run native:validate',
      'pnpm run native:doctor',
      'pnpm run arch:check',
      'pnpm run test:coverage',
      'pnpm run native:test',
    ],
    'release:check': [
      'pnpm run quality',
      'pnpm run package:native',
      'pnpm run native:package:check',
      'pnpm run native:package:windows',
      'pnpm run bundle:check',
      'pnpm exec playwright test',
    ],
    'native:package:windows': [
      'pnpm run build:frontend',
      'pnpm run native:build:windows',
      'node scripts/package-native.mjs --target windows',
      'node scripts/check-native-package.mjs windows',
    ],
    'ci:platforms:check': ['node scripts/check-ci-platforms.mjs'],
  };

  if (
    packageJson.packageManager !==
    'pnpm@10.30.0+sha512.2b5753de015d480eeb88f5b5b61e0051f05b4301808a82ec8b840c9d2adf7748eb352c83f5c1593ca703ff1017295bc3fdd3119abb9686efc96b9fcb18200937'
  ) {
    packageErrors.push(
      `${relativePath}: packageManager must pin pnpm 10.30.0 for reproducible CI`
    );
  }

  for (const [scriptName, snippets] of Object.entries(requiredScriptSnippets)) {
    const command = scripts[scriptName];
    if (typeof command !== 'string') {
      packageErrors.push(
        `${relativePath}: missing required script "${scriptName}"`
      );
      continue;
    }

    for (const snippet of snippets) {
      if (!command.includes(snippet)) {
        packageErrors.push(
          `${relativePath}: script "${scriptName}" must include "${snippet}"`
        );
      }
    }
  }

  return packageErrors;
}

function checkNativeManifestPolicy(relativePath, source) {
  if (relativePath !== 'app.zon') return [];

  const manifestErrors = [];
  const requiredSnippets = [
    '.id = "dev.cheesejs.app"',
    '.platforms = .{ "macos", "linux", "windows" }',
    '.capabilities = .{ "webview", "js_bridge" }',
    '.permissions = .{ "window" }',
    '.web_engine = "system"',
    '.dist = "dist"',
    '.entry = "index.html"',
    '.spa_fallback = true',
    '.url = "http://127.0.0.1:5173/"',
    '.command = .{ "pnpm", "run", "dev:vite" }',
    '.allowed_origins = .{ "zero://app", "http://127.0.0.1:5173" }',
    '.external_links = .{ .action = "deny" }',
    '.{ .label = "main", .title = "CheeseJS", .width = 1280, .height = 820, .restore_state = true }',
  ];

  for (const snippet of requiredSnippets) {
    if (!source.includes(snippet)) {
      manifestErrors.push(
        `${relativePath}: native manifest policy is missing "${snippet}"`
      );
    }
  }

  const requiredCommands = [
    'cheese.app.info',
    'cheese.external.open',
    'zero-native.window.close',
  ];

  for (const command of requiredCommands) {
    if (!source.includes(`.name = "${command}"`)) {
      manifestErrors.push(
        `${relativePath}: native bridge policy is missing command "${command}"`
      );
    }
  }

  return manifestErrors;
}

const sourceFiles = [
  ...walk(path.join(root, 'packages')),
  ...walk(path.join(root, 'scripts')),
];
const errors = [];

if (fs.existsSync(path.join(root, 'src'))) {
  errors.push('src/: root renderer shims are not allowed; use packages/*');
}

for (const absolutePath of sourceFiles) {
  const relativePath = toPosix(path.relative(root, absolutePath));
  const source = fs.readFileSync(absolutePath, 'utf8');

  for (const specifier of extractImports(source)) {
    const error = checkLayerImport(relativePath, specifier);
    if (error) errors.push(error);
    const bannedImport = checkBannedActiveImports(relativePath, specifier);
    if (bannedImport) errors.push(bannedImport);
  }

  errors.push(...checkHostGlobals(relativePath, source));
  errors.push(...checkActiveAiTerms(relativePath, source));
}

for (const configPath of CONFIG_FILES) {
  const absolutePath = path.join(root, configPath);
  if (!fs.existsSync(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, 'utf8');
  errors.push(...checkBannedActiveText(configPath, source));
  errors.push(...checkActiveAiTerms(configPath, source));
  errors.push(...checkWorkflowPolicy(configPath, source));
  errors.push(...checkPackageScriptsPolicy(configPath, source));
  errors.push(...checkNativeManifestPolicy(configPath, source));
}

if (errors.length > 0) {
  console.error('Architecture check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Architecture check passed.');
