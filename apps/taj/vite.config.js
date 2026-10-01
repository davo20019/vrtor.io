import { defineConfig } from "vite";

// Served at vrtor.io/taj/ through the vrtor Worker (service binding), so the
// build lives under dist/taj/ and the Worker's asset paths match the URL.
export default defineConfig({
  base: "/taj/",
  build: {
    outDir: "dist/taj",
    emptyOutDir: true,
    chunkSizeWarningLimit: 6000,
  },
});
