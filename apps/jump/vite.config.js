import { defineConfig } from 'vite';

// Served at vrtor.io/jump/ through the vrtor Worker (service binding), so the
// build lives under dist/jump/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/jump/',
  build: {
    outDir: 'dist/jump',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
