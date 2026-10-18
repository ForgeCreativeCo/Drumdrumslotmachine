import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // Inline any art so the build stays a page plus scripts.
    assetsInlineLimit: 8 * 1024 * 1024,
  },
});
