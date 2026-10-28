import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("FIN 9.6 — prévia mensal na Central do Administrador",()=>{
  const panel=readFileSync("src/domains/administracao/components/FinanceiroCanonicoAdmin.jsx","utf8");
  const preview=readFileSync("src/domains/administracao/components/FechamentoFinanceiroAdmin.jsx","utf8");

  it("integra a prévia dentro do painel financeiro administrativo",()=>{
    expect(panel).toContain('import FechamentoFinanceiroAdmin from "./FechamentoFinanceiroAdmin"');
    expect(panel).toContain("<FechamentoFinanceiroAdmin/>");
  });

  it("consulta a prévia canônica e não executa fechamento",()=>{
    expect(preview).toContain("consultarPreviaFechamentoFinanceiro");
    expect(preview).toContain("Gerar prévia");
    expect(preview).toContain("Prévia da competência");
    expect(preview).not.toContain("executarComandoFinanceiro");
    expect(preview).not.toContain("CLOSE_ACCOUNTING_PERIOD");
    expect(preview).not.toContain("Confirmar fechamento");
  });

  it("deixa explícito que a ação destrutiva permanece indisponível",()=>{
    expect(preview).toContain("SEM AÇÃO DE FECHAMENTO");
    expect(preview).toContain("confirmar fechamento permanece deliberadamente indisponível");
    expect(preview).toContain("guards de imutabilidade");
  });

  it("exibe os valores que serão congelados sem aceitá-los como entrada",()=>{
    for(const label of [
      "Receita","Custos","Resultado","Entradas de caixa","Saídas de caixa",
      "Saldo caixa no período","A receber","A pagar","Comprometido",
    ])expect(preview).toContain(label);
    expect(preview).toContain("snapshot.revenueCents");
    expect(preview).toContain("snapshot.costCents");
    expect(preview).toContain("snapshot.resultCents");
    expect(preview).not.toMatch(/onChange=.*revenueCents/);
    expect(preview).not.toMatch(/onChange=.*costCents/);
  });
});
