# AI Chat - Arquitectura Modular

## Estructura de Componentes

El nuevo AI Chat está dividido en componentes modulares para mejor mantenibilidad:

```
src/components/AI/
├── AIChat.tsx              # Componente principal del chat (contenedor)
├── ChatMessage.tsx         # Muestra mensajes individuales (user/assistant)
├── ChatInput.tsx           # Input de texto con controles
├── MarkdownRenderer.tsx    # Renderiza Markdown con code blocks
├── ToolInvocationUI.tsx    # Muestra invocaciones de herramientas del agente
├── AgentThinkingIndicator.tsx  # Indicador de "pensando"
├── DiffView.tsx            # Vista de diff para cambios de código
├── QuickActions.tsx        # Acciones rápidas (refactor, explain, etc.)
├── CloudWarningDialog.tsx  # Diálogo de advertencia para cloud providers
└── ChatToolsMenu.tsx       # Menú de herramientas del chat
```

## Componentes Principales

### 1. ChatMessage

- Muestra mensajes de usuario y asistente
- Maneja avatares y estilos diferentes por rol
- Renderiza contenido Markdown
- Props:
  ```tsx
  interface ChatMessageProps {
    message: Message;
    onInsertCode?: (code: string) => void;
  }
  ```

### 2. ChatInput

- Textarea con auto-resize
- Botón de envío
- Controles de contexto (incluir código, knowledge base)
- Soporte para Shift+Enter (nueva línea)
- Props:
  ```tsx
  interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled?: boolean;
    isLoading?: boolean;
    placeholder?: string;
    includeCode?: boolean;
    onIncludeCodeChange?: (include: boolean) => void;
  }
  ```

### 3. MarkdownRenderer

- Parsea y renderiza Markdown
- Soporte para:
  - Code blocks con syntax highlighting
  - Listas (ordenadas/desordenadas)
  - Headers (h1-h6)
  - Blockquotes
  - Inline code
  - Bold/Italic
- Acciones en code blocks:
  - Copiar código
  - Insertar en editor

## Integración con Filesystem Tools

Los nuevos filesystem tools están integrados en el agente:

```typescript
// En codeAgent.ts
const tools = {
  readFile: { ... },
  writeFile: { ... },
  listFiles: { ... },
  searchInFiles: { ... },
  executeCommand: { ... },
  deleteFile: { ... },
  getWorkspacePath: { ... },
};
```

## Flujo de Datos

```
Usuario escribe mensaje
     ↓
ChatInput emite onSend()
     ↓
AIChat.tsx procesa mensaje
     ↓
createCodeAgent() con tools
     ↓
Agent ejecuta tools (filesystem, etc.)
     ↓
Respuesta renderizada en ChatMessage
     ↓
MarkdownRenderer muestra contenido
```

## Próximos Pasos

1. Crear componente para Tool Invocations
2. Agregar soporte para slash commands
3. Implementar file mentions (@file)
4. Agregar historial de mensajes
5. Mejorar estilos siguiendo diseño de KiloCode
