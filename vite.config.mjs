import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {"@": fileURLToPath(new URL("./src", import.meta.url))},
  },
  build: {
    // O navegador de produção não precisa receber 10+ MB de mapas contendo o
    // código-fonte completo. Previews e builds locais preservam os mapas para
    // diagnóstico; produção publica somente os artefatos executáveis.
    sourcemap: process.env.VERCEL_ENV !== "production",
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("exceljs")) return "spreadsheet-tools";
          if (
            id.includes("/src/domains/financeiro/")
            || id.includes("/src/domains/dre/")
            || id.includes("/src/domains/conciliacao/")
          ) return "financial-domain";
          // As demais dependências compartilhadas ficam a cargo do
          // particionamento automático do Rolldown.
        },
      },
    },
  },
  test: {
    testTimeout: 10000,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.js"],
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.{js,jsx}", "api/**/*.test.{js,jsx}"],
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
