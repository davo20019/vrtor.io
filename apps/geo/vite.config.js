import { defineConfig } from 'vite';

// Served at vrtor.io/geo/ through the vrtor Worker (service binding), so the
// build lives under dist/geo/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/geo/',
  build: {
    outDir: 'dist/geo',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
