import {defineConfig, mergeConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";
import {realpathSync} from 'node:fs';
import {spreadsheetBrowserConfig} from "./scripts/spreadsheet-browser-config.mjs";
import {sharedSinapiWorker} from "./scripts/shared-sinapi-worker.mjs";
import {sharedChartHelpers} from './scripts/shared-chart-helpers.mjs';
import {sharedUiHelpers} from './scripts/shared-ui-helpers.mjs';
import {operationalChartScales} from './scripts/operational-chart-scales.mjs';
import {legacyScreenChunks} from './scripts/legacy-screen-chunks.mjs';
import {pdfjsModuleExports} from './scripts/pdfjs-module-exports.mjs';
import {minifyVendorChunks} from './scripts/minify-vendor-chunks.mjs';

const projectRoot=fileURLToPath(new URL('.',import.meta.url));
// Worktrees may share only node_modules through a junction. Permit that exact
// dependency tree without granting access to sibling workspaces or evidence.
const dependencyRoot=realpathSync(fileURLToPath(new URL('./node_modules',import.meta.url)));
export default defineConfig(({mode})=>mergeConfig({
  plugins: [legacyScreenChunks(),react(),sharedSinapiWorker(),sharedChartHelpers(),sharedUiHelpers(),operationalChartScales(),pdfjsModuleExports(),minifyVendorChunks()],
  // Restrinja a descoberta ao aplicativo: builds e evidências HTML em
  // artifacts não são entradas de desenvolvimento.
  optimizeDeps: {entries:["index.html"]},
  // Evidências e builds locais não são fontes da aplicação. Observá-los
  // dispara recargas contínuas enquanto outras verificações estão rodando.
  server: {
    fs:{allow:[projectRoot,dependencyRoot]},
    watch: {ignored: ["**/artifacts/**", "**/analises/**", "**/.impeccable/**", "**/test-results*/**", "**/playwright-report/**", "**/output/**"]},
  },
  resolve: {
    // Gráficos operacionais exibem o estado final, preservando o contrato
    // de renderização do Recharts sem carregar seu motor de interpolação.
    alias: [
      {find:"@",replacement:fileURLToPath(new URL("./src",import.meta.url))},
      {find:/^react-smooth$/,replacement:fileURLToPath(new URL("./src/components/charts/ChartFinalState.jsx",import.meta.url))},
    ],
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
          const prefix=preserve?name:name==="financial-domain"?"fi":name.slice(0,1);
          return `assets/${prefix}-[hash].js`;
        },
        codeSplitting: {
          // React e a base da sessão também são usados na entrada. A prioridade
          // impede que sejam absorvidos pelos grupos operacionais abaixo.
          groups: [
            { name: "vendor", test: /\/node_modules\/(?:react|react-dom|scheduler|clsx)\//, priority: 100 },
            { name: "workspace-styles", test: /\/src\/(?:domains|features)\/.+\.css$/, priority: 50 },
            { name: "interface", test: /\/(?:src\/(?:lib\/lazy-with-css-retry\.js|features\/help\/HelpContext\.jsx)$|(?:src\/(?:design-system|components\/ui|legacy|hooks)|node_modules\/lucide-react)\/)/, priority: 40 },
            // Telas do mesmo fluxo de Compras compartilham compressão após o login.
            { name: "procurement-ui", test: /\/src\/domains\/compras\/components\/(?:PurchaseDossier|PurchaseConference|PurchaseFinalCost|PurchaseWorkspace|PurchasesByWork|ReceiptModal|QuoteComparisonWorkspace)/, priority: 35 },
            { name: "zip-codec", test: /\/(?:node_modules\/fflate\/|src\/lib\/zip-reader\.js$)/, priority: 30 },
            { name: "charts", test: /\/node_modules\/(?:recharts|lodash)\//, priority: 20 },
            // Gráficos financeiros compartilham compressão no primeiro acesso a um deles.
            { name: "financial-chart-views", test: /\/src\/components\/charts\/(?:RelatoriosChartPanel|FinanceiroCharts|Dre(?:EmpresaHistorico|FaturamentoResultado|DistribuicaoCustos|Margem)Chart)\.jsx$/, priority: 25, includeDependenciesRecursively: false },
            { name: "spreadsheet-tools", test: /exceljs/, priority: 10 },
            // Telas de obra sob demanda compartilham o chunk sem antecipar dependências da entrada.
            { name: "project-checks", test: /\/src\/domains\/(?:qualidade\/components\/ConferenciaView|licenciamento\/components\/LicenciamentoView|medicoes\/components\/MedicoesView|obras\/components\/DiarioObraView)\.jsx$/, priority: 25, includeDependenciesRecursively: false },
            // Deltas e telemetria da API ficam com as dependências compartilhadas.
            // O grupo financeiro só reúne domínios usados na operação.
            { name: "financial-domain", test: /\/src\/domains\/(?:financeiro|dre|conciliacao|compras\/(?!components\/|.*(?:LegacySupport\.jsx|export-sheets\.js)$))/, priority: 0 },
          ],
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
