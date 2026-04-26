import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['electron/workers/__test__/workers.test.ts'],
  },
});
