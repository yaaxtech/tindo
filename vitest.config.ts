import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Testes de componente (.test.tsx) precisam do JSX transformado sozinho —
  // o tsconfig deixa isso para o Next, que não roda dentro do vitest.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    exclude: ['.claude/**', 'node_modules/**', '.next/**', 'supabase/**', 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
