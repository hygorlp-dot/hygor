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
import { projetoSupabase } from "../migracoes-ponto/locais.mjs";
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
  const gate = await verificarGate(db, { lerArquivo });
  if (gate.resultado !== "GO") throw new Error(`gate depois do provisionamento: ${gate.resultado} (${gate.motivos.join("; ")})`);
  return { livro: livro.passos.map(p => `${p.acao} ${p.arquivo}`), semente, gate: `${gate.resultado} ${gate.versaoFiscal}` };
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
    marcador: await marcadorDoBanco(db), comentario: await comentarioDoBanco(db), gate: `${gate.resultado} ${gate.versaoFiscal || "-"}`,
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
