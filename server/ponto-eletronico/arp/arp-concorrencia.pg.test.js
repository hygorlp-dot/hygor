// @vitest-environment node
//
// CONCORRÊNCIA REAL da ARP: várias conexões simultâneas a um Postgres de
// verdade chamando ponto_arp_registrar ao mesmo tempo. Prova as travas
// (SELECT ... FOR UPDATE no aparelho e no contador do estabelecimento), não
// só a lógica - o PGlite dos outros testes tem uma conexão só.
//
// Roda na CI (job rep-p-arp-postgres, serviço postgres). Local: defina
// PONTO_PG_URL=postgres://usuario:senha@localhost:5432/banco_descartavel.
// As tabelas da ARP são imutáveis, então cada teste usa uma empresa
// (company_id) nova em vez de limpar dados.
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../banco-pglite.test-helper.js";
import { verificarCadeiaFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";

const URL_PG = process.env.PONTO_PG_URL;
const sha256 = v => createHash("sha256").update(v).digest("hex");
const HORA = { serverTime: "2026-10-01T12:00:00.000Z", source: "host", status: "nao_verificada" };

let sql;
describe.skipIf(!URL_PG)("ARP com conexões simultâneas (Postgres real)", () => {
  beforeAll(async () => {
    sql = postgres(URL_PG, { max: 20, onnotice: () => {} });
    await sql.unsafe(PAPEIS_SUPABASE);
    await sql.unsafe(lerMigration("016_create_ponto_eletronico.up.sql"));
    await sql.unsafe(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
  }, 60000);
  afterAll(async () => { await sql?.end({ timeout: 5 }); });

  async function empresa({ estabelecimentos = 1, aparelhosPorEstab = 2 } = {}) {
    const company = `teste-${randomUUID()}`;
    const estabs = [];
    for (let e = 0; e < estabelecimentos; e++) {
      const [{ id }] = await sql`insert into public.ponto_estabelecimentos(company_id, nome, criado_por) values (${company}, ${`E${e}`}, 'teste') returning id`;
      const aparelhos = [];
      for (let a = 0; a < aparelhosPorEstab; a++) {
        const obra = `obra-${e}-${a}`, disp = randomUUID();
        await sql`insert into public.ponto_estabelecimento_obras(company_id, obra_id, estabelecimento_id, vinculado_por) values (${company}, ${obra}, ${id}, 'teste')`;
        await sql`insert into public.ponto_dispositivos(company_id, id, obra_id, nome, token_hash, criado_por) values (${company}, ${disp}, ${obra}, 'A', ${sha256(disp)}, 'teste')`;
        aparelhos.push({ disp, ultimo: "0".repeat(64), seq: 0 });
      }
      estabs.push({ id, aparelhos });
    }
    return { company, estabs };
  }
  // Próximo evento da cadeia local de um aparelho (o SQL confere o encadeamento).
  const proximo = ap => {
    ap.seq += 1;
    const localHash = sha256(`${ap.disp}-${ap.seq}`);
    const e = { formatVersion: 2, eventId: randomUUID(), deviceId: ap.disp, localSequence: ap.seq, localPreviousHash: ap.ultimo, localHash,
      tipoRegistro: "ponto", employeeId: "emp", cpf: "12345678909", marcadoEm: "2026-10-01T10:00:00.000Z", horaConfiavel: true, metodo: "facial" };
    ap.ultimo = localHash;
    return e;
  };
  const registrar = (company, disp, eventos) =>
    sql`select * from public.ponto_arp_registrar(${company}, ${disp}::uuid, ${sql.json(eventos)}, ${sql.json(HORA)})`;
  const fiscais = (company, estab) => sql`select r.*, e.cpf, e.employee_id, e.marcado_em_texto, e.local_hash from public.ponto_arp_registros r
    join public.ponto_eventos e using (company_id, event_id) where r.company_id = ${company} and r.estabelecimento_id = ${estab} order by r.nsr`;

  it("5 aparelhos do mesmo estabelecimento, 10 eventos cada, em paralelo: NSR 1..50 sem colisão, sem lacuna, cadeia fiscal íntegra", async () => {
    const { company, estabs: [est] } = await empresa({ aparelhosPorEstab: 5 });
    await Promise.all(est.aparelhos.map(async ap => {
      for (let i = 0; i < 10; i++) {
        const [r] = await registrar(company, ap.disp, [proximo(ap)]);
        expect(r.status).toBe("registrado");
      }
    }));
    const regs = await fiscais(company, est.id);
    expect(regs.map(r => Number(r.nsr))).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(new Set(regs.map(r => r.event_id)).size).toBe(50);
    const comoJs = regs.map(r => ({ estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id, tipoRegistro: "ponto", cpf: r.cpf,
      employeeId: r.employee_id, marcadoEm: r.marcado_em_texto, gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id, localSequence: Number(r.local_sequence),
      localHash: r.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash }));
    expect(await verificarCadeiaFiscal(comoJs, sha256)).toEqual({ ok: true, erro: null });
  }, 60000);

  it("8 retries SIMULTÂNEOS do mesmo eventId: um só NSR, todos recebem o mesmo NSR e hash fiscal", async () => {
    const { company, estabs: [est] } = await empresa({ aparelhosPorEstab: 1 });
    const ap = est.aparelhos[0];
    const e = proximo(ap);
    const respostas = (await Promise.all(Array.from({ length: 8 }, () => registrar(company, ap.disp, [e])))).map(r => r[0]);
    expect(respostas.filter(r => r.status === "registrado")).toHaveLength(1);
    expect(respostas.filter(r => r.status === "ja_registrado")).toHaveLength(7);
    expect(new Set(respostas.map(r => `${r.nsr}|${r.fiscal_hash}`)).size).toBe(1);
    expect((await fiscais(company, est.id)).length).toBe(1);
  }, 60000);

  it("estabelecimentos distintos em paralelo: cada um com sua sequência 1..n", async () => {
    const { company, estabs } = await empresa({ estabelecimentos: 3, aparelhosPorEstab: 2 });
    await Promise.all(estabs.flatMap(est => est.aparelhos.map(async ap => {
      for (let i = 0; i < 5; i++) await registrar(company, ap.disp, [proximo(ap)]);
    })));
    for (const est of estabs) expect((await fiscais(company, est.id)).map(r => Number(r.nsr))).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  }, 60000);

  it("erro no meio de uma transação concorrente não queima NSR: o contador volta junto", async () => {
    const { company, estabs: [est] } = await empresa({ aparelhosPorEstab: 2 });
    const [a, b] = est.aparelhos;
    const loteRuim = [proximo(a), proximo(a)];
    loteRuim[1] = { ...loteRuim[1], metodo: "invalido" };     // viola check -> exceção -> rollback
    const resultados = await Promise.allSettled([
      registrar(company, a.disp, loteRuim),
      (async () => { for (let i = 0; i < 5; i++) await registrar(company, b.disp, [proximo(b)]); })(),
    ]);
    expect(resultados[0].status).toBe("rejected");
    const regs = await fiscais(company, est.id);
    expect(regs.map(r => Number(r.nsr))).toEqual([1, 2, 3, 4, 5]);
    expect(regs.every(r => r.dispositivo_id === b.disp)).toBe(true);
  }, 60000);

  it("resposta perdida depois do commit: o reenvio devolve o MESMO NSR e o próximo evento continua sem lacuna", async () => {
    const { company, estabs: [est] } = await empresa({ aparelhosPorEstab: 1 });
    const ap = est.aparelhos[0];
    const e = proximo(ap);
    await registrar(company, ap.disp, [e]);                  // "timeout": o cliente nunca leu
    const [retry] = await registrar(company, ap.disp, [e]);
    expect(retry).toMatchObject({ status: "ja_registrado" });
    expect(Number(retry.nsr)).toBe(1);
    const [seguinte] = await registrar(company, ap.disp, [proximo(ap)]);
    expect(Number(seguinte.nsr)).toBe(2);
  }, 60000);
});
