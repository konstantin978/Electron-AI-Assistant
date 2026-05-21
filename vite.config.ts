import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: join(__dirname, "electron/renderer"),
  base: "./",
  build: {
    outDir: join(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
});
