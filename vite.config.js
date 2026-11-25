import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'esnext' },
  esbuild: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: { host: true },
});
