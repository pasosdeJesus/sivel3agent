/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
  },
  // Usar Rollup WASM en plataformas sin binario nativo (ej: OpenBSD)
  resolve: process.platform === 'openbsd' ? {
    conditions: ['wasm'],
  } : undefined,
});
