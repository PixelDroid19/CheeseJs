# AI SDK LLM Example

This example demonstrates how to use the AI SDK with a custom LLM provider.

## Setup

1. Install dependencies:

   ```bash
   npm install ai @ai-sdk/openai
   ```

2. Configure your API key.

## Streaming Response

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4-turbo'),
    messages,
  });

  return result.toDataStreamResponse();
}
```
