import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@nexvia/shared",
        replacement: path.resolve(import.meta.dirname, "../../packages/shared/src/index.ts"),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
    ],
  },
  server: {
    port: 5_173,
    strictPort: true,
  },
  preview: {
    port: 4_173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
