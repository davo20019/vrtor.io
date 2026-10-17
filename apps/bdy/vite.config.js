import { defineConfig } from 'vite';

// Served at vrtor.io/bdy/ through the vrtor Worker (service binding), so the
// build lives under dist/bdy/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/bdy/',
  build: {
    outDir: 'dist/bdy',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
