import { defineConfig } from 'vite';

// Served at vrtor.io/hrt/ through the vrtor Worker (service binding), so the
// build lives under dist/hrt/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/hrt/',
  build: {
    outDir: 'dist/hrt',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
