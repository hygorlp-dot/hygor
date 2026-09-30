import { describe, expect, it } from "vitest";
import { verificarArquivo } from "../../scripts/check-ui-pitfalls.mjs";

// Cada caso é um bug real que chegou à produção (29-30/09/2026) sem derrubar a
// tela. Se o verificador deixar de pegar algum, o lint volta a ficar cego a ele.
const regras = codigo => verificarArquivo(codigo, "x.jsx").map(a => a.regra);

describe("check-ui-pitfalls", () => {
  it("pega handler com parâmetro padrão ligado direto no evento (baseline, rescisão, nova medição)", () => {
    const codigo = [
      "const aprovar = (budgetId=selOrc) => {};",
      "const x = <Btn onClick={aprovar}>Aprovar</Btn>;",
    ].join("\n");
    expect(regras(codigo)).toContain("handler-com-padrao");
    expect(regras("const aprovar = (id=sel) => {};\nconst x = <Btn onClick={()=>aprovar(o.id)}/>;")).not.toContain("handler-com-padrao");
  });

  it("pega janela aberta com noopener que depois recebe document.write (cronograma em branco)", () => {
    expect(regras('const w=window.open("","_blank","noopener,noreferrer");\nw.document.write(html);')).toContain("janela-noopener");
    expect(regras('const w=window.open("","_blank");w.opener=null;w.document.write(html);')).not.toContain("janela-noopener");
  });

  it("pega símbolo apagado em texto de documento (fórmula do BDI, m², separadores)", () => {
    expect(regras("const h = `<p>BDI = [ (1 + L)  (1  I) ]  1</p>`;")).toContain("simbolo-perdido");
    expect(regras("const h = `<div>Gerado por ARCD  ${new Date().toLocaleString()}</div>`;")).toContain("simbolo-perdido");
    expect(regras('const p = <p>{n} obra(s) com caixa  aportes do cliente</p>;')).toContain("simbolo-perdido");
    expect(regras('const s = [a,b].filter(Boolean).join("  ");')).toContain("simbolo-perdido");
  });

  it("não confunde alinhamento de código ou de propriedades com texto", () => {
    expect(regras("if (nSub)   aviso += ` ${nSub} subetapa(s)`;")).toEqual([]);
    expect(regras('<Nm v={s.itens}    l="itens na planilha"/>')).toEqual([]);
    expect(regras("  const a = 1;   // comentário   alinhado")).toEqual([]);
  });

  it("pega codificação quebrada e respeita a exceção pontual", () => {
    expect(regras('const t = "OrÃ§amento";')).toContain("mojibake");
    expect(regras('const t = "OrÃ§amento"; // lint-ok: mojibake')).toEqual([]);
  });
});
