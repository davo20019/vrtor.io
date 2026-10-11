import { defineConfig } from 'vite';

export default defineConfig({
  base: '/snd/',
  build: { outDir: 'dist/snd', emptyOutDir: true, chunkSizeWarningLimit: 6000 },
});
