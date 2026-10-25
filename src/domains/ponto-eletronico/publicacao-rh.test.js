// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { produzirPublicacaoRh } from "./publicacao-rh.js";
const hash = s => createHash("sha256").update(s).digest("hex");
const caso = () => ({ companyId: "teste", employeeId: "e1", dataOperacional: "2026-10-25", fuso: "America/Bahia", revisao: 1, tratamentoVersao: "1",
  aprovacao: { estado: "aprovado", responsavelId: "rh1", em: "2026-10-26T12:00:00Z" },
  eventos: ["2026-10-25T23:00:00Z", "2026-10-26T02:00:00Z", "2026-10-26T05:00:00Z"].map((marcadoEm, i) => ({ companyId: "teste", employeeId: "e1", tipoRegistro: "ponto", eventId: `ev${i}`, dispositivoId: `d${i}`, estabelecimentoId: "s1", nsr: String(i + 1), marcadoEm, obraCapturaId: i ? "obra2" : "obra1" })),
  intervalos: [{ inicio: "2026-10-25T23:00:00Z", fim: "2026-10-26T02:00:00Z", obraApropriadaId: "obra1", eventos: ["ev0", "ev1"] }, { inicio: "2026-10-26T02:00:00Z", fim: "2026-10-26T05:00:00Z", obraApropriadaId: "obra2", eventos: ["ev1", "ev2"] }] });
describe("publicação Android para RH", () => {
  it("preserva multiobra, meia-noite, origem e confirmação sem calcular salário", () => {
    const result = produzirPublicacaoRh(caso(), hash);
    expect(result.estado).toBe("aprovado");
    expect(result.intervalos.map(i => i.duracaoMs)).toEqual([10800000, 10800000]);
    expect(result.eventos[2]).toMatchObject({ eventId: "ev2", dispositivoId: "d2", nsr: "3" });
    expect(result).not.toHaveProperty("valor");
  });
  it("reprocessamento antigo mantém identidade, independente de ordenação", () => {
    const input = caso(), a = produzirPublicacaoRh(input, hash);
    input.eventos.reverse(); input.intervalos.reverse(); input.intervalos.forEach(i => i.eventos.reverse());
    expect(produzirPublicacaoRh(input, hash)).toEqual(a);
    input.revisao = 2;
    expect(produzirPublicacaoRh(input, hash).publicacaoId).not.toBe(a.publicacaoId);
    input.revisao = 1;
    expect(produzirPublicacaoRh(input, hash)).toEqual(a);
  });
  it("mesma revisão com conteúdo diferente mantém chave e denuncia conflito pelo hash", () => {
    const input = caso(), a = produzirPublicacaoRh(input, hash);
    input.intervalos[0].obraApropriadaId = "outra";
    const b = produzirPublicacaoRh(input, hash);
    expect(b.publicacaoId).toBe(a.publicacaoId); expect(b.conteudoHash).not.toBe(a.conteudoHash);
  });
  it("fechamento, confirmação ausente e origem incompleta nunca viram aprovação ou falta", () => {
    const input = caso(); input.periodoFechado = true; input.eventos[0].nsr = null; input.intervalos.pop();
    const result = produzirPublicacaoRh(input, hash);
    expect(result.estado).toBe("pendente");
    expect(result.excecoes).toEqual(["confirmacao_fiscal_pendente", "jornada_incompleta", "revisao_periodo_fechado"]);
  });
  it("recusa terceiros, origem externa e intervalos sem origem", () => {
    for (const mutate of [x => x.eventos[0].tipoRegistro = "acesso", x => x.eventos[0].companyId = "outra", x => x.intervalos[0].eventos = []]) {
      const input = caso(); mutate(input); expect(() => produzirPublicacaoRh(input, hash)).toThrow();
    }
  });
});
