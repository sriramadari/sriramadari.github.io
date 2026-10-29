import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build` -> normal static build in dist/ (deploy this)
// `npm run build:single` -> one self-contained index.html in dist-single/
export default defineConfig(({ mode }) => ({
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react()],
  resolve: {
    alias: {
      // Node-only code path in mcp-devkit; see src/lab/stdio-stub.ts.
      "@modelcontextprotocol/sdk/client/stdio.js": decodeURIComponent(new URL("./src/lab/stdio-stub.ts", import.meta.url).pathname),
    },
  },
  build: { outDir: mode === "single" ? "dist-single" : "dist" },
}));
