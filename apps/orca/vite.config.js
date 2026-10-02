import { defineConfig } from 'vite';

// Served at vrtor.io/orca/ through the vrtor Worker (service binding), so the
// build lives under dist/orca/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/orca/',
  build: {
    outDir: 'dist/orca',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
