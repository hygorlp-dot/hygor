import {defineConfig, mergeConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";
import {spreadsheetBrowserConfig} from "./scripts/spreadsheet-browser-config.mjs";
import {sharedSinapiWorker} from "./scripts/shared-sinapi-worker.mjs";

export default defineConfig(({mode})=>mergeConfig({
  plugins: [react(),sharedSinapiWorker()],
  // Evidências e builds locais não são fontes da aplicação. Observá-los
  // dispara recargas contínuas enquanto outras verificações estão rodando.
  server: {
    watch: {ignored: ["**/artifacts/**", "**/analises/**", "**/.impeccable/**", "**/test-results*/**", "**/playwright-report/**", "**/output/**"]},
  },
  resolve: {
    alias: {"@": fileURLToPath(new URL("./src", import.meta.url))},
  },
  // O formato padrão de worker do Vite é "iife" - incompatível com
  // `new Worker(url, {type:"module"})`, que sinapi-parser.worker.js e
  // orse-parser.worker.js usam. Sem "es" aqui, o worker não passa pelo
  // empacotamento de verdade: fica com o `import` relativo original,
  // sem nenhum arquivo de destino publicado, e falha ao instanciar no
  // navegador (raiz do "não lê as tabelas" do ORSE em produção).
  worker: { format: "es" },
  build: {
    // O navegador de produção não precisa receber 10+ MB de mapas contendo o
    // código-fonte completo. Previews e builds locais preservam os mapas para
    // diagnóstico; produção publica somente os artefatos executáveis.
    sourcemap: process.env.VERCEL_ENV === "production" ? false : "hidden",
    chunkSizeWarningLimit: 650,
    // Um Web Worker pequeno (como o do ORSE, orse-parser.worker.js) vira
    // uma data: URL inline por tamanho - mas nesse caminho o bundler não
    // resolve o `import` interno do worker (não existe "pasta" de uma
    // data: URL para resolver caminho relativo), e o worker falha ao
    // instanciar sem avisar - "não lê as tabelas" em produção era isso.
    // Workers nunca devem ser inlinados; assets de verdade (imagens,
    // fontes) continuam usando o limite padrão.
    assetsInlineLimit: (filePath) => filePath.includes(".worker.") ? false : undefined,
    rollupOptions: {
      output: {
        // Compacta apenas os prefixos dos arquivos; hashes e nomes com
        // orçamentos individuais permanecem intactos. O manifest mapeia a origem.
        chunkFileNames(chunk) {
          const name=chunk.name;
          const preserve=["LegacyApp","spreadsheet-tools","charts","vendor","ClientPortalApp"].includes(name)||/worker/i.test(name);
          const prefix=preserve?name:name==="rolldown-runtime"?"r":name.slice(0,3);
          return `assets/${prefix}-[hash].js`;
        },
        manualChunks(id) {
          // Shared interface primitives are loaded by the application shell.
          // Keeping them together avoids repeated import paths and independent
          // compression overhead across small chunks, without changing UI code.
          if(id.includes('/src/design-system/')||id.includes('/src/components/ui/'))return 'interface';
          // Os adaptadores legados já usam os mesmos controles. Mantê-los
          // junto da base compartilha a compressão, sem antecipar as telas.
          if(id.includes('/src/legacy/')||id.includes('/src/hooks/')||id.includes('/src/features/workflow/'))return 'interface';
          // O mesmo repertório de ícones atende todos os módulos. Compartilhar
          // a compressão evita o custo repetido dos pequenos chunks por ícone.
          if(id.includes('/node_modules/lucide-react/'))return 'interface';
          if(id.includes('/node_modules/fflate/')||id.endsWith('/src/lib/zip-reader.js'))return 'zip-codec';
          // Os gráficos compartilham Lodash com a leitura CSV do ExcelJS.
          // Um chunk comum evita vários blocos pequenos comprimidos à parte.
          if(id.includes("/node_modules/recharts/")||id.includes("/node_modules/lodash/"))return "charts";
          if (id.includes("exceljs")) return "spreadsheet-tools";
          if (
            id.includes("/src/domains/financeiro/")
            || id.includes("/src/domains/dre/")
            || id.includes("/src/domains/conciliacao/")
            || (id.includes('/src/domains/compras/')&&!id.includes('/components/')&&!id.endsWith('/LegacySupport.jsx')&&!id.endsWith('/export-sheets.js'))
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
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.{js,jsx}", "api/**/*.test.{js,jsx}", "scripts/**/*.test.{js,mjs}", "apps/ponto-obra/src/**/*.test.js"],
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
},mode==="test"?{}:spreadsheetBrowserConfig()));
