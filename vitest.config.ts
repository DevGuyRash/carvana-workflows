import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['packages/**/test/**/*.test.ts', 'packages/**/src/**/*.test.ts']
  },
  resolve: {
    alias: [
      { find: '@cv/core', replacement: path.resolve(__dirname, 'packages/core/src/index.ts') },
      { find: '@cv/core/', replacement: path.resolve(__dirname, 'packages/core/src/') }
    ]
  }
});
