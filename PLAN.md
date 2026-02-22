# Plan de Desarrollo e Integración de IA

## 1. Estado Actual (v0.2.0)

El sistema de IA ha sido actualizado para soportar interacción bidireccional real con el editor de código.

### Características Implementadas

- **Chat con Contexto:** El agente recibe el código actual del editor como contexto.
- **Acciones en el Editor:** El agente puede escribir, insertar o reemplazar código directamente usando el protocolo `EDITOR_ACTION`.
- **Soporte Multi-Proveedor:** Arquitectura lista para OpenAI, Anthropic, Gemini y Modelos Locales (Ollama/LM Studio).
- **Streaming:** Respuestas en tiempo real con ejecución de acciones al finalizar.

## 2. Protocolo de Acciones del Editor

Para que el agente modifique el editor, debe incluir un bloque JSON especial en su respuesta. Este protocolo es agnóstico del modelo.

### Formato

```text
<<<EDITOR_ACTION>>>
{
  "action": "replaceAll",
  "code": "console.log('Hello World');"
}
<<<END_ACTION>>>
```

### Acciones Disponibles

| Acción             | Descripción                               | Uso Típico                                                       |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------------- |
| `replaceAll`       | Reemplaza todo el contenido del editor.   | Generar scripts completos, refactorizaciones totales.            |
| `insert`           | Inserta código en la posición del cursor. | Añadir funciones auxiliares, snippets.                           |
| `replaceSelection` | Reemplaza solo el texto seleccionado.     | Corregir bugs específicos, refactorizar funciones seleccionadas. |

## 3. Hoja de Ruta (Roadmap)

### Fase 1: Consolidación (Completado)

- [x] Corregir errores de importación en `AIChat.tsx`.
- [x] Implementar parsing robusto de `EDITOR_ACTION`.
- [x] Integrar acciones en el flujo de chat y fallback.
- [x] Añadir logs de depuración para trazabilidad.

### Fase 2: Privacidad y Ética (Completado)

- [x] Implementar advertencias claras antes de enviar código a la nube.
- [x] Configurar modo "Solo Local" estricto para entornos sensibles.
- [x] Añadir scrubbing de datos sensibles (API keys, tokens) antes del envío.

### Fase 3: UX Avanzada (Completado)

- [x] Mostrar "pensamiento" del agente mientras genera el código (UI de estado).
- [x] Permitir al usuario aceptar/rechazar cambios antes de aplicarlos (Diff View).
- [x] Botones rápidos para acciones comunes ("Explicar código", "Fix Bug").

### Fase 4: Premium UI Redesign (Nuevo)

- [x] **Container**: Backdrop blur, border ring, shadows.
- [x] **Header**: Gradient title, elegant badges.
- [x] **Chat**: Distinct bubbles (User: Primary Gradient, Bot: Card style).
- [x] **Empty State**: Clickable suggestion cards grid.
- [x] **Input**: Floating design, integrated controls.

### Fase 5: UI Polish & Aesthetics Overhaul (Corrective)

- [x] **Typography**: Import Inter/JetBrains Mono.
- [x] **Scrollbars**: Custom minimalist scrollbar implementation.
- [x] **Quick Actions**: Redesign to be subtle (ghost/outline), remove default rainbow colors.
- [x] **Input**: Refined containment, cleaner badges.
- [x] **Theme**: Ensure consistent HSL usage across all components.

## 4. Guía de Verificación

Para probar que el agente puede escribir en el editor:

1. Abrir el panel de Chat de IA.
2. Asegurarse de tener un archivo abierto en el editor.
3. Escribir: _"Escribe una función de Fibonacci en TypeScript y ponla en el editor"_ o _"Write a fibonacci function and put it in the editor"_.
4. El agente debería responder en el chat y, al finalizar, el código debería aparecer en el editor.
5. Si no ocurre, verificar la consola del navegador (F12) buscando logs con el prefijo `[CodeAgent]` o `[AIChat]`.
