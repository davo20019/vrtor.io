import { defineConfig } from 'vite';

// Served at vrtor.io/spc/ through the vrtor Worker (service binding), so the
// build lives under dist/spc/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/spc/',
  build: {
    outDir: 'dist/spc',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
