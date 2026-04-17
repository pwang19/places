import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@places/shared": path.resolve(
        __dirname,
        "../packages/shared/src/index.ts"
      ),
    },
  },
  plugins: [react()],
  server: {
    port: 3000,
  },
});
