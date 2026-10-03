import { defineConfig } from 'vite';

// Served at vrtor.io/cyb/ through the vrtor Worker (service binding), so the
// build lives under dist/cyb/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/cyb/',
  build: {
    outDir: 'dist/cyb',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
