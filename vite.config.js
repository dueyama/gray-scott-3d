import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        about: fileURLToPath(new URL("./about.html", import.meta.url))
      }
    }
  }
});
