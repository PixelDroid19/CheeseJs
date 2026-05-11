# CheeseJS

CheeseJS es un entorno nativo modular para ejecutar y explorar codigo, construido con Zero Native, Zig, React, Vite y Monaco. El proyecto prioriza paquetes pequenos, contratos explicitos de host y puntos de extension para que cada parte pueda reemplazarse o ampliarse sin acoplarse al resto de la aplicacion.

## Caracteristicas

- Shell nativo de escritorio con Zero Native y el WebView del sistema.
- Arquitectura por capas bajo `packages/*`.
- Contrato de host en `@cheesejs/core` y adaptador Zero Native/browser en `packages/app`.
- Ejecucion de JavaScript, TypeScript y Python mediante el runtime de host/browser.
- Editor Monaco, deteccion de lenguaje, tabs, configuracion, snippets, prompts de paquetes y panel de resultados.
- Registro de extensiones para runtimes, lenguajes, comandos de editor, tabs de configuracion, gestores de paquetes, temas y modulos asistentes futuros.
- Sin wiring activo de IA/RAG.

## Requisitos

- Node.js 20
- pnpm 10.30.0
- Zig 0.16.0+
- Los builds nativos de Linux requieren las librerias de desarrollo WebKitGTK 6.0 (`webkitgtk-6.0` / `libwebkitgtk-6.0-dev`, segun la distro).
- Los builds nativos de Windows usan el host system de Zero Native y se validan en el runner Windows de CI.
- macOS puede optar por Chromium/CEF con `pnpm run native:cef` y `-Dweb-engine=chromium`.

## Desarrollo

```bash
pnpm install
pnpm run native:check
pnpm run dev
```

`pnpm run dev` inicia el flujo de Zero Native. Usa `pnpm run dev:web` si solo necesitas el frontend web o si una maquina Linux aun no tiene WebKitGTK 6.0.

El comando dev de Vite reutiliza un servidor existente en `http://127.0.0.1:5173/` cuando ya esta activo, asi que relanzar el shell nativo no falla por puerto ocupado.

## Validacion

```bash
pnpm run arch:check
pnpm run type-check
pnpm run test:coverage
pnpm run native:test
pnpm run native:validate
pnpm run native:doctor
pnpm run native:build:windows
pnpm run build
pnpm run package:native
pnpm run native:package:check
pnpm run bundle:check
pnpm exec playwright test
```

La prueba nativa usa `/tmp/cheesejs-zig-cache` para evitar problemas de rename atomico cuando el checkout vive en un disco externo.

`pnpm run package:native` construye el frontend/binario nativo y escribe un artefacto Zero Native en `release/<platform>/`.

Usa `pnpm run release:check` para la puerta local completa. El empaquetado macOS todavia requiere un host macOS o un runner CI porque los frameworks de Apple no existen en Linux.
