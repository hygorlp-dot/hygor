import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {"@": fileURLToPath(new URL("./src", import.meta.url))},
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("exceljs")) return "spreadsheet-tools";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  test: {
    testTimeout: 10000,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.js"],
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.{js,jsx}"],
    exclude: ["node_modules/**", ".agents/**", ".claude/**", ".claude-flow/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/domains/**/*.js"],
      thresholds: {
        statements: 75,
        branches: 55,
        functions: 70,
        lines: 80,
      },
    },
  },
});
