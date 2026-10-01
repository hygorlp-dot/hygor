import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HASH_INICIAL, calcularHashMarcacao, canonicalizarMarcacao, validarMarcacao, verificarCadeia } from "./marcacao.js";
import { DIVERGENCIA_TOLERADA_MS, horaDaMarcacao, novaReferencia } from "./relogio.js";
import { funcionariosDaObra, terceirizadosDaObra } from "./funcionarios.js";

const sha256 = texto => createHash("sha256").update(texto, "utf8").digest("hex");
const DISPOSITIVO = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Monta uma cadeia válida como o aparelho faria.
async function cadeia(qtd, { inicioNsr = 1, hashAnterior = HASH_INICIAL } = {}) {
  const lista = [];
  let anterior = hashAnterior;
  for (let i = 0; i < qtd; i++) {
    const m = {
      id: uuid(inicioNsr + i), dispositivoId: DISPOSITIVO, nsr: inicioNsr + i, tipoRegistro: "ponto",
      employeeId: "emp-1", cpf: "123.456.789-09", marcadoEm: `2026-10-01T10:0${i}:00.000Z`,
      relogioAparelho: `2026-10-01T10:0${i}:05.000Z`, horaConfiavel: true, metodo: "facial", confianca: 0.93,
      gps: { lat: -8.2834, lng: -35.9761, precisao: 12 }, hashAnterior: anterior,
    };
    m.hash = await calcularHashMarcacao(m, sha256);
    anterior = m.hash;
    lista.push(m);
  }
  return lista;
}

describe("marcação encadeada (inalterabilidade)", () => {
  it("aceita uma cadeia válida desde o primeiro registro do aparelho", async () => {
    const lista = await cadeia(3);
    const r = await verificarCadeia(lista, null, sha256);
    expect(r.erro).toBeNull();
    expect(r.aceitas.map(m => m.nsr)).toEqual([1, 2, 3]);
  });

  it("continua de onde o servidor parou e ignora reenvio do que já foi aceito", async () => {
    const lista = await cadeia(4);
    const r = await verificarCadeia(lista, { nsr: 2, hash: lista[1].hash }, sha256);
    expect(r.erro).toBeNull();
    expect(r.aceitas.map(m => m.nsr)).toEqual([3, 4]);
  });

  it("recusa marcação alterada depois de registrada (mudar o horário quebra o hash)", async () => {
    const lista = await cadeia(3);
    lista[1] = { ...lista[1], marcadoEm: "2026-10-01T07:00:00.000Z" };
    const r = await verificarCadeia(lista, null, sha256);
    expect(r.aceitas.map(m => m.nsr)).toEqual([1]);
    expect(r.erro).toMatch(/alterada/);
    expect(r.nsrComErro).toBe(2);
  });

  it("recusa marcação apagada do meio (lacuna no NSR)", async () => {
    const lista = await cadeia(3);
    const r = await verificarCadeia([lista[0], lista[2]], null, sha256);
    expect(r.aceitas.map(m => m.nsr)).toEqual([1]);
    expect(r.erro).toMatch(/lacuna/);
  });

  it("recusa marcação que não aponta para a anterior (cadeia substituída)", async () => {
    const original = await cadeia(2);
    const falsa = await cadeia(1, { inicioNsr: 2, hashAnterior: "f".repeat(64) });
    const r = await verificarCadeia([original[0], falsa[0]], null, sha256);
    expect(r.erro).toMatch(/cadeia quebrada/);
  });

  it("o hash cobre os campos que a fiscalização olha", () => {
    const base = { id: uuid(1), dispositivoId: DISPOSITIVO, nsr: 1, employeeId: "e", marcadoEm: "2026-10-01T10:00:00.000Z", metodo: "facial", hashAnterior: HASH_INICIAL };
    const c = canonicalizarMarcacao(base);
    for (const [campo, valor] of [["nsr", 2], ["employeeId", "outro"], ["marcadoEm", "2026-10-01T11:00:00.000Z"], ["metodo", "encarregado"], ["cpf", "11122233344"]]) {
      expect(canonicalizarMarcacao({ ...base, [campo]: valor }), campo).not.toBe(c);
    }
  });
});

describe("validarMarcacao", () => {
  it("aceita a marcação montada pelo aparelho", async () => {
    const [m] = await cadeia(1);
    expect(validarMarcacao(m)).toEqual({ ok: true, erros: [] });
  });
  it("aponta os problemas de forma clara", () => {
    const r = validarMarcacao({ id: "x", nsr: 0, metodo: "senha", marcadoEm: "01/10/2026 10:00", gps: { lat: 200, lng: 0 } });
    expect(r.ok).toBe(false);
    expect(r.erros.join(" · ")).toMatch(/UUID/);
    expect(r.erros.join(" · ")).toMatch(/nsr/);
    expect(r.erros.join(" · ")).toMatch(/metodo/);
    expect(r.erros.join(" · ")).toMatch(/UTC/);
    expect(r.erros.join(" · ")).toMatch(/gps/);
  });
  it("identificação pelo encarregado exige o encarregado; acesso de terceiro exige o terceirizado", () => {
    expect(validarMarcacao({ metodo: "encarregado" }).erros).toContain("identificação por encarregado sem o encarregado");
    expect(validarMarcacao({ tipoRegistro: "acesso_terceiro" }).erros).toContain("acesso de terceiro sem terceirizado");
  });
});

describe("hora confiável", () => {
  const referencia = { servidorMs: Date.UTC(2026, 9, 1, 10, 0, 0), monotonicoMs: 1_000_000, bootId: "boot-1" };

  it("usa hora do servidor + relógio monotônico, mesmo que o celular tenha a hora mudada", () => {
    const r = horaDaMarcacao({ referencia, bootId: "boot-1", monotonicoMs: 1_000_000 + 3_600_000, relogioParedeMs: Date.UTC(2026, 9, 1, 8, 0, 0) });
    expect(new Date(r.marcadoEmMs).toISOString()).toBe("2026-10-01T11:00:00.000Z");
    expect(r.horaConfiavel).toBe(true);
    expect(r.relogioAlterado).toBe(true);
  });

  it("depois de reiniciar o aparelho sem sincronizar, marca com o relógio do celular e sinaliza", () => {
    const r = horaDaMarcacao({ referencia, bootId: "boot-2", monotonicoMs: 5_000, relogioParedeMs: Date.UTC(2026, 9, 1, 12, 0, 0) });
    expect(r.horaConfiavel).toBe(false);
    expect(r.motivo).toMatch(/reiniciou/);
    expect(new Date(r.marcadoEmMs).toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("pequena diferença do relógio do celular não é tratada como adulteração", () => {
    const r = horaDaMarcacao({ referencia, bootId: "boot-1", monotonicoMs: 1_060_000, relogioParedeMs: referencia.servidorMs + 60_000 + DIVERGENCIA_TOLERADA_MS - 1000 });
    expect(r.relogioAlterado).toBe(false);
  });

  it("nova referência desconta metade da latência", () => {
    const r = novaReferencia({ servidorMs: 1_000_000, monotonicoEnvioMs: 100, monotonicoRespostaMs: 500, bootId: "b" });
    expect(r).toEqual({ servidorMs: 1_000_200, monotonicoMs: 500, bootId: "b", latenciaMs: 400 });
  });
});

describe("base única de funcionários", () => {
  const employees = [
    { id: "e1", name: "Zé da Obra", role: "Pedreiro", cpf: "123.456.789-09", phone: "(81) 99999-0000", obra: "obra-a", active: true, workStart: "07:00", workdayHours: "8" },
    { id: "e2", name: "Ana Servente", obra: "obra-a", active: false },
    { id: "e3", name: "Bruno", obra: "obra-b", active: true },
    { id: "e4", name: "Carlos Desligado", obra: "obra-a", active: true, endDate: "2026-09-01" },
  ];
  it("o app recebe só ativos da obra do aparelho, com CPF mascarado para exibição", () => {
    expect(funcionariosDaObra(employees, "obra-a")).toEqual([{
      id: "e1", nome: "Zé da Obra", funcao: "Pedreiro", cpf: "12345678909", cpfMascarado: "***.***.789-09",
      telefone: "81999990000", inicioJornada: "07:00", horasJornada: 8,
    }]);
  });
  it("terceirizados da obra para controle de acesso", () => {
    expect(terceirizadosDaObra([{ id: "t1", name: "Elétrica X", specialty: "eletricista", obraId: "obra-a" }, { id: "t2", name: "Y", obraId: "obra-b" }], "obra-a"))
      .toEqual([{ id: "t1", nome: "Elétrica X", especialidade: "eletricista" }]);
  });
});
