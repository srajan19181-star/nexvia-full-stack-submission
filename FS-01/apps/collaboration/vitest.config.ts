import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@nexvia/database": path.resolve(import.meta.dirname, "../../packages/database/src/index.ts"),
      "@nexvia/shared/server-crypto": path.resolve(import.meta.dirname, "../../packages/shared/src/server-crypto.ts"),
      "@nexvia/shared": path.resolve(import.meta.dirname, "../../packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
