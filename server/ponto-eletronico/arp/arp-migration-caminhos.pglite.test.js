// @vitest-environment node
//
// Migration 017 nos dois caminhos reais:
//   A. banco novo - 016 e 017 desde o zero, schema final conferido;
//   B. produção simulada - só a 016 com dados de uso (aparelhos, marcações,
//      biometrias, responsáveis, pareamentos), depois a 017: nada perdido,
//      nada alterado, constraints novas valendo e ARP funcionando.
// Mais: a 016 nunca é editada e o deploy aplica 016 -> 017 nessa ordem.
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, lerMigration } from "../banco-pglite.test-helper.js";
import { calcularHashMarcacao, HASH_INICIAL } from "../../../src/domains/ponto-eletronico/marcacao.js";

vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });
const sha256 = v => createHash("sha256").update(v).digest("hex");
const C = "arcd";
const TABELAS_016 = ["ponto_dispositivos", "ponto_pareamentos", "ponto_marcacoes", "ponto_biometrias", "ponto_responsaveis"];

let db;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const novoBanco = async () => { const b = new PGlite({ extensions: { pgcrypto } }); await b.exec(PAPEIS_SUPABASE); return b; };
const foto = (tabela, ordem) => q(`select * from public.${tabela} order by ${ordem}`);
afterEach(async () => { await db?.close(); db = null; });

describe("migration 017 - caminho A: banco novo", () => {
  beforeEach(async () => {
    db = await novoBanco();
    await db.exec(lerMigration("016_create_ponto_eletronico.up.sql"));
    await db.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
  });

  it("schema final: tabelas, colunas, chaves, função e travas", async () => {
    const tabelas = (await q(`select tablename from pg_tables where schemaname = 'public' and tablename like 'ponto_%' order by 1`)).map(t => t.tablename);
    expect(tabelas).toEqual(["ponto_arp_contadores", "ponto_arp_registros", "ponto_biometrias", "ponto_dispositivos", "ponto_estabelecimento_obras",
      "ponto_estabelecimentos", "ponto_eventos", "ponto_marcacoes", "ponto_pareamentos", "ponto_responsaveis", "ponto_tempo_verificacoes"]);
    const restricoes = async t => (await q(`select pg_get_constraintdef(oid) d from pg_constraint where conrelid = $1::regclass and contype in ('p','u')`, [`public.${t}`])).map(c => c.d);
    expect(await restricoes("ponto_eventos")).toEqual(expect.arrayContaining(["PRIMARY KEY (company_id, event_id)", "UNIQUE (company_id, dispositivo_id, local_sequence)"]));
    expect(await restricoes("ponto_arp_registros")).toEqual(expect.arrayContaining(["PRIMARY KEY (company_id, event_id)", "UNIQUE (company_id, estabelecimento_id, nsr)"]));
    expect(await restricoes("ponto_estabelecimento_obras")).toEqual(["PRIMARY KEY (company_id, obra_id)"]);
    const colsDisp = (await q(`select column_name from information_schema.columns where table_name = 'ponto_dispositivos'`)).map(c => c.column_name);
    expect(colsDisp).toEqual(expect.arrayContaining(["estabelecimento_id", "ultima_sequencia_local", "ultimo_hash_local", "ultimo_nsr"]));
    const travas = (await q(`select tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'ponto_%' order by 1`)).map(t => t.tgname);
    expect(travas).toEqual(expect.arrayContaining(["ponto_eventos_no_update", "ponto_eventos_no_delete", "ponto_eventos_no_truncate", "ponto_eventos_so_arp",
      "ponto_arp_registros_no_update", "ponto_arp_registros_no_delete", "ponto_arp_registros_so_arp", "ponto_arp_contadores_protegido", "ponto_dispositivos_protegido",
      "ponto_marcacoes_no_update", "ponto_marcacoes_no_delete"]));
    expect((await q(`select count(*)::int n from pg_proc where proname in ('ponto_arp_registrar','ponto_registrar_marcacoes','ponto_arp_texto_fiscal')`))[0].n).toBe(3);
  });

  it("constraints de estabelecimento: tipo sem número e número sem tipo são recusados; DV do CNPJ é regra da aplicação", async () => {
    const ins = (cols, vals) => q(`insert into public.ponto_estabelecimentos(company_id, nome, criado_por, ${cols}) values ($1, 'X', 'a', ${vals})`, [C]);
    await expect(ins("tipo_inscricao", "'cnpj'")).rejects.toThrow();
    await expect(ins("numero_inscricao", "'11222333000181'")).rejects.toThrow();
    await expect(ins("tipo_inscricao, numero_inscricao", "'cnpj', '1122233300018'")).rejects.toThrow();       // 13 dígitos
    // O banco confere estrutura (14 dígitos); o dígito verificador é conferido
    // pela aplicação (estabelecimento.js) antes de gravar - ver handler-arp.
    expect(await ins("tipo_inscricao, numero_inscricao", "'cnpj', '11222333000180'")).toEqual([]);
  });
});

describe("migration 017 - caminho B: produção simulada (016 com dados, depois 017)", () => {
  const DISP = [randomUUID(), randomUUID(), randomUUID()];
  let antes;

  beforeEach(async () => {
    db = await novoBanco();
    await db.exec(lerMigration("016_create_ponto_eletronico.up.sql"));
    // Aparelhos (um revogado), pareamentos, responsáveis, biometrias e marcações legadas.
    for (const [i, d] of DISP.entries()) {
      await q(`insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,status,criado_por,app_versao,aparelho)
        values ($1,$2,$3,$4,$5,$6,'admin','1.0.0 (3)','{"marca":"samsung"}')`, [C, d, i < 2 ? "obra-a" : "obra-b", `Aparelho ${i}`, sha256(d), i === 2 ? "revogado" : "ativo"]);
      await q(`insert into public.ponto_pareamentos(company_id,codigo_hash,obra_id,nome,expira_em,usado_em,dispositivo_id,criado_por)
        values ($1,$2,'obra-a','P',now(),now(),$3,'admin')`, [C, sha256(`codigo-${i}`), d]);
    }
    await q(`insert into public.ponto_pareamentos(company_id,codigo_hash,obra_id,nome,expira_em,criado_por) values ($1,$2,'obra-a','não usado',now(),'admin')`, [C, sha256("livre")]);
    await q(`insert into public.ponto_responsaveis(company_id,user_id,nome,pin_hash,pin_salt,pin_iteracoes,obras,atualizado_por)
      values ($1,'u-enc','Encarregado',$2,'sal',60000,'["obra-a"]','admin')`, [C, sha256("pin")]);
    await q(`insert into public.ponto_biometrias(company_id,employee_id,modelo,vetor,consentimento,cadastrado_por)
      values ($1,'e1','mobilefacenet-192',$2::jsonb,'{"termoVersao":"2026-10","aceitoEm":"2026-10-01T10:00:00Z"}','u-enc')`, [C, JSON.stringify(Array.from({ length: 192 }, (_, i) => i / 192))]);
    for (const d of DISP.slice(0, 2)) {
      let anterior = HASH_INICIAL;
      const lote = [];
      for (let nsr = 1; nsr <= 3; nsr++) {
        const m = { id: randomUUID(), dispositivoId: d, nsr, tipoRegistro: "ponto", employeeId: "e1", cpf: "12345678909", marcadoEm: `2026-10-01T0${nsr}:00:00.000Z`, horaConfiavel: true, metodo: "facial", confianca: 0.9, hashAnterior: anterior };
        m.hash = await calcularHashMarcacao(m, sha256);
        lote.push(m); anterior = m.hash;
      }
      await q("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, d, JSON.stringify(lote)]);
    }
    antes = {};
    for (const t of TABELAS_016) antes[t] = await foto(t, "1");
    await db.exec(lerMigration("017_ponto_arp_estabelecimento_nsr.up.sql"));
  });

  it("nada perdido nem alterado: mesmas linhas e mesmos valores nas 5 tabelas da 016", async () => {
    for (const t of TABELAS_016) {
      const depois = await foto(t, "1");
      expect(depois.length).toBe(antes[t].length);
      // Só colunas NOVAS aparecem; nenhuma coluna antiga muda de valor.
      const soAntigas = depois.map(l => Object.fromEntries(Object.keys(antes[t][0] || {}).map(k => [k, l[k]])));
      expect(soAntigas).toEqual(antes[t]);
    }
    expect((await q("select distinct record_format_version v from public.ponto_marcacoes")).map(r => r.v)).toEqual([1]);
    expect((await q("select count(*)::int n from public.ponto_marcacoes"))[0].n).toBe(6);
  });

  it("constraints novas valem sobre os dados migrados e a ARP funciona continuando a cadeia legada", async () => {
    const [est] = await q("insert into public.ponto_estabelecimentos(company_id,nome,criado_por) values ($1,'Matriz','admin') returning id", [C]);
    await q("insert into public.ponto_estabelecimento_obras(company_id,obra_id,estabelecimento_id,vinculado_por) values ($1,'obra-a',$2,'admin')", [C, est.id]);
    const [{ ultimo_hash: topoLegado }] = await q("select ultimo_hash from public.ponto_dispositivos where id = $1", [DISP[0]]);
    const evento = (seq, anterior, extra = {}) => ({ formatVersion: 2, eventId: randomUUID(), deviceId: DISP[0], localSequence: seq, localPreviousHash: anterior,
      localHash: sha256(`novo-${seq}-${extra.sal || ""}`), tipoRegistro: "ponto", employeeId: "e1", cpf: "12345678909", marcadoEm: "2026-10-01T12:00:00.000Z", horaConfiavel: true, metodo: "facial", ...extra });
    const registrar = (disp, eventos) => q("select * from public.ponto_arp_registrar($1, $2, $3::jsonb, '{}'::jsonb)", [C, disp, JSON.stringify(eventos)]);

    const e4 = evento(4, topoLegado);
    expect((await registrar(DISP[0], [e4]))[0]).toMatchObject({ status: "registrado", nsr: 1, estabelecimento_id: est.id });
    // (dispositivo, sequência local) duplicada: impossível.
    expect((await registrar(DISP[0], [evento(4, topoLegado, { sal: "outro" })]))[0]).toMatchObject({ status: "conflito" });
    // Evento declarando outro estabelecimento: recusado.
    const [outro] = await q("insert into public.ponto_estabelecimentos(company_id,nome,criado_por) values ($1,'Outro','admin') returning id", [C]);
    expect((await registrar(DISP[0], [evento(5, e4.localHash, { estabelecimentoId: outro.id })]))[0]).toMatchObject({ status: "conflito", motivo: "evento declara outro estabelecimento" });
    // Aparelho preso a um estabelecimento não muda para outro.
    await expect(q("update public.ponto_dispositivos set estabelecimento_id = $2 where id = $1", [DISP[0], outro.id])).rejects.toThrow(/não muda/);
    // Aparelho revogado antes da migração continua sem gravar.
    expect((await registrar(DISP[2], [evento(1, HASH_INICIAL)]))[0]).toMatchObject({ status: "dispositivo_revogado" });
    // Registro fiscal: UPDATE e DELETE bloqueados.
    await expect(q("update public.ponto_arp_registros set nsr = 99")).rejects.toThrow(/imutável/);
    await expect(q("delete from public.ponto_arp_registros")).rejects.toThrow(/imutável/);
    // O legado continua aceitando o app antigo (sem NSR fiscal) no outro aparelho.
    const [d1] = await q("select ultimo_nsr, ultimo_hash from public.ponto_dispositivos where id = $1", [DISP[1]]);
    const m4 = { id: randomUUID(), dispositivoId: DISP[1], nsr: Number(d1.ultimo_nsr) + 1, tipoRegistro: "ponto", employeeId: "e1", cpf: "1", marcadoEm: "2026-10-01T13:00:00.000Z", horaConfiavel: true, metodo: "facial", hashAnterior: d1.ultimo_hash };
    m4.hash = await calcularHashMarcacao(m4, sha256);
    expect((await q("select * from public.ponto_registrar_marcacoes($1, $2, $3::jsonb)", [C, DISP[1], JSON.stringify([m4])]))[0]).toMatchObject({ aceitas: 1, erro: null });
    expect((await q("select record_format_version v from public.ponto_marcacoes where id = $1", [m4.id]))[0].v).toBe(1);
  });
});

describe("016 intocada e ordem do deploy", () => {
  const raiz = path.resolve(__dirname, "../../..");
  it("a migration 016 é exatamente a que já foi aplicada em produção (nunca editada)", () => {
    const texto = fs.readFileSync(path.join(raiz, "migrations/016_create_ponto_eletronico.up.sql"), "utf8").replace(/\r\n/g, "\n");
    expect(sha256(texto)).toBe("86a24889158572e3a126d67c77366c73efa23731709d55e662d8c13f9eb5a9d0");
  });

  it("o script de deploy aplica a 016 e DEPOIS a 017, e valida a 017", () => {
    const script = fs.readFileSync(path.join(raiz, "scripts/apply-ponto-eletronico.mjs"), "utf8");
    const i016 = script.indexOf("016_create_ponto_eletronico.up.sql"), i017 = script.indexOf("017_ponto_arp_estabelecimento_nsr.up.sql");
    expect(i016).toBeGreaterThan(0);
    expect(i017).toBeGreaterThan(i016);
    expect(script).toMatch(/ponto_arp_registrar/);
    expect(script).toMatch(/arp\?\.tabelas !== 6/);
  });
});
