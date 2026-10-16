import { defineConfig } from 'vite';

// Served at vrtor.io/rds/ through the vrtor Worker (service binding), so the
// build lives under dist/rds/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/rds/',
  build: {
    outDir: 'dist/rds',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
