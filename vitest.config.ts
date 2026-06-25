import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
    },
  },
  test: {
    environment: 'node',
    // lib logic + the first component tests (rendered via react-dom/server — no jsdom).
    include: ['lib/**/*.test.ts', 'components/**/*.test.tsx'],
  },
});
