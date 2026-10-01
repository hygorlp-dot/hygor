// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, normalizarEstabelecimento, pendenciasFiscais, validarEstabelecimento } from "./estabelecimento.js";
import { FORMATO_EVENTO, HASH_INICIAL, calcularHashLocal, canonicalizarEvento, validarEvento, verificarCadeiaLocal } from "./evento.js";
import { HASH_FISCAL_INICIAL, calcularHashFiscal, canonicalizarRegistroFiscal, verificarCadeiaFiscal } from "./registro-fiscal.js";
import { REP_P, situacaoRepP } from "./rep-p.js";

const sha256 = v => createHash("sha256").update(v).digest("hex");

describe("estabelecimento fiscal", () => {
  it("dígitos verificadores de CNPJ e CPF", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cpfValido("123.456.789-09")).toBe(true);
    expect(cpfValido("123.456.789-00")).toBe(false);
  });

  it("estabelecimento sem inscrição ainda é válido (nada é inventado), mas aparece como pendência", () => {
    const v = validarEstabelecimento({ nome: "Matriz", obras: ["obra-a", "obra-a", ""] });
    expect(v.ok).toBe(true);
    expect(v.estabelecimento).toMatchObject({ tipoInscricao: null, numeroInscricao: null, cno: null, timezone: "America/Recife", ativo: true, obras: ["obra-a"] });
    expect(pendenciasFiscais(v.estabelecimento)).toEqual(["inscrição (CNPJ/CPF) não cadastrada"]);
  });

  it("valida o que for informado: inscrição, CNO, CAEPF, CEI e fuso", () => {
    expect(validarEstabelecimento({ nome: "A", tipoInscricao: "cnpj", numeroInscricao: "11.222.333/0001-81", cno: "123456789012" }).ok).toBe(true);
    const ruim = validarEstabelecimento({ nome: "", tipoInscricao: "cnpj", numeroInscricao: "11.222.333/0001-80", cno: "12", caepf: "1", cei: "9", timezone: "Lua/Base" });
    expect(ruim.ok).toBe(false);
    expect(ruim.erros).toEqual([
      "informe o nome do estabelecimento", "CNPJ com dígito verificador inválido", "CNO deve ter 12 dígitos",
      "CAEPF deve ter 14 dígitos", "CEI deve ter 12 dígitos", "fuso horário inválido (use o nome IANA, ex.: America/Recife)",
    ]);
    expect(validarEstabelecimento({ nome: "A", tipoInscricao: "cpf" }).erros).toEqual(["informe o número da inscrição"]);
    expect(validarEstabelecimento({ nome: "A", numeroInscricao: "1" }).erros).toEqual(["tipo de inscrição deve ser CNPJ ou CPF"]);
  });

  it("normaliza dígitos e minúsculas", () => {
    expect(normalizarEstabelecimento({ nome: " Obra ", tipoInscricao: "CNPJ", numeroInscricao: "11.222.333/0001-81" })).toMatchObject({ nome: "Obra", tipoInscricao: "cnpj", numeroInscricao: "11222333000181" });
  });
});

const evento = (seq, anterior, extra = {}) => ({
  formatVersion: FORMATO_EVENTO, eventId: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`, deviceId: "6f1c9a52-0f0e-4f5e-9d7b-3a1d2c4b5e6f",
  estabelecimentoId: "", localSequence: seq, tipoRegistro: "ponto", employeeId: "e1", terceiroId: "", cpf: "12345678909",
  marcadoEm: `2026-10-01T10:00:0${seq}.000Z`, horaConfiavel: true, metodo: "facial", confianca: 0.9, localPreviousHash: anterior, ...extra,
});
async function cadeia(n) {
  const lista = []; let anterior = HASH_INICIAL;
  for (let i = 1; i <= n; i++) { const e = evento(i, anterior); e.localHash = await calcularHashLocal(e, sha256); lista.push(e); anterior = e.localHash; }
  return lista;
}

describe("evento local (formato 2)", () => {
  it("não tem NSR; validação recusa quem tentar mandar um", async () => {
    const [e] = await cadeia(1);
    expect(validarEvento(e)).toEqual({ ok: true, erros: [] });
    expect(validarEvento({ ...e, nsr: 7 }).erros).toContain("evento local não tem NSR (o NSR fiscal é atribuído pela ARP)");
    expect(validarEvento({ ...e, formatVersion: 1 }).ok).toBe(false);
  });

  it("o hash local cobre os campos materiais, a origem e a idade da referência de hora", async () => {
    const [e] = await cadeia(1);
    for (const mudanca of [{ marcadoEm: "2026-10-01T11:00:00.000Z" }, { employeeId: "e2" }, { fonteHora: "outra" }, { idadeReferenciaMs: 5 }, { divergenciaMs: 9 }, { localSequence: 2 }, { fotoSha256: "a".repeat(64) }]) {
      expect(canonicalizarEvento({ ...e, ...mudanca })).not.toBe(canonicalizarEvento(e));
    }
  });

  it("cadeia local: começa em 1, cresce, e qualquer alteração ou lacuna é apontada", async () => {
    const lista = await cadeia(3);
    expect((await verificarCadeiaLocal(lista, null, sha256)).aceitos.map(e => e.localSequence)).toEqual([1, 2, 3]);
    expect((await verificarCadeiaLocal([lista[0], lista[2]], null, sha256)).erro).toMatch(/chegou antes/);
    expect((await verificarCadeiaLocal([lista[0], { ...lista[1], employeeId: "x" }], null, sha256)).erro).toMatch(/alterado/);
    expect((await verificarCadeiaLocal(lista.slice(1), { localSequence: 1, localHash: lista[0].localHash }, sha256)).erro).toBeNull();
  });
});

describe("registro fiscal da ARP", () => {
  it("hash fiscal inclui o NSR e encadeia por estabelecimento; qualquer troca quebra a cadeia", async () => {
    const regs = [];
    let anterior = HASH_FISCAL_INICIAL;
    for (let nsr = 1; nsr <= 3; nsr++) {
      const r = { estabelecimentoId: "11111111-0000-4000-8000-000000000001", nsr, eventId: `00000000-0000-4000-8000-00000000000${nsr}`, cpf: "123", employeeId: "e1",
        marcadoEm: "2026-10-01T10:00:00.000Z", gravadoEm: "2026-10-01T10:00:01.000Z", deviceId: "d", localSequence: nsr, localHash: "a".repeat(64), fiscalPreviousHash: anterior };
      r.fiscalHash = await calcularHashFiscal(r, sha256);
      regs.push(r); anterior = r.fiscalHash;
    }
    expect(await verificarCadeiaFiscal(regs, sha256)).toEqual({ ok: true, erro: null });
    expect(canonicalizarRegistroFiscal({ ...regs[0], nsr: 2 })).not.toBe(canonicalizarRegistroFiscal(regs[0]));
    expect((await verificarCadeiaFiscal([regs[0], regs[2]], sha256)).erro).toMatch(/fora de ordem/);
    expect((await verificarCadeiaFiscal([regs[0], { ...regs[1], marcadoEm: "2026-10-01T09:00:00.000Z" }], sha256)).erro).toMatch(/alterado/);
  });
});

describe("identificação do REP-P", () => {
  it("INPI pendente: o sistema aceita a ausência e nunca se declara conforme nesta fase", () => {
    expect(REP_P.inpiRegistrationNumber).toBeNull();
    const s = situacaoRepP();
    expect(s.conforme).toBe(false);
    expect(s.pendencias).toContain("registro no INPI pendente (após congelar a versão final)");
    expect(situacaoRepP({ ...REP_P, nomeOficial: "X", desenvolvedor: "Y", inpiRegistrationNumber: "BR512026000000-0" }).conforme).toBe(false);
  });
});
