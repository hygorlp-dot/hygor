import { describe, expect, it } from "vitest";
import { APP_SCHEMA_VERSION, finalizeNormalizedData } from "./record-schema";

describe("schema versionado de registros legados", () => {
  it("preserva metadados, campos desconhecidos e cancelamento no round-trip", () => {
    const legacy = {
      schemaVersion: 2,
      medicoesObra: [{
        id: "mt-1", obraId: "obra-a", data: "2026-07-20", status: "cancelada",
        createdAt: "2026-07-20T10:00:00.000Z", canceladoEm: "2026-07-21T10:00:00.000Z",
        canceladoPorId: "u-1", motivoCancelamento: "Leitura incorreta", version: 4,
        campoFuturo: { preservado: true }, progressoAtualizadoEm: "2026-07-20T15:00:00.000Z",
      }],
    };
    legacy.usuarios = [{ id: "u-1", nome: "Ana", createdById: "u-0", versaoFutura: 7 }];
    const normalized = { schemaVersion: 4, medicoesObra: [{ id: "mt-1", obraId: "obra-a", status: "confirmada", data: "2026-07-20" }], usuarios: [{ id: "u-1", nome: "Ana" }] };
    const once = finalizeNormalizedData(legacy, normalized);
    const twice = finalizeNormalizedData(once, once);
    expect(once.medicoesObra[0]).toMatchObject({ status: "cancelada", version: 4, campoFuturo: { preservado: true }, canceladoPorId: "u-1" });
    expect(once.medicoesObra[0].progressoAtualizadoEm).toBe("2026-07-20T15:00:00.000Z");
    expect(once.usuarios[0]).toMatchObject({ createdById: "u-0", versaoFutura: 7 });
    expect(twice).toEqual(once);
    expect(once.schemaVersion).toBe(APP_SCHEMA_VERSION);
  });

  it("orçamento: preserva campos novos de itens e etapas e devolve a versão aprovada intacta", () => {
    const rascunho = { id: "orc-r", versionStatus: "rascunho",
      etapas: [{ id: "et-1", nome: "COBERTURA", parentId: "", pavimentoId: "cob", nivelM: 3.15 }],
      itens: [{ id: "it-1", etapaId: "et-1", quantidade: 2, memorialMedicao: { version: 1, model: "count" } }] };
    const aprovado = { id: "orc-a", versionStatus: "aprovado", lockedAt: "2026-09-30T12:50:42.313Z",
      etapas: [{ id: "et-9", nome: "Etapa", parentId: "", pavimentoId: "p1" }],
      itens: [{ id: "it-9", baseUf: "", memorialMedicao: { version: 1 } }] };
    // O que o normalizador da tela devolve hoje: lista fechada de campos.
    const normalizado = { orcamentos: [
      { id: "orc-r", versionStatus: "rascunho", etapas: [{ id: "et-1", nome: "COBERTURA", parentId: "" }], itens: [{ id: "it-1", etapaId: "et-1", quantidade: 2 }] },
      { id: "orc-a", versionStatus: "aprovado", etapas: [{ id: "et-9", nome: "ETAPA", parentId: "" }], itens: [{ id: "it-9", baseUf: "PE" }] },
    ] };
    const resultado = finalizeNormalizedData({ orcamentos: [rascunho, aprovado] }, normalizado);
    expect(resultado.orcamentos[0].etapas[0]).toMatchObject({ pavimentoId: "cob", nivelM: 3.15 });
    expect(resultado.orcamentos[0].itens[0].memorialMedicao).toEqual({ version: 1, model: "count" });
    expect(JSON.stringify(resultado.orcamentos[1])).toBe(JSON.stringify(aprovado));
    expect(finalizeNormalizedData(resultado, resultado).orcamentos).toEqual(resultado.orcamentos);
  });

  it("não inventa a data efetiva de registros históricos e cria uma pendência determinística", () => {
    const legacy = { medicoesObra: [{ id: "mt-sem-data", obraId: "obra-a", status: "confirmada" }] };
    const result = finalizeNormalizedData(legacy, { medicoesObra: [{ id: "mt-sem-data", obraId: "obra-a", data: "", status: "confirmada" }] });
    expect(result.medicoesObra[0].data).toBe("");
    expect(result.qualidadeDados).toEqual([expect.objectContaining({ chave: "data-efetiva-ausente:medicoesObra:mt-sem-data", status: "aberta" })]);
    expect(finalizeNormalizedData(result, result).qualidadeDados).toHaveLength(1);
  });

  it("migra boletim legado de modo idempotente e expõe divergência sem reescrever o fato",()=>{
    const legacy={medicoesObra:[{id:"mt-1",obraId:"obra-a",status:"confirmada",data:"2026-07-20",avancoFisico:80,itens:[{tarefaId:"t-1",custo:100,pctConfirmado:50}]}]};
    const once=finalizeNormalizedData(legacy,legacy);
    const twice=finalizeNormalizedData(once,once);
    expect(once.medicoesObra[0]).toMatchObject({schemaVersion:1,status:"aprovada",legacyStatus:"confirmada",dataMedicao:"2026-07-20",avancoFisico:80});
    expect(once.qualidadeDados).toEqual(expect.arrayContaining([expect.objectContaining({tipo:"medicao_tecnica_avanco_divergente",gravado:80,calculado:50})]));
    expect(twice).toEqual(once);
  });
});
