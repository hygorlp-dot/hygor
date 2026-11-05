// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { snapshotFixture, opts } from "./fixtures.test-helper.js";
import { auditarSnapshot } from "./auditoria.js";
import { avaliarProntidaoFiscal } from "./prontidao.js";
import { emitirDocumentoFiscal } from "./emissao.js";
import { sha256 } from "./campos.js";
import { comprovanteParaAssinaturaHtml } from "./pdf.js";

const evidencia = { sha256: "a".repeat(64), responsavel: "teste-sintetico", conferidoEm: opts.geradoEm };
async function fixture() {
  const s = await snapshotFixture();
  s.config.registroInpi = { ...evidencia, numero: s.config.rep.inpi };
  s.config.atestadoTecnico = evidencia;
  s.config.locaisPorObra = { "obra-sintetica": { endereco: s.config.localPrestacao } };
  return s;
}
const assinatura = async ({ bytes, padrao }) => {
  const output = padrao === "PAdES" ? Buffer.concat([bytes, Buffer.from("\n% assinatura simulada apenas neste teste unitario")]) : Buffer.from("p7s somente teste unitario");
  return { bytes: output, verificacao: { padrao, integridade: true, confiavel: true, icpBrasil: true,
    documentoInteiro: true, desenvolvedorConferido: true, revogacao: "verificada",
    entradaSha256: sha256(bytes), saidaSha256: sha256(output), certificadoSha256: "b".repeat(64), validadoEm: opts.geradoEm } };
};
const renderer = async model => Buffer.from("%PDF-1.7\n" + comprovanteParaAssinaturaHtml(model));
const options = s => ({ tipo: "comprovante", ...opts, eventId: s.eventos[0].event_id });

describe("emissão fiscal bloqueada por padrão", () => {
  it("número INPI isolado não é prova e prontidão nunca certifica o sistema", async () => {
    const s = await snapshotFixture(), status = avaliarProntidaoFiscal(s, await auditarSnapshot(s));
    expect(status.podePrepararEmissao).toBe(false);
    expect(status.conforme).toBe(false);
    expect(status.requisitos.find(r => r.codigo === "INPI").status).toBe("pendente");
    const signer = vi.fn();
    await expect(emitirDocumentoFiscal(s, options(s), { assinarEValidar: signer })).rejects.toThrow("FORMALIZACAO_FISCAL_PENDENTE");
    expect(signer).not.toHaveBeenCalled();
  });
  it("exige serviço de assinatura e renderer, preserva snapshots e não confunde documento com conformidade", async () => {
    const s = await fixture(), before = JSON.stringify(s);
    await expect(emitirDocumentoFiscal(s, options(s))).rejects.toThrow("ASSINADOR_ICP_BRASIL_NAO_CONFIGURADO");
    await expect(emitirDocumentoFiscal(s, options(s), { assinarEValidar: assinatura })).rejects.toThrow("RENDERIZADOR_PDF_NAO_CONFIGURADO");
    const result = await emitirDocumentoFiscal(s, options(s), { renderizarPdf: renderer, assinarEValidar: assinatura });
    expect(result.manifesto.status).toBe("assinado_validado");
    expect(result.manifesto.conformidadeGlobal).toBe(false);
    expect(result.bytes.toString()).not.toContain("Rascunho");
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each(["icpBrasil", "integridade", "confiavel", "documentoInteiro", "desenvolvedorConferido"])("não libera documento com %s falso", async field => {
    const s = await fixture();
    await expect(emitirDocumentoFiscal(s, options(s), { renderizarPdf: renderer, assinarEValidar: async args => {
      const result = await assinatura(args); result.verificacao[field] = false; return result;
    } })).rejects.toThrow("ASSINATURA_NAO_VALIDADA");
  });
  it.each(["revogacao", "entradaSha256", "saidaSha256", "padrao"])("recusa relatório incompleto ou incompatível: %s", async field => {
    const s = await fixture();
    await expect(emitirDocumentoFiscal(s, options(s), { renderizarPdf: renderer, assinarEValidar: async args => {
      const result = await assinatura(args); delete result.verificacao[field]; return result;
    } })).rejects.toThrow("ASSINATURA_NAO_VALIDADA");
  });
  it("não assina quando faltam local, nome, captura ou quando a origem foi adulterada", async () => {
    for (const mode of ["local", "nome", "captura", "integridade"]) {
      const s = await fixture(), signer = vi.fn(assinatura);
      if (mode === "local") { s.config.localPrestacao = ""; s.config.locaisPorObra = {}; }
      if (mode === "nome") s.employees = [];
      if (mode === "captura") delete s.eventos[0].payload.offline;
      if (mode === "integridade") s.eventos[0].cpf = "00000000000";
      await expect(emitirDocumentoFiscal(s, options(s), { renderizarPdf: renderer, assinarEValidar: signer })).rejects.toThrow();
      expect(signer).not.toHaveBeenCalled();
    }
  });
  it("AFD assinado conserva bytes e separa a assinatura P7S", async () => {
    const s = await fixture(), result = await emitirDocumentoFiscal(s, { tipo: "afd", ...opts }, { assinarEValidar: assinatura });
    expect(result.assinaturaDestacada.nome).toBe(result.nome + ".p7s");
    expect(result.manifesto.padrao).toBe("CAdES detached");
    expect(sha256(result.bytes)).toBe(result.manifesto.origemSha256);
  });
  it("conteúdo de empregado não injeta HTML ou scripts no PDF", () => {
    const html = comprovanteParaAssinaturaHtml({ fields: [["Nome", '<script>alert("x")</script>']] });
    expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
  });
});
