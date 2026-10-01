// @vitest-environment node
//
// O MESMO SQL do armazém do aparelho (armazem-sqlite-nucleo.js) contra um
// SQLite real (node:sqlite) num arquivo: evento sobrevive a fechar e abrir o
// app, banco de versão antiga (formato 1, "nsr" por aparelho) migra sem
// perder nem alterar nada, e a confirmação da ARP só acrescenta NSR e hash
// fiscal ao lado do evento. (SQLCipher em si é do expo-sqlite e é conferido
// no prebuild da CI: expo.sqlite.useSQLCipher=true.)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { abrirNode } from "./sqlite-node.test-helper.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarArmazemSobreBanco, prepararBanco } from "./armazem-sqlite-nucleo.js";
import { registrarBatida } from "../logica/terminal.js";
import { calcularHashLocal, verificarCadeiaLocal } from "../../../../src/domains/ponto-eletronico/evento.js";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { sha256 } from "../logica/cenario.test-helper.js";

let pasta, arquivo;
beforeEach(() => { pasta = mkdtempSync(path.join(tmpdir(), "ponto-obra-")); arquivo = path.join(pasta, "ponto-obra.db"); });
afterEach(() => { rmSync(pasta, { recursive: true, force: true }); });

const abrir = async () => { const db = abrirNode(arquivo); await prepararBanco(db); return { db, armazem: criarArmazemSobreBanco(db) }; };
const relogio = { agora: () => ({ ...horaDaMarcacao({ referencia: null, monotonicoMs: 1, bootId: "b", relogioParedeMs: Date.parse("2026-10-01T10:00:00Z") }), relogioParedeMs: Date.parse("2026-10-01T10:00:00Z") }) };
const DISP = "6f1c9a52-0f0e-4f5e-9d7b-3a1d2c4b5e6f";
const bater = (armazem, extra = {}) => registrarBatida({
  armazem, relogio, sha256, gerarId: randomUUID, dispositivoId: DISP,
  pessoa: { tipo: "funcionario", id: "e1", cpf: "12345678909" }, identificacao: { metodo: "encarregado", encarregadoId: "u" }, ...extra,
});

describe("armazém SQLite do aparelho (SQL real)", () => {
  it("evento sobrevive a fechar e abrir o app, com foto ligada na mesma transação e sem NSR", async () => {
    let { db, armazem } = await abrir();
    const b = await bater(armazem, { fotoSha256: "c".repeat(64), caminhoFoto: "file:///docs/batida.jpg" });
    await db.closeAsync();
    ({ db, armazem } = await abrir());
    const [guardado] = await armazem.eventosPendentes(10);
    expect(guardado).toMatchObject({ eventId: b.eventId, formatVersion: 2, localSequence: 1, localHash: b.localHash, marcadoEm: b.marcadoEm, fotoSha256: "c".repeat(64) });
    expect(guardado).not.toHaveProperty("nsr");
    expect(await calcularHashLocal(guardado, sha256)).toBe(b.localHash);       // conteúdo intacto
    expect(await armazem.contagem()).toEqual({ pendentes: 1, fotos: 1, fotosComProblema: 0 });
    expect(await armazem.dispositivoDoBanco()).toBe(DISP);
    await db.closeAsync();
  });

  it("confirmação da ARP só acrescenta NSR/hash fiscal: evento, sequência e hash local não mudam; sobrevive a reabrir", async () => {
    let { db, armazem } = await abrir();
    const b = await bater(armazem, { fotoSha256: "c".repeat(64), caminhoFoto: "file:///docs/b.jpg" });
    const antes = await db.getFirstAsync("SELECT sequencia_local, id, hash_local, hash_local_anterior, dados FROM marcacoes");
    await armazem.confirmarEvento(b.eventId, { nsr: 501, fiscalHash: "f".repeat(64), estabelecimentoId: "est-1", gravadoEm: "2026-10-01T10:00:01.000Z" });
    await db.closeAsync();
    ({ db, armazem } = await abrir());
    expect(await db.getFirstAsync("SELECT sequencia_local, id, hash_local, hash_local_anterior, dados FROM marcacoes")).toEqual(antes);
    expect(await armazem.registroFiscal(b.eventId)).toEqual({ nsr: 501, fiscalHash: "f".repeat(64), estabelecimentoId: "est-1", gravadoEm: "2026-10-01T10:00:01.000Z" });
    expect(await armazem.eventosPendentes(5)).toEqual([]);
    expect(await armazem.fotosPendentes(5)).toEqual([{ id: b.eventId, caminhoFoto: "file:///docs/b.jpg" }]);
    expect(await armazem.ultimoNsrRecebido()).toBe(501);
    await db.closeAsync();
  });

  it("sequência local continua depois de reabrir; batidas simultâneas não repetem; a cadeia local confere", async () => {
    let { db, armazem } = await abrir();
    await bater(armazem); await bater(armazem);
    await db.closeAsync();
    ({ db, armazem } = await abrir());
    const feitas = await Promise.all([bater(armazem), bater(armazem), bater(armazem)]);
    expect(feitas.map(f => f.localSequence).sort()).toEqual([3, 4, 5]);
    const todos = await armazem.eventosPendentes(10);
    expect(await verificarCadeiaLocal(todos, null, sha256)).toMatchObject({ erro: null, aceitos: expect.arrayContaining([]) });
    expect((await verificarCadeiaLocal(todos, null, sha256)).aceitos.length).toBe(5);
    await db.closeAsync();
  });

  it("banco da versão anterior (formato 1, 'nsr' por aparelho) migra sem reescrever nada e a sequência continua", async () => {
    const velho = new DatabaseSync(arquivo);
    velho.exec(`CREATE TABLE marcacoes (nsr INTEGER PRIMARY KEY NOT NULL, id TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, hash_anterior TEXT NOT NULL,
      dados TEXT NOT NULL, enviada INTEGER NOT NULL DEFAULT 0, foto_enviada INTEGER NOT NULL DEFAULT 1, caminho_foto TEXT);
      CREATE TABLE estado (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
      INSERT INTO marcacoes VALUES (1, 'x', '${"a".repeat(64)}', '${"0".repeat(64)}', '{"id":"x","dispositivoId":"${DISP}","employeeId":"e1"}', 0, 0, 'file:///f.jpg');`);
    velho.close();
    const { db, armazem } = await abrir();
    const [legado] = await armazem.eventosPendentes(5);
    expect(legado).toEqual({ id: "x", dispositivoId: DISP, employeeId: "e1", formatVersion: 1, nsr: 1, legacyDeviceSequence: 1, hash: "a".repeat(64), hashAnterior: "0".repeat(64) });
    expect(await armazem.dispositivoDoBanco()).toBe(DISP);
    // Novo evento continua a sequência local do aparelho, encadeado no antigo.
    const novo = await bater(armazem);
    expect(novo).toMatchObject({ localSequence: 2, localPreviousHash: "a".repeat(64), formatVersion: 2 });
    await armazem.confirmarLegadoAte(1);
    await armazem.fotoRecusada("x", "teste");
    expect(await armazem.contagem()).toEqual({ pendentes: 1, fotos: 0, fotosComProblema: 1 });
    expect((await armazem.eventosPendentes(5))[0]).toMatchObject({ eventId: novo.eventId, formatVersion: 2 });
    // Rodar a preparação de novo não muda nada.
    await prepararBanco(db);
    expect((await db.getAllAsync("SELECT formato FROM marcacoes ORDER BY sequencia_local")).map(l => l.formato)).toEqual([1, 2]);
    await db.closeAsync();
  });

  it("transação que falha não deixa evento pela metade", async () => {
    const { db, armazem } = await abrir();
    await expect(armazem.transacao(async tx => { await tx.inserirEvento({ localSequence: 5, eventId: "z", localHash: "a", localPreviousHash: "b" }); })).rejects.toThrow(/fora de ordem/);
    expect(await armazem.contagem()).toMatchObject({ pendentes: 0 });
    await db.closeAsync();
  });

  it("leitura não enxerga evento de transação aberta (que pode ser desfeita)", async () => {
    const { db, armazem } = await abrir();
    let liberar;
    const pausa = new Promise(r => { liberar = r; });
    const falhando = armazem.transacao(async tx => {
      await tx.inserirEvento({ localSequence: 1, eventId: "fantasma", localHash: "a".repeat(64), localPreviousHash: "0".repeat(64), deviceId: DISP });
      await pausa;
      throw new Error("falhou depois de inserir");
    });
    const leitura = armazem.eventosPendentes(10);   // pedida no meio da transação
    liberar();
    await expect(falhando).rejects.toThrow(/falhou/);
    expect(await leitura).toEqual([]);                // nunca viu o evento desfeito
    await db.closeAsync();
  });

  it("gravação durável: synchronous=FULL e WAL", async () => {
    const { db } = await abrir();
    expect((await db.getFirstAsync("PRAGMA synchronous")).synchronous).toBe(2);
    expect((await db.getFirstAsync("PRAGMA journal_mode")).journal_mode).toBe("wal");
    await db.closeAsync();
  });
});
