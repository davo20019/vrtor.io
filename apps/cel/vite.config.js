import { defineConfig } from 'vite';

// Served at vrtor.io/cel/ through the vrtor Worker (service binding), so the
// build lives under dist/cel/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/cel/',
  build: {
    outDir: 'dist/cel',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
