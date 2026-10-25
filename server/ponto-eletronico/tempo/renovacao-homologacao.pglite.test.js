// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { novoPglite } from "../banco-pglite.test-helper.js";
import { criarRenovacaoHoraHomologacao } from "./renovacao-homologacao.js";

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const DESTINO = { ambiente: "homologacao", modo: "oportunista", supabaseUrl: "https://ukkzpttnbyylkyujzwnv.supabase.co" };
const medicao = () => ({ ok: true, servidor: "c.st1.ntp.br", verificadoEm: new Date().toISOString(), offsetMs: 9, atrasoMs: 40, incertezaMs: 21, estrato: 1, erro: null });

describe("ativação da renovação de hora", () => {
  it.each([
    { ambiente: "producao" }, { ambiente: undefined }, { modo: undefined }, { modo: "desligada" },
    { supabaseUrl: "https://outro-projeto.supabase.co" },
  ])("não configura callback fora da homologação explícita: %o", patch => {
    const transacao = vi.fn(), verificarHoraNtp = vi.fn();
    expect(criarRenovacaoHoraHomologacao({ ...DESTINO, transacao, verificarHoraNtp, ...patch })).toBeUndefined();
    expect(transacao).not.toHaveBeenCalled();
    expect(verificarHoraNtp).not.toHaveBeenCalled();
  });
});

describe("tentativas NTP na tabela existente", () => {
  let pg, medir, executar, consultas;
  beforeEach(async () => {
    pg = await novoPglite();
    await pg.exec("create table public.arcd_ambiente (id boolean primary key, ambiente text not null); insert into public.arcd_ambiente values (true, 'homologacao')");
    consultas = [];
    medir = vi.fn(async () => medicao());
    executar = fn => pg.transaction(tx => fn(async (sql, params = []) => {
      consultas.push(sql);
      return (await tx.query(sql, params)).rows;
    }));
  });
  afterEach(async () => { await pg?.close(); });
  const nova = options => criarRenovacaoHoraHomologacao({ ...DESTINO, transacao: executar, verificarHoraNtp: medir, ...options });
  const registrar = (idade, ok = true) => pg.query(`insert into public.ponto_tempo_verificacoes
    (fonte, servidor, verificado_em, offset_ms, incerteza_ms, ok, criado_em)
    values ('ntp', 'b.st1.ntp.br', now()-$1::interval, 10, 20, $2, now()-$1::interval)`, [idade, ok]);

  it("mede e confirma uma tentativa real sob lock, sem alterar a tabela", async () => {
    expect(await nova()()).toEqual({ status: "renovada" });
    expect(medir).toHaveBeenCalledTimes(1);
    const { rows } = await pg.query("select fonte, servidor, ok, offset_ms, criado_em from public.ponto_tempo_verificacoes");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fonte: "ntp", servidor: "c.st1.ntp.br", ok: true });
    expect(Number(rows[0].offset_ms)).toBe(9);
    expect(consultas.findIndex(q => q.includes("pg_try_advisory_xact_lock"))).toBeLessThan(consultas.findIndex(q => q.includes("clock_timestamp")));
  });

  it("não mede novamente uma fonte boa com menos de 18 horas", async () => {
    await registrar("17 hours");
    expect(await nova()()).toEqual({ status: "atual" });
    expect(medir).not.toHaveBeenCalled();
  });

  it("renova depois de 18 horas e reconsulta o limite dentro da transação seguinte", async () => {
    await registrar("19 hours");
    expect(await nova()()).toEqual({ status: "renovada" });
    expect(await nova()()).toEqual({ status: "atual" });
    expect(medir).toHaveBeenCalledTimes(1);
  });

  it("falha NTP fica confirmada e impede repetição por 15 minutos mesmo com verificado_em antigo", async () => {
    medir.mockResolvedValue({ ok: false, servidor: "ntp.br", verificadoEm: "2000-01-01T00:00:00Z", erro: "Rede indisponível." });
    expect(await nova()()).toEqual({ status: "falhou" });
    expect(await nova()()).toEqual({ status: "aguardando" });
    expect(medir).toHaveBeenCalledTimes(1);
    expect((await pg.query("select ok, erro from public.ponto_tempo_verificacoes")).rows).toEqual([{ ok: false, erro: "Rede indisponível." }]);
  });

  it("nova tentativa após 15 minutos; exceção de rede também grava ok=false", async () => {
    await registrar("16 minutes", false);
    medir.mockRejectedValue(new Error("Detalhe interno que não pode sair"));
    expect(await nova()()).toEqual({ status: "falhou" });
    const { rows } = await pg.query("select ok, erro from public.ponto_tempo_verificacoes order by criado_em desc");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ ok: false, erro: "Verificação NTP indisponível." });
  });

  it("resposta SNTP fora da tolerância não adia a nova tentativa por 18 horas", async () => {
    await pg.query(`insert into public.ponto_tempo_verificacoes
      (fonte, servidor, verificado_em, offset_ms, incerteza_ms, ok, criado_em)
      values ('ntp', 'b.st1.ntp.br', now()-interval '16 minutes', 90000, 20, true, now()-interval '16 minutes')`);
    expect(await nova()()).toEqual({ status: "renovada" });
    expect(medir).toHaveBeenCalledTimes(1);
  });

  it("recusa marcador incompatível antes do lock ou da medição", async () => {
    await pg.exec("update public.arcd_ambiente set ambiente='producao'");
    expect(await nova()()).toEqual({ status: "ambiente_nao_confirmado" });
    expect(medir).not.toHaveBeenCalled();
    expect(consultas).toHaveLength(1);
  });

  it("perdedor do lock não consulta nem grava uma tentativa", async () => {
    const transacao = fn => executar(query => fn(async (sql, params) => sql.includes("pg_try_advisory_xact_lock") ? [{ adquirida: false }] : query(sql, params)));
    expect(await nova({ transacao })()).toEqual({ status: "em_curso" });
    expect(medir).not.toHaveBeenCalled();
    expect((await pg.query("select count(*)::int as total from public.ponto_tempo_verificacoes")).rows[0].total).toBe(0);
  });

  it("compartilha a tentativa em curso no mesmo processo", async () => {
    let liberar;
    medir.mockImplementation(() => new Promise(resolve => { liberar = () => resolve(medicao()); }));
    const renovar = nova(), primeira = renovar(), segunda = renovar();
    expect(segunda).toBe(primeira);
    await vi.waitFor(() => expect(liberar).toBeTypeOf("function"));
    liberar();
    expect(await primeira).toEqual({ status: "renovada" });
    expect(medir).toHaveBeenCalledTimes(1);
  });
});
