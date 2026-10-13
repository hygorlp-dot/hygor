// @vitest-environment node
//
// HOMOLOGAÇÃO ISOLADA de ponta a ponta (PGlite, dados SINTÉTICOS): provisiona
// um banco marcado como homologação, sobe o tratador REAL do servidor em modo
// homologação, pareia com código gerado, sincroniza o cadastro sintético e
// bate - o NSR sai SÓ no banco isolado. E as recusas: banco com cara de
// produção, sem marcador, confirmação errada, identidade da produção, reset
// fora da homologação.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PAPEIS_SUPABASE, camadaSupabase, lerMigration } from "../../server/ponto-eletronico/banco-pglite.test-helper.js";
import { criarTratadorPonto } from "../../server/ponto-eletronico/handler.js";
import { FORMATO_EVENTO, HASH_INICIAL, calcularHashLocal } from "../../src/domains/ponto-eletronico/evento.js";
import { adaptadorPglite } from "../migracoes-ponto/adaptadores.mjs";
import {
  COMPANY, CHAVE_DADOS, ENCARREGADO, ESTABELECIMENTO, MARCADOR_BANCO, OBRAS, TRABALHADORES,
  conferir, cpfSintetico, gerarCodigoPareamento, marcadorDoBanco, provisionar, recusasDoDestino, resetar,
} from "./homologacao.mjs";

vi.setConfig({ testTimeout: 120000, hookTimeout: 60000 });
const sha256 = v => createHash("sha256").update(v).digest("hex");
const ESQUEMA_ERP = readFileSync(new URL("../../schema.sql", import.meta.url), "utf8");
const MANIFESTO = JSON.parse(readFileSync(new URL("../migracoes-ponto/manifesto-com-019.json", import.meta.url), "utf8")).migracoes;
const lerArquivo = async a => lerMigration(a);
const IDENT = "postgres.homologref0000000000@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
const bancos = [];
afterAll(async () => { for (const b of bancos) await b.close(); });

async function bancoNovo({ marcarComoHomologacao = true } = {}) {
  const pg = new PGlite({ extensions: { pgcrypto, pg_trgm } });   // pg_trgm: schema.sql do ERP (busca do orçamento)
  bancos.push(pg);
  await pg.exec(PAPEIS_SUPABASE);
  if (marcarComoHomologacao) await pg.exec(`do $$ begin execute format('comment on database %I is %L', current_database(), '${MARCADOR_BANCO}'); end $$;`);
  return { pg, db: adaptadorPglite(pg) };
}
const servidor = (pg, ambienteDeclarado = "homologacao") => criarTratadorPonto({
  db: camadaSupabase(pg), company: COMPANY, ambienteDeclarado, autenticarUsuario: async () => null,
  supabaseUrl: "https://homologacaoteste00000.supabase.co",   // projeto de homologação (nunca o de produção)
  lerDados: async () => (await pg.query("select value from public.company_app_data where company_id = $1 and key = $2", [COMPANY, CHAVE_DADOS])).rows[0]?.value || {},
});

describe("homologação isolada: provisionar e operar sem tocar na produção", () => {
  it("provisiona (esquema do ERP + livro 016-019 + marcador + semente sintética), pareia, sincroniza e emite NSR só no banco isolado", async () => {
    const { pg, db } = await bancoNovo();
    expect(await recusasDoDestino(db, { identidade: IDENT, confirmacao: IDENT })).toEqual([]);
    const r = await provisionar(db, { esquemaErp: ESQUEMA_ERP, manifesto: MANIFESTO, lerArquivo, pinEncarregado: "4821" });
    expect(r.gate).toBe("GO 019");
    expect(r.livro).toEqual(MANIFESTO.map(m => `aplicar ${m.arquivo}`));
    expect(await conferir(db, { lerArquivo })).toMatchObject({ marcador: "homologacao", comentario: MARCADOR_BANCO, gate: "GO 019", dadosSinteticos: true, trabalhadores: TRABALHADORES.length });
    // Origem do livro identifica a homologação.
    expect((await pg.query("select distinct origem from public.ponto_migracoes_aplicadas")).rows).toEqual([{ origem: "homologacao" }]);

    // Servidor REAL em modo homologação: confirma pelo marcador do banco.
    const tratar = servidor(pg);
    expect((await tratar({ action: "ponto-ambiente" })).json).toEqual({ ambiente: "homologacao" });
    const { codigo } = await gerarCodigoPareamento(db, { obraId: OBRAS[0].id });
    const par = await tratar({ action: "ponto-parear", body: { codigo, ambienteApp: "homologacao", aparelho: { ambiente: "homologacao", commit: "teste01" } } });
    expect(par).toMatchObject({ status: 200, json: { ambiente: "homologacao", estabelecimento: { id: ESTABELECIMENTO.id } } });
    const api = (action, body = {}) => tratar({ action, body: { ambienteApp: "homologacao", ...body }, headers: { authorization: `Bearer ${par.json.token}` } });

    // Cadastro sintético chega ao aparelho: trabalhadores, encarregado, terceirizado.
    const sinc = await api("ponto-sincronizar");
    expect(sinc.json.ambiente).toBe("homologacao");
    expect(sinc.json.funcionarios.map(f => f.id).sort()).toEqual(TRABALHADORES.map(t => t.id).sort());
    expect(sinc.json.funcionarios.every(f => f.cpf.startsWith("000"))).toBe(true);
    expect(sinc.json.responsaveis.map(x => x.userId)).toEqual([ENCARREGADO.userId]);
    expect(sinc.json.terceirizados).toHaveLength(1);

    // Batidas: funcionário recebe NSR (sequencial) no banco ISOLADO; terceirizado não.
    let anterior = HASH_INICIAL;
    const evento = async (seq, extra) => {
      const e = { formatVersion: FORMATO_EVENTO, eventId: randomUUID(), deviceId: par.json.dispositivoId, estabelecimentoId: "", localSequence: seq,
        tipoRegistro: "ponto", employeeId: TRABALHADORES[1].id, terceiroId: "", cpf: TRABALHADORES[1].cpf, marcadoEm: new Date().toISOString(),
        horaConfiavel: true, metodo: "encarregado", encarregadoId: ENCARREGADO.userId, localPreviousHash: anterior, ...extra };
      e.localHash = await calcularHashLocal(e, sha256); anterior = e.localHash; return e;
    };
    const lote = [await evento(1), await evento(2), await evento(3, { tipoRegistro: "acesso_terceiro", employeeId: "", cpf: "", terceiroId: "homolog-terc-1" })];
    const env = await api("ponto-enviar-marcacoes", { eventos: lote });
    expect(env.json.resultados.map(x => [x.status, x.nsr ?? null])).toEqual([["registrado", 1], ["registrado", 2], ["acesso_registrado", null]]);
    // Reenvio idempotente: nada novo.
    const de_novo = await api("ponto-enviar-marcacoes", { eventos: lote });
    expect(de_novo.json.resultados.map(x => x.nsr ?? null)).toEqual([1, 2, null]);
    expect((await pg.query("select count(*)::int n, max(nsr)::int m from public.ponto_arp_registros")).rows[0]).toEqual({ n: 2, m: 2 });

    // App de PRODUÇÃO contra este servidor: recusado sem gravar.
    const prodApp = await tratar({ action: "ponto-enviar-marcacoes", body: { ambienteApp: "producao", eventos: [await evento(4)] }, headers: { authorization: `Bearer ${par.json.token}` } });
    expect(prodApp).toMatchObject({ status: 409, json: { code: "AMBIENTE_INCOMPATIVEL" } });
    expect((await pg.query("select count(*)::int n from public.ponto_arp_registros")).rows[0].n).toBe(2);
  });

  it("banco com cara de PRODUÇÃO (registros do ponto, sem marcador): provisionamento recusado; servidor em homologação bloqueia tudo", async () => {
    const { pg, db } = await bancoNovo({ marcarComoHomologacao: false });
    for (const f of ["016_create_ponto_eletronico.up.sql", "017_ponto_arp_estabelecimento_nsr.up.sql", "018_ponto_apropriacoes.up.sql"]) await pg.exec(lerMigration(f));
    await pg.query("insert into public.ponto_dispositivos(company_id,id,obra_id,nome,token_hash,criado_por) values ('arcd',$1,'obra-real','A',$2,'admin')", [randomUUID(), sha256("x")]);
    const recusas = await recusasDoDestino(db, { identidade: IDENT, confirmacao: IDENT });
    expect(recusas.join(" | ")).toMatch(/não está marcado como homologação/);
    expect(recusas.join(" | ")).toMatch(/pode ser a PRODUÇÃO/);
    // Mesmo que alguém configure PONTO_AMBIENTE=homologacao apontando para este banco:
    const tratar = servidor(pg);
    expect(await tratar({ action: "ponto-ambiente" })).toMatchObject({ status: 503, json: { code: "AMBIENTE_NAO_CONFIRMADO" } });
    expect(await tratar({ action: "ponto-parear", body: { codigo: "12345678" } })).toMatchObject({ status: 503 });
  });

  it("guardas: confirmação errada, identidade da produção, mesmo projeto Supabase pelo acesso direto, ERP com dados reais", async () => {
    const { pg, db } = await bancoNovo();
    expect((await recusasDoDestino(db, { identidade: IDENT, confirmacao: "outro" })).join()).toMatch(/confirme o banco de homologação/);
    expect((await recusasDoDestino(db, { identidade: IDENT, confirmacao: IDENT, identidadesProducao: [IDENT] })).join()).toMatch(/PRODUÇÃO/);
    const direto = "postgres@db.homologref0000000000.supabase.co:5432/postgres";
    expect((await recusasDoDestino(db, { identidade: IDENT, confirmacao: IDENT, identidadesProducao: [direto] })).join()).toMatch(/mesmo projeto Supabase da PRODUÇÃO/);
    await pg.exec(readFileSync(new URL("../../schema.sql", import.meta.url), "utf8"));
    await pg.query("update public.company_app_data set value = $1::jsonb where company_id = 'arcd'", [JSON.stringify({ employees: [{ id: "real", name: "Pessoa Real" }] })]);
    expect((await recusasDoDestino(db, { identidade: IDENT, confirmacao: IDENT })).join()).toMatch(/dados do ERP que não são sintéticos/);
  });

  it("reset controlado: só com marcador; depois do reset o mesmo banco provisiona de novo do zero", async () => {
    const { pg, db } = await bancoNovo();
    await provisionar(db, { esquemaErp: ESQUEMA_ERP, manifesto: MANIFESTO, lerArquivo, pinEncarregado: "4821" });
    await resetar(db);
    expect((await pg.query("select count(*)::int n from pg_class where relname like 'ponto%' and relkind = 'r'")).rows[0].n).toBe(0);
    expect(await marcadorDoBanco(db)).toBe("homologacao");                       // marcador fica
    expect((await provisionar(db, { esquemaErp: ESQUEMA_ERP, manifesto: MANIFESTO, lerArquivo, pinEncarregado: "4821" })).gate).toBe("GO 019");
    const outro = await bancoNovo({ marcarComoHomologacao: false });
    await expect(resetar(outro.db)).rejects.toThrow(/reset recusado/);
  });

  it("CPF sintético tem dígito válido e prefixo 000; nenhuma semente usa dado real", () => {
    const valido = cpf => { const d = [...cpf].map(Number); const dv = n => { const s = d.slice(0, n).reduce((t, x, i) => t + x * (n + 1 - i), 0) % 11; return s < 2 ? 0 : 11 - s; }; return dv(9) === d[9] && dv(10) === d[10]; };
    for (let i = 1; i <= 6; i++) { const c = cpfSintetico(i); expect(c).toMatch(/^000\d{8}$/); expect(valido(c)).toBe(true); }
    expect(TRABALHADORES.every(t => /Sintético/.test(t.name))).toBe(true);
  });
});

describe("preparação da Vercel, bucket e Storage da homologação", () => {
  const jwt = ref => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role", ref })).toString("base64url")}.assinatura`;
  const REF = "homologref0000000000";
  const ok = {
    PONTO_AMBIENTE: "homologacao", SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: jwt(REF),
    POSTGRES_URL_NON_POOLING: `postgres://postgres.${REF}:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`, CRON_SECRET: "novo",
  };

  it("variáveis do projeto Vercel de homologação: completas e do MESMO projeto = sem erro; nada de valor nas mensagens", async () => {
    const { validarVariaveisDeHomologacao } = await import("./homologacao.mjs");
    const r = validarVariaveisDeHomologacao(ok);
    expect(r.erros).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(REF);
  });

  it("variáveis: faltando, ambiente errado, segredos da produção copiados, chave e banco de OUTRO projeto = NO-GO", async () => {
    const { validarVariaveisDeHomologacao } = await import("./homologacao.mjs");
    const r = validarVariaveisDeHomologacao({ ...ok, PONTO_AMBIENTE: "producao", CRON_SECRET: "", BACKUP_ENCRYPTION_KEY: "x", MICROSOFT_CLIENT_SECRET: "y",
      SUPABASE_SERVICE_ROLE_KEY: jwt("outroprojeto0000000"), POSTGRES_URL_NON_POOLING: "postgres://postgres.outroprojeto0000000:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" });
    const t = r.erros.join(" | ");
    for (const esperado of [/CRON_SECRET ausente/, /PONTO_AMBIENTE precisa ser 'homologacao'/, /BACKUP_ENCRYPTION_KEY presente/, /MICROSOFT_CLIENT_SECRET presente/,
      /SERVICE_ROLE_KEY é de outro projeto/, /POSTGRES_URL_NON_POOLING é de outro projeto/]) expect(t).toMatch(esperado);
  });

  it("bucket: criado PRIVADO quando falta; público vira privado; sem esquema storage = 'sem_storage'", async () => {
    const { garantirBucketPrivado, situacaoDoBucket } = await import("./homologacao.mjs");
    const { pg, db } = await bancoNovo();
    expect(await situacaoDoBucket(db)).toBe("sem_storage");
    await pg.exec("create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);");
    expect(await garantirBucketPrivado(db)).toBe("privado");
    await pg.exec("update storage.buckets set public = true");
    expect(await situacaoDoBucket(db)).toBe("PUBLICO");
    expect(await garantirBucketPrivado(db)).toBe("privado");
  });

  it("Storage: limpeza apaga as fotos de teste em subpastas; recusa projeto diferente do banco", async () => {
    const { limparStorageHomologacao, evidenciaDeProjeto } = await import("./homologacao.mjs");
    const arquivos = new Set(["marcacoes/homolog-obra-1/2026-10-12/a.jpg", "marcacoes/homolog-obra-1/2026-10-12/b.jpg", "biometria/homolog-trab-1/x-1.jpg"]);
    const storage = { from: () => ({
      async list(prefixo) {
        const nivel = prefixo ? `${prefixo}/` : "";
        const nomes = [...new Set([...arquivos].filter(c => c.startsWith(nivel)).map(c => c.slice(nivel.length).split("/")[0]))];
        return { data: nomes.map(n => ({ name: n, id: arquivos.has(`${nivel}${n}`) ? n : null })), error: null };
      },
      async remove(lista) { for (const c of lista) arquivos.delete(c); return { error: null }; },
    }) };
    const identidade = `postgres.${REF}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;
    expect(await limparStorageHomologacao({ storage, supabaseUrl: `https://${REF}.supabase.co`, identidade })).toEqual({ apagados: 3 });
    expect(arquivos.size).toBe(0);
    await expect(limparStorageHomologacao({ storage, supabaseUrl: "https://outroprojeto0000000.supabase.co", identidade })).rejects.toThrow(/mesmo projeto/);
    expect(evidenciaDeProjeto(identidade)).toMatchObject({ reconhecido: true, ehProducao: false, hashPrefixo: expect.stringMatching(/^[0-9a-f]{12}$/) });
  });
});
