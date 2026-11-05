// @vitest-environment node
import { describe, expect, it } from "vitest";
import { snapshotFixture } from "./fixtures.test-helper.js";
import { auditarSnapshot, registroFiscalDoBanco } from "./auditoria.js";
import { calcularHashLocal } from "../../../src/domains/ponto-eletronico/evento.js";
import { calcularHashFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";
import { sha256 } from "./campos.js";

// Reconstrói apenas a fixture sintética isolada, simulando o formato original
// aceito antes de o aparelho conhecer o estabelecimento vinculado pelo servidor.
async function legado(estabelecimentoOriginal) {
  const s = await snapshotFixture({ withMode: false });
  let anteriorLocal = "0".repeat(64), anteriorFiscal = anteriorLocal;
  for (let i = 0; i < s.eventos.length; i++) {
    const e = s.eventos[i], r = s.registros[i];
    if (estabelecimentoOriginal === undefined) delete e.payload.estabelecimentoId;
    else e.payload.estabelecimentoId = estabelecimentoOriginal;
    e.payload.localPreviousHash = e.local_previous_hash = anteriorLocal;
    e.payload.localHash = e.local_hash = await calcularHashLocal(e.payload, sha256);
    anteriorLocal = e.local_hash;
    r.fiscal_previous_hash = anteriorFiscal;
    r.fiscal_hash = await calcularHashFiscal(registroFiscalDoBanco(r, e), sha256);
    anteriorFiscal = r.fiscal_hash;
  }
  s.dispositivos[0].ultimo_hash_local = anteriorLocal;
  s.contador.ultimo_hash_fiscal = anteriorFiscal;
  return s;
}

describe("auditoria de eventos com vínculo atribuído pelo servidor", () => {
  it.each([undefined, null, "", " "])("preserva hash original com estabelecimento opcional %s", async valor => {
    const s = await legado(valor), antes = JSON.stringify(s);
    const audit = await auditarSnapshot(s);
    expect(audit.integridadeValida).toBe(true);
    expect(audit.pendencias.some(p => p.codigo === "HASH_LOCAL_DIVERGENTE")).toBe(false);
    // Integridade não inventa a evidência de captura que falta no histórico.
    expect(audit.pendencias.some(p => p.codigo === "MODO_CAPTURA_NAO_REGISTRADO")).toBe(true);
    expect(audit.aptoParaGeracao.afd).toBe(false);
    expect(JSON.stringify(s)).toBe(antes);
  });

  it("continua detectando alteração de campo material no banco", async () => {
    const s = await legado();
    s.eventos[0].employee_id = "outro-funcionario-sintetico";
    const audit = await auditarSnapshot(s);
    expect(audit.integridadeValida).toBe(false);
    expect(audit.pendencias.some(p => p.codigo === "HASH_LOCAL_DIVERGENTE")).toBe(true);
  });

  it("mantém a conferência do vínculo mesmo sem estabelecimento no payload antigo", async () => {
    const s = await legado();
    s.eventos[0].estabelecimento_id = "99999999-9999-4999-8999-999999999999";
    const audit = await auditarSnapshot(s);
    expect(audit.integridadeValida).toBe(false);
    expect(audit.pendencias.some(p => p.codigo === "ESCOPO_EVENTO_INVALIDO")).toBe(true);
  });

  it("não ignora divergência quando o estabelecimento pertence ao conteúdo original", async () => {
    const s = await snapshotFixture();
    s.eventos[0].estabelecimento_id = "99999999-9999-4999-8999-999999999999";
    const audit = await auditarSnapshot(s);
    expect(audit.integridadeValida).toBe(false);
    expect(audit.pendencias.some(p => p.codigo === "HASH_LOCAL_DIVERGENTE")).toBe(true);
  });
});
