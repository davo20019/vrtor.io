import { defineConfig } from "vite";

// Served at vrtor.io/mpc/ through the vrtor Worker (service binding), so the
// build lives under dist/mpc/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: "/mpc/",
  build: {
    outDir: "dist/mpc",
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
