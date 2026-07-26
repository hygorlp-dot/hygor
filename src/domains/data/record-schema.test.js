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
