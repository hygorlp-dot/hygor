import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");

// atualizarDadosObra (dentro de ObraDetalhe) embrulha o `update` global e é
// passado como prop `update` para as telas internas da obra (Terceiros,
// Orçamento, Planejamento, etc.). O `update` global é async e resolve para
// {ok,reason,...}; várias dessas telas fazem `const result=await update(...)`
// e só mostram sucesso quando `result.ok` é verdadeiro. Se este wrapper
// descartar a Promise em vez de devolvê-la, `result` vira `undefined` e toda
// falha de salvamento (conflito de versão, rede, validação rejeitada) passa
// a ser tratada como sucesso silencioso — o modal fecha e o toast de sucesso
// aparece mesmo sem nada ter sido persistido.
describe("atualizarDadosObra propaga o resultado de update para as telas internas da obra", () => {
  it("retorna a Promise de update nos dois ramos (atualização funcional e objeto direto)", () => {
    const inicio = source.indexOf("const atualizarDadosObra=useCallback(");
    expect(inicio).toBeGreaterThan(-1);
    const corpo = source.slice(inicio, inicio + 500);
    expect(corpo).toContain("return update(atual=>{");
    expect(corpo).toContain("return update(recomporDadosDaObra(data,proximos,obraId));");
  });
});
