// @vitest-environment node
//
// Migration 017 executada num Postgres real (PGlite): estabelecimento, NSR
// por estabelecimento, idempotência por eventId, cadeia local, hash fiscal,
// imutabilidade e preservação dos dados da 016.
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, lerMigration, novoPglite } from "../banco-pglite.test-helper.js";
import { calcularHashFiscal, verificarCadeiaFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const sha256 = v => createHash("sha256").update(v).digest("hex");
const C = "arcd";
const uuid = (pref, n) => `${pref}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DISP_A = uuid("a", 1), DISP_B = uuid("b", 1), DISP_X = uuid("c", 1);
const HORA = { serverTime: "2026-10-01T12:00:00.000Z", source: "host", status: "nao_verificada" };

let db;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const registrar = async (disp, eventos, hora = HORA) => q(
  "select * from public.ponto_arp_registrar($1, $2, $3::jsonb, $4::jsonb)", [C, disp, JSON.stringify(eventos), JSON.stringify(hora)]);

// Cadeia local de mentira (o SQL só confere o encadeamento; o hash local é
// recalculado pela API antes - ver arp.js).
function cadeia(disp, n, { tipo = "ponto", inicio = 1, anterior = "0".repeat(64), extra = {} } = {}) {
  const lista = [];
  for (let i = 0; i < n; i++) {
    const seq = inicio + i;
    const localHash = sha256(`${disp}-${seq}-${extra.salt || ""}`);
    lista.push({ formatVersion: 2, eventId: uuid(disp[0] === "a" ? "d" : disp[0] === "b" ? "e" : "f", seq + (extra.desloc || 0)), deviceId: disp,
      localSequence: seq, localPreviousHash: anterior, localHash, tipoRegistro: tipo,
      employeeId: tipo === "ponto" ? "emp-1" : "", terceiroId: tipo === "ponto" ? "" : "terc-1", cpf: "123.456.789-09",
      marcadoEm: `2026-10-01T10:00:0${seq % 10}.000Z`, horaConfiavel: true, metodo: "facial", confianca: 0.9, ...extra.campos });
    anterior = localHash;
  }
  return lista;
}

async function estabelecimento(id, nome, obras) {
  await q("insert into public.ponto_estabelecimentos(company_id,id,nome,criado_por) values ($1,$2,$3,'admin')", [C, id, nome]);
  for (const o of obras) await q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,$2,$3,'admin')", [C, o, id]);
}
const EST_1 = uuid("1", 1), EST_2 = uuid("2", 1);

beforeEach(async () => {
  db = await novoPglite();
  for (const [id, obra, tok] of [[DISP_A, "obra-a", "a"], [DISP_B, "obra-b", "b"], [DISP_X, "obra-x", "c"]]) {
    await q("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,$3,'Aparelho',$4,'admin')", [C, id, obra, tok.repeat(64)]);
  }
  await estabelecimento(EST_1, "Matriz", ["obra-a", "obra-b"]);   // duas obras, um estabelecimento
  await estabelecimento(EST_2, "Outro", ["obra-x"]);
});
afterEach(async () => { await db?.close(); });

describe("migration 017 - NSR fiscal por estabelecimento", () => {
  it("NSR começa em 1 e cresce; a sequência local do aparelho fica separada", async () => {
    const r = await registrar(DISP_A, cadeia(DISP_A, 3));
    expect(r.map(x => [x.status, Number(x.nsr), Number(x.local_sequence)])).toEqual([["registrado", 1, 1], ["registrado", 2, 2], ["registrado", 3, 3]]);
    expect(r.every(x => x.estabelecimento_id === EST_1)).toBe(true);
    const [c] = await q("select ultimo_nsr from public.ponto_arp_contadores where estabelecimento_id = $1", [EST_1]);
    expect(Number(c.ultimo_nsr)).toBe(3);
  });

  it("dois aparelhos (obras diferentes) do MESMO estabelecimento dividem uma única sequência de NSR", async () => {
    await registrar(DISP_A, cadeia(DISP_A, 2));
    const b = await registrar(DISP_B, cadeia(DISP_B, 2));
    expect(b.map(x => Number(x.nsr))).toEqual([3, 4]);
    expect(b.map(x => Number(x.local_sequence))).toEqual([1, 2]);   // cada aparelho começa a sua do 1
  });

  it("estabelecimentos diferentes têm sequências independentes", async () => {
    await registrar(DISP_A, cadeia(DISP_A, 2));
    const x = await registrar(DISP_X, cadeia(DISP_X, 1));
    expect(Number(x[0].nsr)).toBe(1);
  });

  it("mesmo eventId reenviado devolve o MESMO NSR e o MESMO hash fiscal", async () => {
    const lote = cadeia(DISP_A, 2);
    const primeiro = await registrar(DISP_A, lote);
    const retry = await registrar(DISP_A, lote);
    expect(retry.map(x => x.status)).toEqual(["ja_registrado", "ja_registrado"]);
    expect(retry.map(x => [Number(x.nsr), x.fiscal_hash])).toEqual(primeiro.map(x => [Number(x.nsr), x.fiscal_hash]));
    expect((await q("select count(*)::int n from public.ponto_arp_registros"))[0].n).toBe(2);
  });

  it("mesmo eventId com outro conteúdo é conflito e não grava nada novo", async () => {
    const [e] = cadeia(DISP_A, 1);
    await registrar(DISP_A, [e]);
    const r = await registrar(DISP_A, [{ ...e, localHash: "f".repeat(64) }]);
    expect(r[0]).toMatchObject({ status: "conflito" });
    expect((await q("select count(*)::int n from public.ponto_eventos"))[0].n).toBe(1);
  });

  it("cadeia local: lacuna e hash anterior errado são recusados, e o resto do lote não é processado", async () => {
    const [e1, e2, e3] = cadeia(DISP_A, 3);
    let r = await registrar(DISP_A, [e1, e3]);
    expect(r.map(x => x.status)).toEqual(["registrado", "fora_de_sequencia"]);
    r = await registrar(DISP_A, [{ ...e2, localPreviousHash: "9".repeat(64) }, e3]);
    expect(r.map(x => x.status)).toEqual(["cadeia_quebrada", "nao_processado"]);
    expect((await q("select count(*)::int n from public.ponto_arp_registros"))[0].n).toBe(1);
  });

  it("obra sem estabelecimento: o evento espera (não ganha NSR) e entra quando a obra é vinculada", async () => {
    await q("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ($1,$2,'obra-nova','Aparelho',$3,'admin')", [C, uuid("9", 9), "9".repeat(64)]);
    const lote = cadeia(uuid("9", 9), 1);
    expect((await registrar(uuid("9", 9), lote))[0]).toMatchObject({ status: "aguardando_estabelecimento", nsr: null });
    await q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-nova',$2,'admin')", [C, EST_2]);
    expect((await registrar(uuid("9", 9), lote))[0]).toMatchObject({ status: "registrado", estabelecimento_id: EST_2 });
    const [d] = await q("select estabelecimento_id from public.ponto_dispositivos where id = $1", [uuid("9", 9)]);
    expect(d.estabelecimento_id).toBe(EST_2);
  });

  it("aparelho com histórico do formato 1: a cadeia formato 2 continua do topo legado (cadeia local única, nada renumerado)", async () => {
    const legado = { id: uuid("7", 1), nsr: 1, tipoRegistro: "ponto", employeeId: "emp-1", cpf: "1", marcadoEm: "2026-10-01T09:00:00.000Z", horaConfiavel: true, metodo: "facial", hashAnterior: "0".repeat(64), hash: "1".repeat(64) };
    const legado2 = { ...legado, id: uuid("7", 2), nsr: 2, hashAnterior: "1".repeat(64), hash: "2".repeat(64) };
    await q("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, DISP_A, JSON.stringify([legado, legado2])]);
    expect((await registrar(DISP_A, cadeia(DISP_A, 1)))[0]).toMatchObject({ status: "conflito" });   // sequência 1 já é do legado: não recomeça
    const [continua] = cadeia(DISP_A, 1, { inicio: 3, anterior: "2".repeat(64) });
    expect((await registrar(DISP_A, [continua]))[0]).toMatchObject({ status: "registrado", nsr: 1 });       // NSR fiscal começa em 1
    const [d] = await q("select ultima_sequencia_local, ultimo_nsr from public.ponto_dispositivos where id = $1", [DISP_A]);
    expect([Number(d.ultima_sequencia_local), Number(d.ultimo_nsr)]).toEqual([3, 2]);
  });

  it("acesso de terceirizado é guardado sem consumir NSR", async () => {
    const [p1] = cadeia(DISP_A, 1);
    const [t2] = cadeia(DISP_A, 1, { tipo: "acesso_terceiro", inicio: 2, anterior: p1.localHash });
    const r = await registrar(DISP_A, [p1, t2]);
    expect(r.map(x => [x.status, x.nsr === null ? null : Number(x.nsr)])).toEqual([["registrado", 1], ["acesso_registrado", null]]);
    const [p3] = cadeia(DISP_A, 1, { inicio: 3, anterior: t2.localHash });
    expect(Number((await registrar(DISP_A, [p3]))[0].nsr)).toBe(2);   // sem lacuna
  });

  it("erro no meio da transação desfaz tudo - nenhum NSR é queimado", async () => {
    const lote = cadeia(DISP_A, 3);
    lote[2].metodo = "invalido";                                  // viola o check da tabela
    await expect(registrar(DISP_A, lote)).rejects.toThrow();
    expect((await q("select count(*)::int n from public.ponto_eventos"))[0].n).toBe(0);
    expect((await q("select count(*)::int n from public.ponto_arp_contadores where ultimo_nsr > 0"))[0].n).toBe(0);
    const r = await registrar(DISP_A, cadeia(DISP_A, 3));
    expect(r.map(x => Number(x.nsr))).toEqual([1, 2, 3]);
  });

  it("aparelho revogado não grava", async () => {
    await q("update public.ponto_dispositivos set status='revogado' where id=$1", [DISP_A]);
    expect((await registrar(DISP_A, cadeia(DISP_A, 1)))[0]).toMatchObject({ status: "dispositivo_revogado" });
  });

  it("hash fiscal calculado no SQL é o MESMO do JavaScript e a cadeia fiscal confere", async () => {
    await registrar(DISP_A, cadeia(DISP_A, 2));
    await registrar(DISP_B, cadeia(DISP_B, 1));
    const regs = await q(`select r.*, e.cpf, e.employee_id, e.marcado_em_texto, e.local_hash from public.ponto_arp_registros r
      join public.ponto_eventos e using (company_id, event_id) where r.estabelecimento_id = $1 order by r.nsr`, [EST_1]);
    const comoJs = regs.map(r => ({ estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id, tipoRegistro: "ponto",
      cpf: r.cpf, employeeId: r.employee_id, marcadoEm: r.marcado_em_texto, gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id,
      localSequence: Number(r.local_sequence), localHash: r.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash }));
    for (const r of comoJs) expect(await calcularHashFiscal(r, sha256)).toBe(r.fiscalHash);
    expect(await verificarCadeiaFiscal(comoJs, sha256)).toEqual({ ok: true, erro: null });
  });
});

describe("migration 017 - imutabilidade e permissões", () => {
  beforeEach(async () => { await registrar(DISP_A, cadeia(DISP_A, 1)); });

  it("UPDATE, DELETE e TRUNCATE bloqueados em eventos e registros fiscais", async () => {
    for (const t of ["ponto_eventos", "ponto_arp_registros"]) {
      await expect(q(`update public.${t} set company_id = company_id`)).rejects.toThrow(/imutável/);
      await expect(q(`delete from public.${t}`)).rejects.toThrow(/imutável/);
      await expect(q(`truncate public.${t} cascade`)).rejects.toThrow(/imutável/);
    }
  });

  it("INSERT direto (fora da ARP) é recusado, mesmo para o dono do banco", async () => {
    await expect(q(`insert into public.ponto_arp_registros select * from public.ponto_arp_registros`)).rejects.toThrow(/só recebe registros pela ARP/);
  });

  it("contador de NSR não muda nem some fora da ARP", async () => {
    await expect(q("update public.ponto_arp_contadores set ultimo_nsr = 10")).rejects.toThrow(/só muda pela ARP/);
    await expect(q("delete from public.ponto_arp_contadores")).rejects.toThrow(/não pode ser apagado/);
  });

  it("cadeia local do aparelho não avança fora da ARP e o estabelecimento do aparelho não muda", async () => {
    await expect(q("update public.ponto_dispositivos set ultima_sequencia_local = 99 where id = $1", [DISP_A])).rejects.toThrow(/só avança pela ARP/);
    await expect(q("update public.ponto_dispositivos set estabelecimento_id = $2 where id = $1", [DISP_A, EST_2])).rejects.toThrow(/não muda/);
  });

  it("a API (service_role) só lê o fiscal e só grava pela função; navegador não vê nada", async () => {
    const { rows } = await db.query(`select
      has_table_privilege('service_role','public.ponto_arp_registros','select') as le,
      has_table_privilege('service_role','public.ponto_arp_registros','insert') as insere,
      has_table_privilege('service_role','public.ponto_eventos','update') as altera,
      has_function_privilege('service_role','public.ponto_arp_registrar(text,uuid,jsonb,jsonb)','execute') as executa,
      has_table_privilege('authenticated','public.ponto_eventos','select') as navegador,
      has_function_privilege('anon','public.ponto_arp_registrar(text,uuid,jsonb,jsonb)','execute') as anonimo`);
    expect(rows[0]).toEqual({ le: true, insere: false, altera: false, executa: true, navegador: false, anonimo: false });
  });

  it("estabelecimento: inscrição incompleta ou com tamanho errado é recusada pelo banco", async () => {
    await expect(q("insert into public.ponto_estabelecimentos(company_id,nome,tipo_inscricao,criado_por) values ($1,'X','cnpj','a')", [C])).rejects.toThrow();
    await expect(q("insert into public.ponto_estabelecimentos(company_id,nome,tipo_inscricao,numero_inscricao,criado_por) values ($1,'X','cpf','123','a')", [C])).rejects.toThrow();
    await expect(q("insert into public.ponto_estabelecimentos(company_id,nome,cno,criado_por) values ($1,'X','12','a')", [C])).rejects.toThrow();
    await expect(q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-a',$2,'a')", [C, EST_2])).rejects.toThrow();
  });
});

describe("migration 017 - aplicação sobre dados existentes", () => {
  it("preserva as marcações legadas da 016, marca o formato 1 e roda de novo sem efeito", async () => {
    const velho = new PGlite({ extensions: { pgcrypto } });
    await velho.exec(PAPEIS_SUPABASE);
    await velho.exec(lerMigration("016_create_ponto_eletronico.up.sql"));
    await velho.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ('arcd',$1,'obra-a','A',$2,'admin')", [DISP_A, "a".repeat(64)]);
    const m = { id: uuid("d", 1), nsr: 1, tipoRegistro: "ponto", employeeId: "emp-1", cpf: "1", marcadoEm: "2026-10-01T10:00:00.000Z", horaConfiavel: true, metodo: "facial", hashAnterior: "0".repeat(64), hash: "1".repeat(64) };
    await velho.query("select * from public.ponto_registrar_marcacoes('arcd', $1, $2::jsonb)", [DISP_A, JSON.stringify([m])]);
    await velho.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
    await velho.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));   // idempotente
    const { rows } = await velho.query("select id, nsr, record_format_version, hash from public.ponto_marcacoes");
    expect(rows).toEqual([{ id: m.id, nsr: 1, record_format_version: 1, hash: "1".repeat(64) }]);
    const [d] = (await velho.query("select ultimo_nsr, ultima_sequencia_local, estabelecimento_id from public.ponto_dispositivos")).rows;
    expect(d).toEqual({ ultimo_nsr: 1, ultima_sequencia_local: 0, estabelecimento_id: null });
    await velho.close();
  });

  it("reversão: recusa com registros, roda limpa com a ARP vazia", async () => {
    await registrar(DISP_A, cadeia(DISP_A, 1));
    await expect(db.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.down.sql"))).rejects.toThrow(/recusada/);
    const limpo = await novoPglite();
    // Reversão em ordem: 018 (apropriação) antes da 017 (ARP).
    await limpo.exec(lerMigration("018_ponto_apropriacoes.down.sql"));
    await limpo.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.down.sql"));
    expect((await limpo.query("select to_regclass('public.ponto_arp_registros') t")).rows[0].t).toBeNull();
    await limpo.close();
  });
});
