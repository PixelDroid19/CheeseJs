import { WebContainer } from '@webcontainer/api'
import { transformCode } from './run'
import { Colors } from '../elementParser'
import { getImports } from './dependencies'
import { usePackagesStore } from '../../store/usePackagesStore'

interface CodeResult {
  element: {
    content: string;
    color?: Colors;
  };
  type: 'execution' | 'error';
  lineNumber?: number;
  action?: {
    type: 'install-package';
    payload: string;
  };
}

const installedPackages = new Set<string>()

interface RunOptions {
  showTopLevelResults?: boolean;
  loopProtection?: boolean;
  showUndefined?: boolean;
  internalLogLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
  npmRcContent?: string;
  magicComments?: boolean;
}

export async function runInWebContainer (
  webContainer: WebContainer,
  code: string,
  onResult: (result: CodeResult) => void,
  options: RunOptions = {}
) {
  if (!code.trim()) {
    return {
      kill: () => {
        // No cleanup needed for empty code
      },
      missingPackages: []
    }
  }

  // 0. Configure .npmrc if provided
  if (options.npmRcContent) {
    try {
      await webContainer.fs.writeFile('.npmrc', options.npmRcContent)
    } catch (e) {
      console.warn('Failed to write .npmrc:', e)
    }
  }

  // 1. Detect and Install Packages
  // Sync with store first
  const storePackages = usePackagesStore.getState().packages
  storePackages.forEach(pkg => {
    if (!pkg.error && !pkg.installing) {
      installedPackages.add(pkg.name)
    }
  })

  const imports = getImports(code)
  const newPackages = imports.filter((pkg) => !installedPackages.has(pkg))

  if (newPackages.length > 0) {
    newPackages.forEach((pkg) => {
      onResult({
        element: {
          content: `Package "${pkg}" is not installed.`,
          color: Colors.GRAY
        },
        type: 'execution',
        action: {
          type: 'install-package',
          payload: pkg
        }
      })
    })

    return {
      kill: () => {
        // No cleanup needed
      },
      missingPackages: newPackages
    }
  }

  let transformed = ''
  try {
    transformed = transformCode(code, {
      showTopLevelResults: options.showTopLevelResults,
      loopProtection: options.loopProtection,
      internalLogLevel: options.internalLogLevel,
      magicComments: options.magicComments
    })
  } catch (e: unknown) {
    onResult({
      element: { content: (e as Error).message, color: Colors.ERROR },
      type: 'error'
    })
    return {
      kill: () => {
        // No cleanup needed after transform error
      },
      missingPackages: []
    }
  }

  const script = `
import util from 'util';
import { EventEmitter } from 'events';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const showUndefined = ${options.showUndefined ?? false};

// Increase max listeners to prevent warnings in complex async scenarios
EventEmitter.defaultMaxListeners = 50;

// Polyfill window/global to look like a browser environment
global.window = global;
global.self = global;
global.Window = Object;
Object.defineProperty(global, Symbol.toStringTag, { value: 'Window' });

const originalLog = console.log;
const originalTable = console.table;
const originalWarn = console.warn;
const originalError = console.error;

function customInspect(val) {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return String(val);
    if (typeof val === 'undefined') return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'symbol') return val.toString();
    
    // Handle Timeout objects gracefully
    if (val && typeof val === 'object' && val.constructor && val.constructor.name === 'Timeout') {
        return \`Timeout { \${val._idleTimeout}ms }\`;
    }

    const isBuiltin = (
        val === Math || 
        val === JSON || 
        val === console || 
        (typeof Reflect !== 'undefined' && val === Reflect) || 
        (typeof Intl !== 'undefined' && val === Intl)
    );

    if (isBuiltin) {
        const cleanObj = {};
        const props = Object.getOwnPropertyNames(val);
        for (const key of props) {
             if (key === 'length' || key === 'name' || key === 'prototype' || key === 'constructor') continue;
             if (key.startsWith('_')) continue;
             try {
                 cleanObj[key] = val[key];
             } catch {}
        }
        
        const name = val[Symbol.toStringTag] || (val.constructor && val.constructor.name) || 'Object';
        Object.defineProperty(cleanObj, Symbol.toStringTag, { value: name });
        
        return util.inspect(cleanObj, {
            colors: false,
            depth: null,
            showHidden: false,
            compact: false
        });
    }

    return util.inspect(val, {
        colors: false,
        depth: null,
        showHidden: false,
        compact: false
    });
}

function debug(line, ...args) {
  // Silence Timeout objects in debug channel (implicit returns)
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && args[0].constructor && args[0].constructor.name === 'Timeout') {
    return;
  }

  // Check showUndefined setting
  if (!showUndefined && args.length === 1 && args[0] === undefined) {
    return;
  }

  const content = args.map(arg => customInspect(arg)).join(' ');

  originalLog(JSON.stringify({
    __type: 'debug',
    line,
    content: content,
    jsType: args.length === 1 ? typeof args[0] : 'string'
  }));
}

// Override console methods globally
const consoleOverride = {
  log: (...args) => {
    const parts = args.map(arg => customInspect(arg));
    
    originalLog(JSON.stringify({
      __type: 'console',
      content: parts.join(' ')
    }));
  },
  
  table: (data) => {
    if (Array.isArray(data)) {
      const lines = [];
      
      if (data.length > 0 && typeof data[0] === 'object') {
        const headers = ['(index)', ...Object.keys(data[0])];
        const separator = headers.map(h => '-'.repeat(Math.max(h.length, 10))).join('-+-');
        
        lines.push('| ' + headers.map(h => h.padEnd(10)).join(' | ') + ' |');
        lines.push(separator);
        
        data.forEach((row, idx) => {
          const values = [String(idx).padEnd(10)];
          Object.values(row).forEach(v => {
            values.push(String(v).padEnd(10));
          });
          lines.push('| ' + values.join(' | ') + ' |');
        });
        
        originalLog(JSON.stringify({
          __type: 'console',
          content: lines.join('\\n')
        }));
      } else {
        originalLog(JSON.stringify({
          __type: 'console',
          content: util.inspect(data, { colors: false, depth: null })
        }));
      }
    } else {
      originalLog(JSON.stringify({
        __type: 'console',
        content: util.inspect(data, { colors: false, depth: null })
      }));
    }
  },
  
  warn: (...args) => {
    const content = args.map(arg => customInspect(arg)).join(' ');
    originalLog(JSON.stringify({
      __type: 'console',
      content: 'Warning: ' + content
    }));
  },
  
  error: (...args) => {
    const content = args.map(arg => customInspect(arg)).join(' ');
    originalLog(JSON.stringify({
      __type: 'console',
      content: 'Error: ' + content
    }));
  }
};

Object.assign(console, consoleOverride);

process.on('uncaughtException', (e) => {
    const msg = String(e);
    if (msg.includes('Cannot find module')) {
        const match = msg.match(/Cannot find module '([^']+)'/);
        if (match) {
             originalLog(JSON.stringify({
                __type: 'error',
                message: \`Package "\${match[1]}" is not installed. Please install it to run this code.\`
            }));
            return;
        }
    }
    originalLog(JSON.stringify({
        __type: 'error',
        message: String(e)
    }));
});

process.on('unhandledRejection', (e) => {
    const msg = String(e);
    if (msg.includes('Cannot find module')) {
        const match = msg.match(/Cannot find module '([^']+)'/);
        if (match) {
             originalLog(JSON.stringify({
                __type: 'error',
                message: \`Package "\${match[1]}" is not installed. Please install it to run this code.\`
            }));
            return;
        }
    }
    originalLog(JSON.stringify({
        __type: 'error',
        message: String(e)
    }));
});

// User code
${transformed}
`

  await webContainer.fs.writeFile('index.js', script)

  const process = await webContainer.spawn('node', ['index.js'])

  process.output.pipeTo(
    new WritableStream({
      write (data) {
        const lines = data.split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line)
            if (json.__type === 'debug') {
              if (options.showUndefined === false && json.content === 'undefined') {
                continue
              }
              onResult({
                lineNumber: json.line,
                element: {
                  content: json.content,
                  color: getColor(json.jsType, json.content)
                },
                type: 'execution'
              })
            } else if (json.__type === 'console') {
              onResult({
                element: { content: json.content, color: Colors.STRING },
                type: 'execution'
              })
            } else if (json.__type === 'error') {
              onResult({
                element: { content: json.message, color: Colors.ERROR },
                type: 'error'
              })
            }
          } catch (e) {
            // Non-JSON output, might be regular stdout - capture it too
            if (line.trim().length > 0) {
              onResult({
                element: { content: line, color: Colors.GRAY },
                type: 'execution'
              })
            }
          }
        }
      }
    })
  )

  return {
    kill: () => {
      process.kill()
    },
    missingPackages: []
  }
}

function getColor (type: string, content?: string) {
  switch (type) {
    case 'string':
      return Colors.STRING
    case 'number':
      return Colors.NUMBER
    case 'boolean':
      return content === 'true' ? Colors.TRUE : Colors.FALSE
    case 'undefined':
      return Colors.GRAY
    case 'object':
      return Colors.GRAY
    default:
      return Colors.GRAY
  }
}
