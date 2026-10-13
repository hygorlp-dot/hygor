// HOMOLOGAÇÃO ISOLADA do Ponto de Obra (docs/PONTO-OBRA-HOMOLOGACAO.md).
//
// Um banco PostgreSQL (projeto Supabase) SEPARADO da produção, só com dados
// SINTÉTICOS, onde o APK de homologação pode parear, bater, sincronizar e
// receber NSR - sem nunca tocar no registro fiscal real. Este módulo:
//   - recusa qualquer destino com cara de produção (guardas);
//   - cria o MARCADOR arcd_ambiente, que o servidor exige para operar em
//     homologação (server/ponto-eletronico/ambiente.js);
//   - aplica o esquema pelo livro de migrations (016-019) e confere o gate;
//   - semeia empresa, obras, trabalhadores, terceirizado, estabelecimento e
//     encarregado FICTÍCIOS (nenhum dado pessoal real; biometria só pelo app,
//     com pessoas que autorizarem);
//   - gera código de pareamento e faz o reset controlado (só com marcador).
//
// db: adaptador do livro (query, exec, transacao) - scripts/migracoes-ponto/adaptadores.mjs.
import crypto from "node:crypto";
import { aplicar, verificarGate } from "../migracoes-ponto/livro.mjs";
import { identidadeBanco, projetoSupabase } from "../migracoes-ponto/locais.mjs";
import { PIN_ITERACOES, hashPin } from "../../server/ponto-eletronico/handler.js";
import { HASH_REF_PRODUCAO, hashDoRef } from "../../server/ponto-eletronico/ambiente.js";

export const COMPANY = "arcd";                              // mesmo COMPANY_ID padrão da API; banco separado
export const CHAVE_DADOS = "arced_ponto_v1";
export const MARCADOR_BANCO = "arcd-ponto-homologacao";     // comment on database (posto pelo operador no projeto novo)
export const TABELA_MARCADOR = "arcd_ambiente";
export const AVISO = "NÃO OFICIAL — HOMOLOGAÇÃO";
export const ORIGEM_LIVRO = "homologacao";
const TABELAS_COM_REGISTRO = ["ponto_eventos", "ponto_arp_registros", "ponto_marcacoes", "ponto_dispositivos", "ponto_biometrias"];

export const DDL_MARCADOR = `
create table if not exists public.${TABELA_MARCADOR} (
  id        boolean     primary key default true check (id),
  ambiente  text        not null check (ambiente = 'homologacao'),
  descricao text        not null default '${AVISO}',
  criado_em timestamptz not null default now()
);
alter table public.${TABELA_MARCADOR} enable row level security;
do $$
declare papel text;
begin
  revoke all on table public.${TABELA_MARCADOR} from public;
  foreach papel in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = papel) then execute format('revoke all on table public.${TABELA_MARCADOR} from %I', papel); end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.${TABELA_MARCADOR} from service_role';
    execute 'grant select on table public.${TABELA_MARCADOR} to service_role';
  end if;
end $$;
insert into public.${TABELA_MARCADOR} (id, ambiente) values (true, 'homologacao') on conflict (id) do nothing;`;

const existe = async (db, tabela) => !!(await db.query("select to_regclass($1) is not null as e", [`public.${tabela}`]))[0].e;
export async function comentarioDoBanco(db) {
  const [l] = await db.query("select shobj_description(oid, 'pg_database') as c from pg_database where datname = current_database()");
  return l?.c || null;
}
export async function marcadorDoBanco(db) {
  if (!(await existe(db, TABELA_MARCADOR))) return null;
  const [l] = await db.query(`select ambiente from public.${TABELA_MARCADOR} where id`);
  return l?.ambiente || null;
}
const dadosDoErp = async db => {
  if (!(await existe(db, "company_app_data"))) return null;
  const [l] = await db.query("select value from public.company_app_data where company_id = $1 and key = $2", [COMPANY, CHAVE_DADOS]);
  return l?.value ?? null;
};
const ehSintetico = valor => !valor || (typeof valor === "object" && (Object.keys(valor).length === 0 || valor.homologacaoSintetica === true));

// Recusas (lista vazia = pode seguir). identidadesProducao: identidades
// (usuario@host:porta/banco) conhecidas da produção no ambiente do operador.
export async function recusasDoDestino(db, { identidade, confirmacao, identidadesProducao = [], exigirMarcador = false }) {
  const r = [];
  if (confirmacao !== identidade) r.push("confirme o banco de homologação: --confirmo-homologacao=<usuario@host:porta/banco> (o valor não é exibido)");
  for (const prod of identidadesProducao.filter(Boolean)) {
    if (prod === identidade) r.push("o destino é o banco de PRODUÇÃO");
    else if (projetoSupabase(prod) && projetoSupabase(prod) === projetoSupabase(identidade)) r.push("o destino é do mesmo projeto Supabase da PRODUÇÃO");
  }
  // O projeto Supabase da PRODUÇÃO é reconhecido pelo hash do ref, mesmo sem as variáveis de produção no ambiente.
  const ref = projetoSupabase(identidade);
  if (ref && hashDoRef(ref) === HASH_REF_PRODUCAO) r.push("o destino é o projeto Supabase da PRODUÇÃO");
  if ((await comentarioDoBanco(db)) !== MARCADOR_BANCO) {
    r.push(`o banco não está marcado como homologação. No projeto NOVO de homologação (nunca na produção): comment on database <banco> is '${MARCADOR_BANCO}';`);
  }
  const marcador = await marcadorDoBanco(db);
  if (marcador && marcador !== "homologacao") r.push(`marcador de ambiente inesperado: ${marcador}`);
  if (exigirMarcador && marcador !== "homologacao") r.push("o banco não tem o marcador de homologação (arcd_ambiente): esta operação só roda num banco já provisionado como homologação");
  if (!marcador) {
    for (const t of TABELAS_COM_REGISTRO) {
      if (!(await existe(db, t))) continue;
      const [{ n }] = await db.query(`select count(*)::int as n from public.${t}`);
      if (n > 0) { r.push(`o banco já tem registros do ponto (${t}: ${n}) e não é homologação: pode ser a PRODUÇÃO`); break; }
    }
    if (!ehSintetico(await dadosDoErp(db))) r.push("o banco já tem dados do ERP que não são sintéticos: pode ser a PRODUÇÃO");
  }
  return r;
}

// ---------------------------------------------------------------- dados sintéticos
const digitoCpf = (base, pesoInicial) => { const s = [...base].reduce((t, d, i) => t + Number(d) * (pesoInicial - i), 0) % 11; return s < 2 ? 0 : 11 - s; };
// CPF sintético VÁLIDO no dígito, com prefixo 000 (faixa sem uso real conhecido), só para testes.
export function cpfSintetico(i) {
  const base = `000${String(100000 + i).slice(-6)}`;
  const d1 = digitoCpf(base, 10), d2 = digitoCpf(`${base}${d1}`, 11);
  return `${base}${d1}${d2}`;
}
export const OBRAS = [
  { id: "homolog-obra-1", name: "OBRA FICTÍCIA 1 — HOMOLOGAÇÃO" },
  { id: "homolog-obra-2", name: "OBRA FICTÍCIA 2 — HOMOLOGAÇÃO" },
];
export const TRABALHADORES = Array.from({ length: 6 }, (_, i) => ({
  id: `homolog-trab-${i + 1}`, name: `Trabalhador Sintético ${String(i + 1).padStart(2, "0")}`, role: i === 0 ? "Encarregado" : "Pedreiro",
  cpf: cpfSintetico(i + 1), obra: OBRAS[i % 2].id, active: true,
}));
export const TERCEIRIZADOS = [{ id: "homolog-terc-1", name: "Empresa Terceirizada Fictícia", obraId: OBRAS[0].id, specialty: "Elétrica" }];
export const ESTABELECIMENTO = { id: "48a4ec20-6f6d-4c6f-8000-000000000001", nome: `ESTABELECIMENTO DE TESTE — ${AVISO}` };
export const ENCARREGADO = { userId: "homolog-encarregado", nome: "Encarregado de Homologação" };

export async function semear(db, { pinEncarregado }) {
  if (!/^\d{4,8}$/.test(String(pinEncarregado || ""))) throw new Error("PIN do encarregado de homologação: 4 a 8 números (PONTO_HOMOLOGACAO_PIN)");
  const valor = { homologacaoSintetica: true, aviso: AVISO, obras: OBRAS, employees: TRABALHADORES, terceirizados: TERCEIRIZADOS };
  const atual = await dadosDoErp(db);
  if (!ehSintetico(atual)) throw new Error("company_app_data tem dados que não são sintéticos: semente recusada");
  await db.transacao(async () => {
    await db.query(`insert into public.company_app_data (company_id, key, value) values ($1, $2, $3::text::jsonb)
      on conflict (company_id, key) do update set value = excluded.value, updated_at = now()`, [COMPANY, CHAVE_DADOS, JSON.stringify(valor)]);
    await db.query(`insert into public.ponto_estabelecimentos (company_id, id, nome, criado_por) values ($1, $2, $3, 'homologacao')
      on conflict (company_id, id) do nothing`, [COMPANY, ESTABELECIMENTO.id, ESTABELECIMENTO.nome]);
    for (const o of OBRAS) {
      await db.query(`insert into public.ponto_estabelecimento_obras (company_id, obra_id, estabelecimento_id, vinculado_por) values ($1, $2, $3, 'homologacao')
        on conflict do nothing`, [COMPANY, o.id, ESTABELECIMENTO.id]);
    }
    const sal = crypto.randomBytes(16).toString("hex");
    await db.query(`insert into public.ponto_responsaveis (company_id, user_id, nome, pin_hash, pin_salt, pin_iteracoes, atualizado_por) values ($1, $2, $3, $4, $5, $6, 'homologacao')
      on conflict (company_id, user_id) do update set pin_hash = excluded.pin_hash, pin_salt = excluded.pin_salt, pin_iteracoes = excluded.pin_iteracoes, atualizado_em = now()`,
    [COMPANY, ENCARREGADO.userId, ENCARREGADO.nome, hashPin(String(pinEncarregado), sal, PIN_ITERACOES), sal, PIN_ITERACOES]);
  });
  return { obras: OBRAS.length, trabalhadores: TRABALHADORES.length, terceirizados: TERCEIRIZADOS.length, estabelecimento: ESTABELECIMENTO.nome };
}

// ---------------------------------------------------------------- operações
// esquemaErp: conteúdo do schema.sql (base do ERP: company_app_data etc.).
export async function provisionar(db, { esquemaErp, manifesto, lerArquivo, pinEncarregado }) {
  await db.exec(esquemaErp);
  const livro = await aplicar({ db, manifesto, lerArquivo, origem: ORIGEM_LIVRO });
  await db.transacao(async () => { await db.exec(DDL_MARCADOR); });
  const semente = await semear(db, { pinEncarregado });
  const bucket = await garantirBucketPrivado(db);
  const gate = await verificarGate(db, { lerArquivo });
  if (gate.resultado !== "GO") throw new Error(`gate depois do provisionamento: ${gate.resultado} (${gate.motivos.join("; ")})`);
  return { livro: livro.passos.map(p => `${p.acao} ${p.arquivo}`), semente, bucket, gate: `${gate.resultado} ${gate.versaoFiscal}` };
}

// Bucket PRIVADO das fotos (a 016 tenta criar, mas engole o erro para não
// derrubar o deploy). Aqui a falta vira erro visível. Banco sem o esquema
// "storage" (Postgres puro, testes) devolve "sem_storage".
export const BUCKET = "ponto-obra";
export async function situacaoDoBucket(db) {
  const [{ e }] = await db.query("select to_regclass('storage.buckets') is not null as e");
  if (!e) return "sem_storage";
  const [b] = await db.query("select public from storage.buckets where id = $1", [BUCKET]);
  return !b ? "ausente" : b.public ? "PUBLICO" : "privado";
}
export async function garantirBucketPrivado(db) {
  const antes = await situacaoDoBucket(db);
  if (antes === "sem_storage" || antes === "privado") return antes;
  if (antes === "ausente") {
    await db.query("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ($1, $1, false, 2097152, array['image/jpeg'])", [BUCKET]);
  } else {
    await db.query("update storage.buckets set public = false where id = $1", [BUCKET]);
  }
  const depois = await situacaoDoBucket(db);
  if (depois !== "privado") throw new Error(`bucket ${BUCKET} não ficou privado (${depois})`);
  return depois;
}

export async function gerarCodigoPareamento(db, { obraId = OBRAS[0].id, nome = "Aparelho de homologação", agoraMs = Date.now() } = {}) {
  if (!OBRAS.some(o => o.id === obraId)) throw new Error("obra fora da semente de homologação");
  const codigo = String(crypto.randomInt(0, 100_000_000)).padStart(8, "0");
  await db.query(`insert into public.ponto_pareamentos (company_id, codigo_hash, obra_id, nome, expira_em, criado_por) values ($1, $2, $3, $4, $5, 'homologacao')`,
    [COMPANY, crypto.createHash("sha256").update(codigo).digest("hex"), obraId, nome, new Date(agoraMs + 30 * 60_000).toISOString()]);
  return { codigo, obraId, expiraEm: new Date(agoraMs + 30 * 60_000).toISOString() };
}

// Conferência somente leitura do banco de homologação.
export async function conferir(db, { lerArquivo }) {
  const gate = await verificarGate(db, { lerArquivo });
  const contagem = {};
  for (const t of ["ponto_dispositivos", "ponto_eventos", "ponto_arp_registros", "ponto_biometrias"]) contagem[t] = (await existe(db, t)) ? (await db.query(`select count(*)::int as n from public.${t}`))[0].n : null;
  const erp = await dadosDoErp(db);
  return {
    marcador: await marcadorDoBanco(db), comentario: await comentarioDoBanco(db), gate: `${gate.resultado} ${gate.versaoFiscal || "-"}`, bucket: await situacaoDoBucket(db),
    dadosSinteticos: ehSintetico(erp), trabalhadores: Array.isArray(erp?.employees) ? erp.employees.length : 0, contagem,
  };
}

// Reset CONTROLADO: só num banco provisionado como homologação. Apaga o
// esquema do ponto (tabelas, funções, livro) - os registros fiscais de TESTE
// somem junto; depois, provisionar de novo. O marcador e o comentário ficam.
export async function resetar(db) {
  if ((await marcadorDoBanco(db)) !== "homologacao" || (await comentarioDoBanco(db)) !== MARCADOR_BANCO) {
    throw new Error("reset recusado: o banco não é uma homologação provisionada (marcador e comentário obrigatórios)");
  }
  await db.transacao(async () => {
    await db.exec(`do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and (c.relname like 'ponto\\_%' or c.relname = 'ponto_migracoes_aplicadas') loop
    execute format('drop table if exists public.%I cascade', r.relname);
  end loop;
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'ponto\\_%' loop
    execute format('drop function if exists %s cascade', r.f);
  end loop;
end $$;`);
    await db.query("update public.company_app_data set value = '{}'::jsonb, updated_at = now() where company_id = $1 and key = $2", [COMPANY, CHAVE_DADOS]);
  });
}

// ---------------------------------------------------------------- identidade, variáveis e Storage
// Evidência de que o projeto de homologação NÃO é o de produção, sem expor o
// ref: compara o hash do ref com o de produção e mostra só um prefixo do hash.
export function evidenciaDeProjeto(identidade) {
  const ref = projetoSupabase(identidade);
  if (!ref) return { reconhecido: false, ehProducao: false, hashPrefixo: null };
  const h = hashDoRef(ref);
  return { reconhecido: true, ehProducao: h === HASH_REF_PRODUCAO, hashPrefixo: h.slice(0, 12) };
}

const refDaChave = chave => {
  const partes = String(chave || "").split(".");
  if (partes.length !== 3) return null;                    // chave nova (sb_secret_...) não traz o ref
  try { return JSON.parse(Buffer.from(partes[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")).ref || null; } catch { return null; }
};
const refDaUrl = url => { try { return new URL(url).hostname.split(".")[0].toLowerCase(); } catch { return null; } };

// Variáveis que NÃO podem ir para o projeto Vercel de homologação (vêm da
// produção e não servem à homologação: backup, OneDrive, IA, chaves).
export const PROIBIDAS_NA_HOMOLOGACAO = ["BACKUP_ENCRYPTION_KEY", "PONTO_BACKUP_KEY", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI",
  "ONEDRIVE_ROOT_FOLDER_URL", "GEMINI_API_KEY", "AI_ENCRYPTION_KEY"];
export const OBRIGATORIAS_NA_HOMOLOGACAO = ["PONTO_AMBIENTE", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "POSTGRES_URL_NON_POOLING", "CRON_SECRET"];

// vars: objeto { NOME: valor } (arquivo .env do projeto Vercel de homologação).
// Devolve { erros, avisos } SEM nenhum valor nas mensagens.
export function validarVariaveisDeHomologacao(vars, { identidadeDoBanco } = {}) {
  const erros = [], avisos = [];
  for (const n of OBRIGATORIAS_NA_HOMOLOGACAO) if (!String(vars[n] ?? "").trim()) erros.push(`${n} ausente`);
  if (vars.PONTO_AMBIENTE && vars.PONTO_AMBIENTE !== "homologacao") erros.push("PONTO_AMBIENTE precisa ser 'homologacao'");
  for (const n of PROIBIDAS_NA_HOMOLOGACAO) if (String(vars[n] ?? "").trim()) erros.push(`${n} presente: não copiar da produção (a homologação não usa)`);
  const refUrl = refDaUrl(vars.SUPABASE_URL);
  if (vars.SUPABASE_URL && !refUrl) erros.push("SUPABASE_URL inválida");
  if (refUrl && hashDoRef(refUrl) === HASH_REF_PRODUCAO) erros.push("SUPABASE_URL é do projeto de PRODUÇÃO");
  const refChave = refDaChave(vars.SUPABASE_SERVICE_ROLE_KEY);
  if (vars.SUPABASE_SERVICE_ROLE_KEY && !refChave) avisos.push("SUPABASE_SERVICE_ROLE_KEY sem ref legível (chave nova): confira no painel que é do projeto de homologação");
  if (refChave && hashDoRef(refChave) === HASH_REF_PRODUCAO) erros.push("SUPABASE_SERVICE_ROLE_KEY é do projeto de PRODUÇÃO");
  if (refChave && refUrl && refChave.toLowerCase() !== refUrl) erros.push("SUPABASE_SERVICE_ROLE_KEY é de outro projeto que não o da SUPABASE_URL");
  if (vars.POSTGRES_URL_NON_POOLING) {
    let ident = null;
    try { ident = identidadeBanco(vars.POSTGRES_URL_NON_POOLING); } catch { erros.push("POSTGRES_URL_NON_POOLING inválida"); }
    const refPg = ident ? projetoSupabase(ident) : null;
    if (refPg && hashDoRef(refPg) === HASH_REF_PRODUCAO) erros.push("POSTGRES_URL_NON_POOLING é do projeto de PRODUÇÃO");
    if (refPg && refUrl && refPg.toLowerCase() !== refUrl) erros.push("POSTGRES_URL_NON_POOLING é de outro projeto que não o da SUPABASE_URL");
    if (ident && !refPg) avisos.push("POSTGRES_URL_NON_POOLING não é de um projeto Supabase reconhecível: confira o isolamento à mão");
    if (ident && identidadeDoBanco && ident !== identidadeDoBanco) avisos.push("POSTGRES_URL_NON_POOLING difere do banco provisionado (PONTO_HOMOLOGACAO_DB_URL)");
  }
  if (vars.CRON_SECRET) avisos.push("CRON_SECRET: use um valor NOVO, nunca o da produção");
  return { erros, avisos };
}

// Limpeza do Storage da homologação (fotos de TESTE) no reset. Só com URL de
// projeto que não é o de produção E que é o mesmo projeto do banco marcado.
// storage: cliente com a API do supabase-js (storage.from(bucket)).
export async function limparStorageHomologacao({ storage, supabaseUrl, identidade }) {
  const ref = refDaUrl(supabaseUrl);
  if (!ref) throw new Error("URL do Supabase de homologação inválida");
  if (hashDoRef(ref) === HASH_REF_PRODUCAO) throw new Error("limpeza recusada: é o projeto Supabase de PRODUÇÃO");
  const doBanco = projetoSupabase(identidade);
  if (!doBanco || doBanco.toLowerCase() !== ref) throw new Error("limpeza recusada: o Storage não é do mesmo projeto do banco de homologação");
  const bucket = storage.from(BUCKET);
  let apagados = 0;
  const pastas = [""];
  const arquivos = [];
  while (pastas.length) {
    const prefixo = pastas.pop();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket.list(prefixo, { limit: 1000, offset });
      if (error) throw new Error(`listar o Storage: ${error.message}`);
      for (const it of data || []) (it.id ? arquivos : pastas).push(prefixo ? `${prefixo}/${it.name}` : it.name);
      if ((data || []).length < 1000) break;
    }
  }
  for (let i = 0; i < arquivos.length; i += 100) {
    const { error } = await bucket.remove(arquivos.slice(i, i + 100));
    if (error) throw new Error(`apagar do Storage: ${error.message}`);
    apagados += Math.min(100, arquivos.length - i);
  }
  return { apagados };
}
