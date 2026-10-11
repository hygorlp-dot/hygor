// @vitest-environment node
//
// CONCORRÊNCIA REAL da migration 019 (PRELIMINAR): conexões separadas a um
// Postgres de verdade. Cada caso segura uma transação aberta numa conexão e
// tenta a operação concorrente em outra (com lock_timeout) - prova que as
// travas serializam, não só a lógica:
//   B. hora de gravação: o NSR seguinte nunca fica com hora menor;
//   C. inscrição do estabelecimento × emissão de NSR (FOR SHARE);
//   A. legado formato 1 × evento formato 2 no mesmo aparelho.
// Roda na CI (job rep-p-arp-postgres). Local: PONTO_PG_URL=postgres://...
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRACOES_PONTO, PAPEIS_SUPABASE, lerMigration } from "../banco-pglite.test-helper.js";
import { verificarCadeiaFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";

const URL_PG = process.env.PONTO_PG_URL;
const sha256 = v => createHash("sha256").update(v).digest("hex");
const ZERO = "0".repeat(64);
const hora = serverTime => ({ serverTime, source: "host", status: "nao_verificada" });
const espera = ms => new Promise(r => setTimeout(r, ms));
// Horários relativos ao relógio real: o banco é o árbitro da tolerância (30 s).
const agora = deslocMs => new Date(Date.now() + deslocMs).toISOString();

let sql;
describe.skipIf(!URL_PG)("migration 019 com conexões simultâneas (Postgres real)", () => {
  beforeAll(async () => {
    sql = postgres(URL_PG, { max: 20, onnotice: () => {} });
    await sql.unsafe(PAPEIS_SUPABASE);
    for (const [, arquivo] of MIGRACOES_PONTO) await sql.unsafe(lerMigration(arquivo));
  }, 60000);
  afterAll(async () => { await sql?.end({ timeout: 5 }); });

  async function empresa(aparelhos = 2, { inscricao = null } = {}) {
    const company = `teste019-${randomUUID()}`;
    const [{ id }] = inscricao
      ? await sql`insert into public.ponto_estabelecimentos(company_id, nome, tipo_inscricao, numero_inscricao, criado_por) values (${company}, 'E', 'cnpj', ${inscricao}, 'teste') returning id`
      : await sql`insert into public.ponto_estabelecimentos(company_id, nome, criado_por) values (${company}, 'E', 'teste') returning id`;
    const aps = [];
    for (let a = 0; a < aparelhos; a++) {
      const obra = `obra-${a}`, disp = randomUUID();
      await sql`insert into public.ponto_estabelecimento_obras(company_id, obra_id, estabelecimento_id, vinculado_por) values (${company}, ${obra}, ${id}, 'teste')`;
      await sql`insert into public.ponto_dispositivos(company_id, id, obra_id, nome, token_hash, criado_por) values (${company}, ${disp}, ${obra}, 'A', ${sha256(disp)}, 'teste')`;
      aps.push({ disp, ultimo: ZERO, seq: 0 });
    }
    return { company, estab: id, aps };
  }
  const proximo = ap => {
    ap.seq += 1;
    const localHash = sha256(`${ap.disp}-${ap.seq}`);
    const e = { formatVersion: 2, eventId: randomUUID(), deviceId: ap.disp, localSequence: ap.seq, localPreviousHash: ap.ultimo, localHash,
      tipoRegistro: "ponto", employeeId: "emp", cpf: "12345678909", marcadoEm: "2026-10-01T10:00:00.000Z", horaConfiavel: true, metodo: "facial" };
    ap.ultimo = localHash;
    return e;
  };
  const arp = (c, company, disp, eventos, h) => c`select * from public.ponto_arp_registrar(${company}, ${disp}::uuid, ${c.json(eventos)}, ${c.json(h)})`;
  const fiscais = (company, estab) => sql`select r.*, e.cpf, e.employee_id, e.marcado_em_texto, e.local_hash from public.ponto_arp_registros r
    join public.ponto_eventos e using (company_id, event_id) where r.company_id = ${company} and r.estabelecimento_id = ${estab} order by r.nsr`;
  const cadeiaOk = async (company, estab) => verificarCadeiaFiscal((await fiscais(company, estab)).map(r => ({
    estabelecimentoId: r.estabelecimento_id, nsr: Number(r.nsr), eventId: r.event_id, tipoRegistro: "ponto", cpf: r.cpf, employeeId: r.employee_id,
    marcadoEm: r.marcado_em_texto, gravadoEm: r.gravado_em_texto, deviceId: r.dispositivo_id, localSequence: Number(r.local_sequence),
    localHash: r.local_hash, fiscalPreviousHash: r.fiscal_previous_hash, fiscalHash: r.fiscal_hash,
  })), sha256);

  it("B: quem leu a hora DEPOIS mas pegou o contador ANTES não deixa o NSR seguinte com hora menor", async () => {
    const { company, estab, aps: [a, b] } = await empresa(2);
    const c1 = await sql.reserve();
    try {
      await c1`begin`;
      const adiantada = agora(5000), atrasada = agora(1000);
      await arp(c1, company, a.disp, [proximo(a)], hora(adiantada));   // NSR 1 segura o contador
      const segundo = arp(sql, company, b.disp, [proximo(b)], hora(atrasada));   // espera o contador
      await espera(300);
      await c1`commit`;
      const [r] = await segundo;
      expect(Number(r.nsr)).toBe(2);
      expect(r.gravado_em).toBe(adiantada);             // na 017 seria a atrasada (menor que o NSR 1)
      const [f2] = await sql`select evidencia_hora from public.ponto_arp_registros where company_id = ${company} and nsr = 2`;
      expect(f2.evidencia_hora.arp).toMatchObject({ ajuste: "monotonia", horaHost: atrasada, gravadoAnterior: adiantada });
    } finally { c1.release(); }
    expect(await cadeiaOk(company, estab)).toEqual({ ok: true, erro: null });
  }, 60000);

  it("B: 6 aparelhos em paralelo com relógios desencontrados: hora nunca decresce com o NSR e a cadeia fiscal confere", async () => {
    const { company, estab, aps } = await empresa(6);
    await Promise.all(aps.map(async (ap, i) => {
      for (let k = 0; k < 5; k++) await arp(sql, company, ap.disp, [proximo(ap)], hora(agora(((i * 7 + k * 3) % 11) * 1000 - 5000)));
    }));
    const regs = await fiscais(company, estab);
    expect(regs.map(r => Number(r.nsr))).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (let i = 1; i < regs.length; i++) expect(Date.parse(regs[i].gravado_em_texto)).toBeGreaterThanOrEqual(Date.parse(regs[i - 1].gravado_em_texto));
    expect(await cadeiaOk(company, estab)).toEqual({ ok: true, erro: null });
  }, 60000);

  it("C: ARP emitindo o primeiro NSR segura a troca de CNPJ; depois do commit a troca é recusada", async () => {
    const { company, estab, aps: [a] } = await empresa(1, { inscricao: "11222333000181" });
    const c1 = await sql.reserve(), c2 = await sql.reserve();
    try {
      await c1`begin`;
      await arp(c1, company, a.disp, [proximo(a)], hora(agora(0)));     // FOR SHARE no estabelecimento
      await c2`set lock_timeout = '500ms'`;
      await expect(c2`update public.ponto_estabelecimentos set numero_inscricao = '11444777000161', atualizado_por = 'f' where company_id = ${company} and id = ${estab}`)
        .rejects.toThrow(/lock timeout|canceling statement/i);
      await c1`commit`;
      await expect(c2`update public.ponto_estabelecimentos set numero_inscricao = '11444777000161', atualizado_por = 'f' where company_id = ${company} and id = ${estab}`)
        .rejects.toThrow(/não muda depois de emitido NSR/);
    } finally { await c2`reset lock_timeout`.catch(() => {}); c1.release(); c2.release(); }
  }, 60000);

  it("C: troca de CNPJ em andamento (antes de qualquer NSR) segura a ARP; o NSR sai depois, já sob a inscrição nova", async () => {
    const { company, estab, aps: [a] } = await empresa(1, { inscricao: "11222333000181" });
    const c1 = await sql.reserve(), c2 = await sql.reserve();
    try {
      await c1`begin`;
      await c1`update public.ponto_estabelecimentos set numero_inscricao = '11444777000161', atualizado_por = 'f' where company_id = ${company} and id = ${estab}`;
      await c2`set lock_timeout = '500ms'`;
      await expect(arp(c2, company, a.disp, [proximo(a)], hora(agora(0)))).rejects.toThrow(/lock timeout|canceling statement/i);
      a.seq -= 1; a.ultimo = ZERO;                                                          // o evento não entrou
      await c1`commit`;
      const [r] = await arp(c2, company, a.disp, [proximo(a)], hora(agora(0)));
      expect(r).toMatchObject({ status: "registrado" });
      const [aud] = await sql`select acao, nsr_emitidos from public.ponto_estabelecimentos_auditoria where company_id = ${company} and acao = 'alterado'`;
      expect(Number(aud.nsr_emitidos)).toBe(0);                                             // a troca foi antes do NSR 1
    } finally { await c2`reset lock_timeout`.catch(() => {}); c1.release(); c2.release(); }
  }, 60000);

  it("A: evento formato 2 em andamento segura o legado do mesmo aparelho; depois do commit o legado novo é recusado", async () => {
    const { company, aps: [a] } = await empresa(1);
    const c1 = await sql.reserve(), c2 = await sql.reserve();
    try {
      await c1`begin`;
      await arp(c1, company, a.disp, [proximo(a)], hora(agora(0)));     // FOR UPDATE no aparelho
      const marc = [{ id: randomUUID(), nsr: 1, hashAnterior: ZERO, hash: sha256("l1"), employeeId: "emp", cpf: "12345678909", marcadoEm: "2026-10-01T09:00:00.000Z", metodo: "facial" }];
      await c2`set lock_timeout = '500ms'`;
      await expect(c2`select * from public.ponto_registrar_marcacoes(${company}, ${a.disp}::uuid, ${c2.json(marc)})`).rejects.toThrow(/lock timeout|canceling statement/i);
      await c1`commit`;
      const [r] = await c2`select * from public.ponto_registrar_marcacoes(${company}, ${a.disp}::uuid, ${c2.json(marc)})`;
      expect(r.aceitas).toBe(0);
      expect(r.erro).toMatch(/formato 2/);
      expect((await sql`select count(*)::int n from public.ponto_marcacoes where company_id = ${company}`)[0].n).toBe(0);
    } finally { await c2`reset lock_timeout`.catch(() => {}); c1.release(); c2.release(); }
  }, 60000);

  it("B: um host com hora no FUTURO (+1 dia) no meio de 4 aparelhos concorrentes não arrasta os NSR seguintes (sem catraca)", async () => {
    const { company, estab, aps } = await empresa(4);
    await Promise.all(aps.map(async (ap, i) => {
      for (let k = 0; k < 4; k++) await arp(sql, company, ap.disp, [proximo(ap)], hora(i === 0 && k === 1 ? agora(24 * 3_600_000) : agora(0)));
    }));
    const regs = await fiscais(company, estab);
    expect(regs).toHaveLength(16);
    for (const r of regs) expect(Date.parse(r.gravado_em_texto) - Date.now()).toBeLessThan(60_000);   // nenhum no futuro
    expect(regs.filter(r => r.evidencia_hora.arp.fonteGravacao === "banco:host_divergente")).toHaveLength(1);
    expect(await cadeiaOk(company, estab)).toEqual({ ok: true, erro: null });
  }, 60000);
});
