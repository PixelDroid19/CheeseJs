# WebAssembly Languages en CheeseJS

Esta guía documenta cómo crear, integrar y mantener lenguajes basados en WebAssembly para CheeseJS.

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Arquitectura](#arquitectura)
- [Creación de un Plugin de Lenguaje](#creación-de-un-plugin-de-lenguaje)
- [Formato de Módulo](#formato-de-módulo)
- [Plantillas Disponibles](#plantillas-disponibles)
- [API de Ejecución](#api-de-ejecución)
- [Gestión de Dependencias](#gestión-de-dependencias)
- [Seguridad y Aislamiento](#seguridad-y-aislamiento)
- [Pruebas](#pruebas)
- [Distribución](#distribución)

---

## Visión General

El sistema de lenguajes WebAssembly de CheeseJS permite a desarrolladores añadir soporte para nuevos lenguajes de programación mediante módulos WASM. Este sistema ofrece:

- **Ejecución Aislada**: Cada lenguaje ejecuta en su propio sandbox WebAssembly
- **Ejecución Concurrente**: Múltiples instancias pueden ejecutarse simultáneamente
- **Gestión Automática**: Pool de instancias con reutilización y limpieza
- **Seguridad**: Restricciones de memoria, CPU y timeouts
- **Extensibilidad**: API clara para contribuir con nuevos lenguajes

### Lenguajes Soportados Actualmente

| Lenguaje              | Estado                | Plantilla                                                 |
| --------------------- | --------------------- | --------------------------------------------------------- |
| JavaScript/TypeScript | Nativo                | -                                                         |
| Python                | WebAssembly (Pyodide) | -                                                         |
| Rust                  | Plantilla disponible  | [rust-template](../examples/wasm-languages/rust-template) |
| C++                   | Plantilla disponible  | [cpp-template](../examples/wasm-languages/cpp-template)   |

---

## Arquitectura

### Componentes Principales

```
electron/wasm-languages/
├── WasmLanguageModule.ts   # Interfaces y tipos
├── WasmExecutor.ts         # Ejecutor genérico de WASM
├── WasmInstancePool.ts     # Pool de instancias concurrentes
├── WasmLanguageRegistry.ts  # Registro dinámico de lenguajes
└── WasmDependencyResolver.ts # Gestión de dependencias
```

### Flujo de Ejecución

```
Usuario escribe código
    ↓
ExecutionHandlers detecta lenguaje WASM
    ↓
WasmLanguageRegistry ejecuta código
    ↓
WasmInstancePool adquiere instancia
    ↓
WasmExecutor ejecuta en WebAssembly
    ↓
Resultado devuelto al usuario
```

### Integración con Sistema de Plugins

Los lenguajes WASM se integran mediante el sistema de plugins existente:

1. El plugin declara `contributes.wasmLanguages` en `package.json`
2. CheeseJS registra automáticamente el lenguaje
3. El módulo WASM se carga y ejecuta bajo demanda

---

## Creación de un Plugin de Lenguaje

### Paso 1: Estructura del Directorio

Crea un directorio con la siguiente estructura:

```
my-language-plugin/
├── package.json          # Manifest del plugin
├── runtime.wasm          # Módulo WebAssembly compilado
├── bindings/
│   └── index.js        # Puentes JS-WASM
├── language.json        # Configuración del lenguaje
└── dependencies.json    # Dependencias WASM (opcional)
```

### Paso 2: Manifest del Plugin (`package.json`)

```json
{
  "name": "cheesejs-wasm-mylang",
  "version": "0.1.0",
  "description": "MyLanguage support for CheeseJS",
  "displayName": "MyLanguage (WASM)",
  "main": "index.js",
  "contributes": {
    "wasmLanguages": [
      {
        "id": "mylang",
        "name": "MyLanguage",
        "extensions": [".ml"],
        "version": "1.0.0",
        "wasmPath": "runtime.wasm",
        "bindingsPath": "bindings/index.js",
        "monacoConfig": {
          "comments": {
            "lineComment": "//",
            "blockComment": ["/*", "*/"]
          }
        },
        "dependencies": [],
        "memoryLimit": 134217728,
        "timeout": 30000
      }
    ]
  },
  "permissions": ["storage"],
  "sandboxed": true
}
```

### Paso 3: Configuración del Lenguaje

Propiedades de `wasmLanguages`:

| Propiedad      | Tipo     | Requerido | Descripción                                 |
| -------------- | -------- | --------- | ------------------------------------------- |
| `id`           | string   | Sí        | Identificador único (ej: "rust", "go")      |
| `name`         | string   | Sí        | Nombre del lenguaje para mostrar en UI      |
| `extensions`   | string[] | Sí        | Extensiones de archivo (ej: [".rs", ".go"]) |
| `version`      | string   | Sí        | Versión del runtime del lenguaje            |
| `wasmPath`     | string   | Sí        | Ruta al módulo WASM (relativa a plugin)     |
| `bindingsPath` | string   | No        | Ruta a puentes JS (relativa a plugin)       |
| `monacoConfig` | object   | No        | Configuración para editor Monaco            |
| `dependencies` | array    | No        | Dependencias WASM requeridas                |
| `memoryLimit`  | number   | No        | Límite de memoria en bytes (default: 128MB) |
| `timeout`      | number   | No        | Timeout de ejecución en ms (default: 30000) |

---

## Formato de Módulo

### Módulo WebAssembly

El módulo WASM debe exportar las funciones necesarias para que los bindings JS interactúen con él. El diseño exacto depende de tu implementación de bindings.

```c
// Ejemplo en C
extern "C" {
    int run(const char* code);
}
```

```rust
// Ejemplo en Rust
#[wasm_bindgen]
pub fn run(code: &str) -> i32 {
    // Implementación
}
```

### Bindings JavaScript

El módulo de bindings (`bindings/index.js`) es el puente entre CheeseJS y tu módulo WASM. Debe exportar las siguientes funciones:

```javascript
/**
 * Inicializa la instancia WASM
 * @param {WebAssembly.Memory} memory - Memoria compartida
 * @param {WebAssembly.Imports} imports - Importaciones para el WASM
 */
export async function initialize(memory, imports) {
  // Inicializar WASM y devolver instancia
  // return await WebAssembly.instantiate(..., imports);
}

/**
 * Prepara el código fuente antes de pasarlo al WASM
 * @param {string} code - Código fuente original
 */
export function prepareCode(code) {
  // Ejemplo: eliminar comentarios, trim, etc.
  return code.trim();
}

/**
 * Ejecuta el código utilizando la instancia
 * @param {WebAssembly.Instance} instance - Instancia inicializada
 * @param {string} code - Código preparado
 * @returns {Promise<WasmExecutionResult>}
 */
export async function execute(instance, code) {
  // Lógica para llamar a la función exportada del WASM
  // ...
  return {
    exitCode: 0,
    stdout: 'Salida capturada',
    stderr: '',
    executionTime: 100, // ms
  };
}

export function handleStdout(text) {
  // Callback opcional si se usa streaming
}

export function handleStderr(text) {
  // Callback opcional
}
```

---

## Plantillas Disponibles

### Rust

Ubicación: [examples/wasm-languages/rust-template](../examples/wasm-languages/rust-template)

**Prerequisitos:**

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

**Construcción:**

```bash
wasm-pack build --target web --out-dir runtime
```

### C++

Ubicación: [examples/wasm-languages/cpp-template](../examples/wasm-languages/cpp-template)

**Prerequisitos:**

- Emscripten 3.0+

**Construcción:**

```bash
node build.js
# o
make
```

---

## API de Ejecución

### WasmExecutionOptions

```typescript
interface WasmExecutionOptions {
  timeout?: number; // Timeout en ms (default: 30000)
  memoryLimit?: number; // Límite de memoria en bytes
  captureStdout?: boolean; // Capturar stdout (default: true)
  captureStderr?: boolean; // Capturar stderr (default: true)
  env?: Record<string, string>; // Variables de entorno
}
```

### WasmExecutionResult

El objeto que devuelve la función `execute` de los bindings:

```typescript
interface WasmExecutionResult {
  exitCode: number; // Código de salida (0 = éxito, != 0 error)
  stdout: string; // Salida estándar capturada completa
  stderr: string; // Errores capturados
  error?: string; // Mensaje de error de sistema/runtime si falló
  executionTime: number; // Tiempo de ejecución en ms
  memoryUsed?: number; // Pico de memoria usada en bytes (opcional)
}
```

---

## Gestión de Dependencias

### Declaración de Dependencias

```json
{
  "dependencies": [
    {
      "id": "mylib",
      "version": "^1.0.0",
      "url": "https://example.com/mylib.wasm",
      "checksum": "sha256:abc123..."
    }
  ]
}
```

### Resolución Automática

CheeseJS descarga automáticamente las dependencias:

- Verifica checksums SHA-256
- Caché en directorio de usuario
- Reutilización entre plugins
- Limpieza automática de caché expirado

---

## Seguridad y Aislamiento

### Restricciones de Memoria

- Límite configurable por lenguaje
- Default: 128MB por instancia
- Prevención de memory leaks

### Timeouts

- Timeout configurable por lenguaje
- Default: 30 segundos
- Cancelación de ejecución en curso

### Sandbox

- Aislamiento completo del proceso principal
- Sin acceso al filesystem
- Sin acceso a red (por defecto)
- Permisos granulares por plugin

---

## Pruebas

### Tests Unitarios

```typescript
import { wasmExecutor } from './WasmExecutor.js';
import { wasmInstancePool } from './WasmInstancePool.js';

describe('WasmLanguage', () => {
  it('should execute code successfully', async () => {
    const result = await wasmInstancePool.execute(
      'mylang',
      'print("Hello, World!")',
      { timeout: 5000 }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello, World!');
  });
});
```

### Tests de Integración

```typescript
import { wasmLanguageRegistry } from './WasmLanguageRegistry.js';

describe('WasmLanguageRegistry', () => {
  it('should register language', async () => {
    await wasmLanguageRegistry.register(
      'test-plugin',
      '/path/to/plugin',
      testConfig
    );

    expect(wasmLanguageRegistry.hasLanguage('mylang')).toBe(true);
  });
});
```

---

## Distribución

### Publicación

1. Compilar módulo WASM
2. Empaquetar plugin
3. Publicar en CheeseJS Marketplace

### Instalación

```bash
cheesejs install my-language-plugin
```

### Actualización

```bash
cheesejs update my-language-plugin
```

---

## Recursos

- [Documentación del Sistema de Plugins](./PLUGIN_SYSTEM.md)
- [Documentación de WebAssembly](https://webassembly.org/)
- [wasm-bindgen (Rust)](https://rustwasm.github.io/wasm-bindgen/)
- [Emscripten (C/C++)](https://emscripten.org/)

---

## Contribuciones

Para contribuir con un nuevo lenguaje a CheeseJS:

1. Fork el repositorio
2. Crear plugin siguiendo esta guía
3. Añadir tests
4. Abrir Pull Request

---

## Licencia

Misma licencia que CheeseJS.
