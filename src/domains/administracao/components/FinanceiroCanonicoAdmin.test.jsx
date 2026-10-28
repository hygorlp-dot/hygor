import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("Central do Administrador — gate FIN 9.6",()=>{
  it("expõe o diagnóstico financeiro como ferramenta administrativa",()=>{
    const central=readFileSync("src/domains/administracao/components/CentralAdministradorView.jsx","utf8");
    expect(central).toContain('id:"financeiro",label:"Motor financeiro"');
    expect(central).toContain("<FinanceiroCanonicoAdmin");
  });

  it("o painel é somente leitura e não oferece ativação ou sincronização",()=>{
    const panel=readFileSync("src/domains/administracao/components/FinanceiroCanonicoAdmin.jsx","utf8");
    expect(panel).toContain("consultarSombraFinanceira");
    expect(panel).toContain("activationGate");
    expect(panel).toContain("missingLegacyLinks");
    expect(panel).toContain("Esta tela não ativa o motor financeiro");
    expect(panel).not.toContain("sincronizarSombraFinanceira");
    expect(panel).not.toContain("prepararSombraFinanceira");
    expect(panel).not.toContain("FINANCIAL_ENGINE_ENFORCE=");
    expect(panel).not.toContain("update_project_env");
  });

  it("mostra os critérios do gate e suporta a integridade estrutural",()=>{
    const panel=readFileSync("src/domains/administracao/components/FinanceiroCanonicoAdmin.jsx","utf8");
    for(const code of [
      "snapshot_writers","shadow_has_facts","shadow_run","ledger_divergence",
      "dre_divergence","procurement_dre_divergence","legacy_links","quality_cases",
      "canonical_integrity",
    ])expect(panel).toContain(code);
    expect(panel).toContain("passedChecks");
    expect(panel).toContain("totalChecks");
    expect(panel).toContain("Erros estruturais");
    expect(panel).not.toContain("8/8 GATES");
  });
});
