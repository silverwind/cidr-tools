import {defineConfig} from "vitest/dist/config.js";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20000,
    open: false,
    allowOnly: true,
    passWithNoTests: true,
    globals: true,
    watch: false,
    outputDiffLines: Infinity,
    outputDiffMaxLines: Infinity,
    outputDiffMaxSize: Infinity,
    outputTruncateLength: Infinity,
  },
});
