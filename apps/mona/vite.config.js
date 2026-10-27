import { defineConfig } from 'vite';

// Served at vrtor.io/mona/ through the vrtor Worker (service binding), so the
// build lives under dist/mona/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/mona/',
  build: {
    outDir: 'dist/mona',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
