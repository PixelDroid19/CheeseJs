# AI SDK Documentation

The Vercel AI SDK is a library for building AI-powered applications with React, Svelte, Vue, and Solid.

## Core Concepts

1. **AI SDK Core**: A unified API for interacting with Large Language Models (LLMs).
2. **AI SDK UI**: A set of UI components and hooks for building chat interfaces.
3. **AI SDK RSC**: Helpers for React Server Components and streaming.

## Usage

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4-turbo'),
  prompt: 'What is the capital of France?',
});
```
