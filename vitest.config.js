import {defineConfig} from "vitest/config";
import {backendTest} from "vitest-config-silverwind";

export default defineConfig({
  test: backendTest({
    url: import.meta.url,
  }),
});
