import {defineConfig} from "vitest/dist/config.js";
import {backendTest} from "vitest-config-silverwind";

export default defineConfig({
  test: backendTest,
});
