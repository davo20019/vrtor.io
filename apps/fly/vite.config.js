import { defineConfig } from 'vite';

// Served at vrtor.io/fly/ through the vrtor Worker (service binding), so the
// build lives under dist/fly/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/fly/',
  build: {
    outDir: 'dist/fly',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
