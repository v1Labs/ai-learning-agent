import path from "path";
import { defineConfig } from "vitest/config";

// Model evals (ADR 0018): real API calls, so they run only on demand:
//   EVAL_PDF=path/to/chapter.pdf npm run eval
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    environment: "node",
    testTimeout: 15 * 60_000,
    hookTimeout: 15 * 60_000,
    fileParallelism: false,
  },
});
