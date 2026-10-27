import { defineConfig } from 'vite';

// Served at vrtor.io/sacre/ through the vrtor Worker (service binding), so the
// build lives under dist/sacre/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: '/sacre/',
  build: {
    outDir: 'dist/sacre',
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
