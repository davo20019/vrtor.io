import { defineConfig } from 'vite';

// Served at vrtor.io/apo/ through the vrtor Worker (service binding), so the
// build lives under dist/apo/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/apo/',
  build: {
    outDir: 'dist/apo',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
