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
}

const installedPackages = new Set<string>()

export async function runInWebContainer (
  webContainer: WebContainer,
  code: string,
  onResult: (result: CodeResult) => void
) {
  if (!code.trim()) {
    return () => {
      // No cleanup needed for empty code
    }
  }

  // 1. Detect and Install Packages
  const imports = getImports(code)
  const newPackages = imports.filter((pkg) => !installedPackages.has(pkg))

  if (newPackages.length > 0) {
    try {
      // Notificar al store que se están instalando paquetes
      newPackages.forEach((pkg) => {
        usePackagesStore.getState().setPackageInstalling(pkg, true)
      })

      const installProcess = await webContainer.spawn('npm', [
        'install',
        ...newPackages
      ])

      installProcess.output.pipeTo(
        new WritableStream({
          write () {
            // npm install output is being suppressed to avoid cluttering the UI
          }
        })
      )

      const installExitCode = await installProcess.exit

      if (installExitCode !== 0) {
        newPackages.forEach((pkg) => {
          usePackagesStore.getState().setPackageError(pkg, 'Installation failed')
        })
        onResult({
          element: {
            content: `Failed to install packages: ${newPackages.join(', ')}`,
            color: Colors.ERROR
          },
          type: 'error'
        })
        return () => {
          // No cleanup needed after installation failure
        }
      }

      newPackages.forEach((pkg) => {
        installedPackages.add(pkg)
        usePackagesStore.getState().addPackage(pkg)
        usePackagesStore.getState().setPackageInstalling(pkg, false)
      })
    } catch (e: unknown) {
      newPackages.forEach((pkg) => {
        usePackagesStore.getState().setPackageError(pkg, (e as Error).message)
      })
      onResult({
        element: {
          content: `Error installing packages: ${(e as Error).message}`,
          color: Colors.ERROR
        },
        type: 'error'
      })
      return () => {
        // No cleanup needed after installation error
      }
    }
  }

  let transformed = ''
  try {
    transformed = transformCode(code)
  } catch (e: unknown) {
    onResult({
      element: { content: (e as Error).message, color: Colors.ERROR },
      type: 'error'
    })
    return () => {
      // No cleanup needed after transform error
    }
  }

  const script = `
import util from 'util';
import { EventEmitter } from 'events';

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
    
    if (typeof val === 'function') {
        return \`f \${val.name || ''}()\`;
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
        
        let result = util.inspect(cleanObj, {
            colors: false,
            depth: null,
            showHidden: false,
            compact: false,
            breakLength: Infinity
        });
        
        result = result.replace(/\\[Function:? (.*?)\\]/g, (match, name) => {
            const fnName = name === '(anonymous)' ? '' : name;
            return \`f \${fnName}()\`;
        });
        
        return result;
    }

    let result = util.inspect(val, {
        colors: false,
        depth: null,
        showHidden: false,
        compact: false,
        breakLength: Infinity
    });

    result = result.replace(/\\[Function:? (.*?)\\]/g, (match, name) => {
        const fnName = name === '(anonymous)' ? '' : name;
        return \`f \${fnName}()\`;
    });
    
    return result;
}

function debug(line, ...args) {
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
    originalLog(JSON.stringify({
        __type: 'error',
        message: String(e)
    }));
});

process.on('unhandledRejection', (e) => {
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

  return () => {
    process.kill()
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
