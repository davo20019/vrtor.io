import { defineConfig } from 'vite';

// Served at vrtor.io/giza/ through the vrtor Worker (service binding), so the
// build lives under dist/giza/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/giza/',
  build: {
    outDir: 'dist/giza',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
