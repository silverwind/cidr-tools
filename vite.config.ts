import {defineConfig} from "vite";
import {lib} from "vite-config-silverwind";

export default defineConfig(lib({
  url: import.meta.url,
}));
