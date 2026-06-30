import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    forceRerunTriggers: ["**/tests/fixtures/**", "**/src/**"],
  },
});
