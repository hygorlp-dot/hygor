// @vitest-environment node
//
// O MESMO SQL do armazém do aparelho (armazem-sqlite-nucleo.js) contra um
// SQLite real (node:sqlite) num arquivo: batida sobrevive a fechar e abrir o
// app, banco de versão antiga migra sem perder nada, realinhamento e estados
// da foto funcionam no SQL de verdade. (SQLCipher em si é do expo-sqlite e é
// conferido no prebuild da CI: expo.sqlite.useSQLCipher=true.)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarArmazemSobreBanco, prepararBanco, serializarBanco } from "./armazem-sqlite-nucleo.js";
import { registrarBatida } from "../logica/terminal.js";
import { alinharCadeia } from "../logica/sincronizacao.js";
import { horaDaMarcacao } from "../../../../src/domains/ponto-eletronico/relogio.js";
import { sha256 } from "../logica/cenario.test-helper.js";

// Conexão "crua" com a API assíncrona do expo-sqlite sobre o node:sqlite -
// SEM withExclusiveTransactionAsync: a transação vem de serializarBanco,
// exatamente como no aparelho (onde a do expo-sqlite abriria conexão sem a
// chave do SQLCipher).
function abrirNode(arquivo) {
  const banco = new DatabaseSync(arquivo);
  return serializarBanco({
    async execAsync(sql) { banco.exec(sql); },
    async getFirstAsync(sql, ...p) { return banco.prepare(sql).get(...p) ?? null; },
    async getAllAsync(sql, ...p) { return banco.prepare(sql).all(...p); },
    async runAsync(sql, ...p) { const r = banco.prepare(sql).run(...p); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; },
    async closeAsync() { banco.close(); },
  });
}

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
  it("batida sobrevive a fechar e abrir o app, com foto ligada na mesma transação", async () => {
    let { db, armazem } = await abrir();
    const b = await bater(armazem, { fotoSha256: "c".repeat(64), caminhoFoto: "file:///docs/batida.jpg" });
    await db.closeAsync();
    ({ db, armazem } = await abrir());
    const [guardada] = await armazem.marcacoesPendentes(10);
    expect(guardada).toMatchObject({ id: b.id, nsr: 1, hash: b.hash, marcadoEm: b.marcadoEm, fotoSha256: "c".repeat(64) });
    expect(await armazem.contagem()).toEqual({ pendentes: 1, fotos: 1, fotosComProblema: 0 });
    expect(await armazem.dispositivoDoBanco()).toBe(DISP);
    await armazem.confirmarEnviadasAte(1);
    expect(await armazem.fotosPendentes(5)).toEqual([{ id: b.id, caminhoFoto: "file:///docs/batida.jpg" }]);
    await db.closeAsync();
  });

  it("sequência continua depois de reabrir e batidas simultâneas não repetem NSR", async () => {
    let { db, armazem } = await abrir();
    await bater(armazem); await bater(armazem);
    await db.closeAsync();
    ({ db, armazem } = await abrir());
    const feitas = await Promise.all([bater(armazem), bater(armazem), bater(armazem)]);
    expect(feitas.map(f => f.nsr).sort()).toEqual([3, 4, 5]);
    expect(await armazem.hashDoNsr(5)).toBe(feitas.find(f => f.nsr === 5).hash);
    await db.closeAsync();
  });

  it("banco da versão anterior (sem motivo_foto) migra sem perder batidas", async () => {
    const velho = new DatabaseSync(arquivo);
    velho.exec(`CREATE TABLE marcacoes (nsr INTEGER PRIMARY KEY NOT NULL, id TEXT NOT NULL UNIQUE, hash TEXT NOT NULL, hash_anterior TEXT NOT NULL,
      dados TEXT NOT NULL, enviada INTEGER NOT NULL DEFAULT 0, foto_enviada INTEGER NOT NULL DEFAULT 1, caminho_foto TEXT);
      CREATE TABLE estado (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
      INSERT INTO marcacoes VALUES (1, 'x', '${"a".repeat(64)}', '${"0".repeat(64)}', '{"id":"x","employeeId":"e1"}', 0, 0, 'file:///f.jpg');`);
    velho.close();
    const { db, armazem } = await abrir();
    expect((await armazem.marcacoesPendentes(5)).map(m => m.id)).toEqual(["x"]);
    await armazem.confirmarEnviadasAte(1);
    await armazem.fotoRecusada("x", "teste");
    expect(await armazem.contagem()).toEqual({ pendentes: 0, fotos: 0, fotosComProblema: 1 });
    await db.closeAsync();
  });

  it("realinhamento no SQL: renumera só as pendentes, guarda a base e mantém a foto", async () => {
    const { db, armazem } = await abrir();
    await bater(armazem); await armazem.confirmarEnviadasAte(1);
    const p = await bater(armazem, { fotoSha256: "d".repeat(64), caminhoFoto: "file:///p.jpg" });
    const { renumeradas } = await alinharCadeia({ armazem, servidor: { nsr: 7, hash: "e".repeat(64) }, sha256 });
    expect(renumeradas).toBe(1);
    const [n] = await armazem.marcacoesPendentes(5);
    expect(n).toMatchObject({ id: p.id, nsr: 8, hashAnterior: "e".repeat(64) });
    expect(await armazem.hashDoNsr(7)).toBe("e".repeat(64));
    expect((await bater(armazem)).nsr).toBe(9);
    await armazem.confirmarEnviadasAte(9);
    expect(await armazem.fotosPendentes(5)).toEqual([{ id: p.id, caminhoFoto: "file:///p.jpg" }]);
    await db.closeAsync();
  });

  it("transação que falha não deixa batida pela metade", async () => {
    const { db, armazem } = await abrir();
    await expect(armazem.transacao(async tx => { await tx.inserirMarcacao({ nsr: 5, id: "z", hash: "a", hashAnterior: "b" }); })).rejects.toThrow(/fora de sequência/);
    expect(await armazem.contagem()).toMatchObject({ pendentes: 0 });
    await db.closeAsync();
  });

  it("leitura não enxerga batida de transação aberta (que pode ser desfeita)", async () => {
    const { db, armazem } = await abrir();
    let liberar;
    const pausa = new Promise(r => { liberar = r; });
    const falhando = armazem.transacao(async tx => {
      await tx.inserirMarcacao({ nsr: 1, id: "fantasma", hash: "a".repeat(64), hashAnterior: "0".repeat(64), dispositivoId: DISP });
      await pausa;
      throw new Error("falhou depois de inserir");
    });
    const leitura = armazem.marcacoesPendentes(10);   // pedida no meio da transação
    liberar();
    await expect(falhando).rejects.toThrow(/falhou/);
    expect(await leitura).toEqual([]);                 // nunca viu a batida desfeita
    await db.closeAsync();
  });

  it("gravação durável: synchronous=FULL e WAL", async () => {
    const { db } = await abrir();
    expect((await db.getFirstAsync("PRAGMA synchronous")).synchronous).toBe(2);
    expect((await db.getFirstAsync("PRAGMA journal_mode")).journal_mode).toBe("wal");
    await db.closeAsync();
  });
});
