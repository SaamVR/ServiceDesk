import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Node-native smoke contracts have their own explicit "node --test"
  // execution in release CI. Do not misinterpret them as Vitest suites.
  test: {
    exclude: [...configDefaults.exclude, "scripts/release/**/*.test.mjs"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
