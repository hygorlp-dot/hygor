import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("TypeScript progressivo", () => {
  it("mantém o typecheck estrito limitado aos módulos incluídos no piloto", async () => {
    const source = await readFile(resolve(process.cwd(), "tsconfig.quality.json"), "utf8");
    const config = JSON.parse(source);

    expect(config.compilerOptions).toMatchObject({ allowJs: true, checkJs: false, jsx: "react-jsx", noEmit: true, strict: true });
    expect(config.include).toEqual([
      "server/attendance-archive-reader.js",
      "server/closed-dre-command-period.js",
      "server/command-role-policy.js",
      "server/legacy-client-portal.js",
      "server/legacy-save-contract.js",
      "server/legacy-save-retry.js",
      "server/load-company-workspace.js",
      "server/operational-command-audit.js",
      "server/operational-command-persistence.js",
      "server/persistence-health.js",
      "src/domains/administracao/components/Obsoletos.jsx",
      "src/domains/dashboard/operator-priorities.js",
      "src/domains/documentos/upload-retry.ts",
      "src/domains/medicoes/components/MedicaoEvolucao.jsx",
      "src/domains/medicoes/evolution-summary.js",
      "src/domains/obras/components/ObrasCarteira.jsx",
      "src/domains/obras/work-data-snapshot.js",
      "src/domains/orcamentos/budget-work-context.js",
      "src/domains/sync/save-queue.js",
      "src/features/relatorios/RelatoriosView.jsx",
      "src/features/workflow/ChatFlutuante.jsx",
      "src/features/workflow/Comunicacao.jsx",
      "src/features/workflow/use-workspace-saving.js",
      "src/navigation/BuscaGlobal.jsx",
      "src/navigation/global-search.js",
      "src/navigation/workflow-navigation-state.js",
      "src/observability/local-error-diagnostic.ts",
      "src/reports/work-cash-report.js",
      "src/types/react-dom.d.ts",
    ]);
    for (const file of config.include.filter(file => /\.jsx?$/.test(file))) {
      expect(await readFile(resolve(process.cwd(), file), "utf8")).toMatch(/^\/\/ @ts-check\b/);
    }
  });
});
