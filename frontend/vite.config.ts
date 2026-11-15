/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(fileURLToPath(new URL(".", import.meta.url))),
        fileURLToPath(new URL("../internal/firmware", import.meta.url)),
      ],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
  },
});
