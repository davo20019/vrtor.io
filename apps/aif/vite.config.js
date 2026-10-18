import { defineConfig } from 'vite';

// Served at vrtor.io/aif/ through the vrtor Worker (service binding), so the
// build lives under dist/aif/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/aif/',
  build: {
    outDir: 'dist/aif',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
