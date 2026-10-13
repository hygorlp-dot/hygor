// @vitest-environment node
//
// Sessão do modo encarregado: o PIN digitado fica só em memória (closure) para
// o servidor conferir no cadastro facial (PONTO_EXIGIR_PIN_NO_SERVIDOR=1).
// Trava do PIN do encarregado: regra pura + persistência no banco local
// (reiniciar o app não zera o contador).
import { describe, expect, it } from "vitest";
import { abrirSessaoResponsavel, corpoCadastroBiometria, proximaEsperaPin } from "./pin.js";
import {
  CHAVE_TRAVA_PIN, ESQUECER_ERROS_MS, conferirTravaPin, criarTravaPin, normalizarTravaPin,
  registrarAcertoPin, registrarFalhaPin, textoEsperaPin,
} from "./trava-pin.js";
import { criarArmazemMemoria } from "./armazem-memoria.js";

const T0 = Date.parse("2026-10-12T08:00:00.000Z");
const errarVezes = (n, inicio = null, agora = T0) => {
  let trava = inicio, ultima = null;
  for (let i = 0; i < n; i++) { ultima = registrarFalhaPin(trava, agora); trava = ultima.trava; }
  return ultima;
};

describe("regra pura da trava do PIN", () => {
  it("espera crescente de sempre preservada: 4 erros livres, depois 30 s, 60 s, 120 s... até 15 min", () => {
    expect(errarVezes(4).esperaMs).toBe(0);
    expect(errarVezes(5).esperaMs).toBe(30_000);
    expect(errarVezes(6).esperaMs).toBe(60_000);
    expect(errarVezes(7).esperaMs).toBe(120_000);
    expect(errarVezes(20).esperaMs).toBe(15 * 60_000);
    for (const n of [1, 5, 6, 9, 12]) expect(errarVezes(n).esperaMs).toBe(proximaEsperaPin(n));
  });

  it("bloqueado até o fim da espera; depois libera sem zerar o contador", () => {
    const { trava } = errarVezes(5);
    expect(conferirTravaPin(trava, T0 + 29_000)).toMatchObject({ bloqueado: true, esperaMs: 1_000 });
    const depois = conferirTravaPin(trava, T0 + 30_000);
    expect(depois).toMatchObject({ bloqueado: false, mudou: false });
    expect(registrarFalhaPin(depois.trava, T0 + 31_000).esperaMs).toBe(60_000);
  });

  it("acerto zera", () => {
    expect(conferirTravaPin(registrarAcertoPin(), T0)).toMatchObject({ bloqueado: false, trava: { erros: 0 } });
  });

  it("relógio do aparelho voltou: a espera recomeça de agora (nem some, nem fica eterna)", () => {
    const { trava } = errarVezes(6);
    const voltou = conferirTravaPin(trava, T0 - 365 * 24 * 60 * 60_000);
    expect(voltou).toMatchObject({ mudou: true, bloqueado: true, esperaMs: 60_000 });
    expect(conferirTravaPin(voltou.trava, T0 - 365 * 24 * 60 * 60_000 + 60_000).bloqueado).toBe(false);
  });

  it("24 h sem errar zeram o contador", () => {
    const { trava } = errarVezes(7);
    expect(conferirTravaPin(trava, T0 + ESQUECER_ERROS_MS - 1).mudou).toBe(false);
    expect(conferirTravaPin(trava, T0 + ESQUECER_ERROS_MS)).toMatchObject({ mudou: true, trava: { erros: 0 } });
    expect(registrarFalhaPin(trava, T0 + ESQUECER_ERROS_MS).trava.erros).toBe(1);
  });

  it("estado gravado inválido ou adulterado não quebra nem cria espera maior que a máxima", () => {
    for (const lixo of [null, undefined, "x", 3, [], { erros: "abc" }]) expect(normalizarTravaPin(lixo)).toEqual({ erros: 0, bloqueadoAte: 0, ultimaFalhaEm: 0 });
    const adulterado = normalizarTravaPin({ erros: 9, ultimaFalhaEm: T0, bloqueadoAte: T0 + 10 * 365 * 24 * 60 * 60_000 });
    expect(conferirTravaPin(adulterado, T0).esperaMs).toBe(15 * 60_000);
  });

  it("texto da espera", () => {
    expect(textoEsperaPin(30_000)).toBe("30 s");
    expect(textoEsperaPin(119_000)).toBe("119 s");
    expect(textoEsperaPin(15 * 60_000)).toBe("15 min");
  });
});

describe("trava persistida no banco local", () => {
  it("reiniciar o app (nova trava sobre o mesmo banco) não zera o contador nem a espera", async () => {
    const armazem = criarArmazemMemoria();
    let agora = T0;
    const primeira = criarTravaPin({ armazem, agora: () => agora });
    for (let i = 0; i < 4; i++) expect((await primeira.falhou()).esperaMs).toBe(0);
    expect((await primeira.falhou()).esperaMs).toBe(30_000);
    expect(await armazem.lerEstado(CHAVE_TRAVA_PIN)).toMatchObject({ erros: 5, bloqueadoAte: T0 + 30_000 });

    // "Reinício": a tela nova lê do banco.
    agora = T0 + 10_000;
    const depoisDeReiniciar = criarTravaPin({ armazem, agora: () => agora });
    expect(await depoisDeReiniciar.situacao()).toEqual({ bloqueado: true, esperaMs: 20_000 });
    agora = T0 + 30_000;
    expect((await depoisDeReiniciar.situacao()).bloqueado).toBe(false);
    expect((await depoisDeReiniciar.falhou()).esperaMs).toBe(60_000);

    // Acerto zera também no banco.
    agora = T0 + 30_000 + 60_000;
    await criarTravaPin({ armazem, agora: () => agora }).acertou();
    expect(await armazem.lerEstado(CHAVE_TRAVA_PIN)).toMatchObject({ erros: 0 });
    expect((await criarTravaPin({ armazem, agora: () => agora }).falhou()).esperaMs).toBe(0);
  });

  it("banco local com erro: a trava continua valendo na memória da sessão", async () => {
    const armazem = { lerEstado: async () => { throw new Error("db"); }, gravarEstado: async () => { throw new Error("db"); } };
    const trava = criarTravaPin({ armazem, agora: () => T0 });
    for (let i = 0; i < 4; i++) await trava.falhou();
    expect((await trava.falhou()).esperaMs).toBe(30_000);
    expect((await trava.situacao()).bloqueado).toBe(true);
  });
});

const PIN = "90817263";   // sintético
const RESP = { userId: "u-enc", nome: "Encarregado" };

describe("sessão do responsável com o PIN em memória", () => {
  it("o PIN não é propriedade do objeto: não aparece em JSON, spread, chaves nem String()", () => {
    const sessao = abrirSessaoResponsavel(RESP, PIN);
    expect(sessao.userId).toBe("u-enc");
    expect(sessao.nome).toBe("Encarregado");
    expect(JSON.stringify(sessao)).not.toContain(PIN);
    expect(JSON.stringify({ ...sessao })).not.toContain(PIN);
    expect(Object.values(sessao).filter(v => typeof v !== "function")).toEqual(["u-enc", "Encarregado"]);
    expect(String(sessao)).not.toContain(PIN);
    expect(Object.isFrozen(sessao)).toBe(true);
    expect(sessao.pinParaServidor()).toBe(PIN);
  });

  it("o corpo do cadastro facial leva responsavelId e pinResponsavel, sem mexer nos outros campos", () => {
    const sessao = abrirSessaoResponsavel(RESP, PIN);
    const campos = { employeeId: "e1", vetor: [1, 2], consentimento: { termoVersao: "2026-10" } };
    expect(corpoCadastroBiometria(sessao, campos)).toEqual({ ...campos, responsavelId: "u-enc", pinResponsavel: PIN });
    expect(campos).not.toHaveProperty("pinResponsavel");
  });

  it("descartar() apaga o PIN: o corpo sai sem pinResponsavel (servidor com o flag recusa)", () => {
    const sessao = abrirSessaoResponsavel(RESP, PIN);
    sessao.descartar();
    expect(sessao.pinParaServidor()).toBeNull();
    expect(corpoCadastroBiometria(sessao, { employeeId: "e1" })).toEqual({ employeeId: "e1", responsavelId: "u-enc" });
    sessao.descartar();   // idempotente
    expect(sessao.pinParaServidor()).toBeNull();
  });

  it("guarda só os dígitos, como a conferência offline", () => {
    expect(abrirSessaoResponsavel(RESP, " 90-81 7263 ").pinParaServidor()).toBe(PIN);
    expect(abrirSessaoResponsavel(RESP, undefined).pinParaServidor()).toBeNull();
  });
});
