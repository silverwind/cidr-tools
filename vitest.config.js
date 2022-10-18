import {defineConfig} from "vitest/dist/config.js";

export default defineConfig({
  test: {
    include: ["**/test.js", "**/*.test.js"],
    environment: "node",
    testTimeout: 20000,
    open: false,
    allowOnly: true,
    passWithNoTests: true,
    globals: true,
    watch: false,
  },
});
