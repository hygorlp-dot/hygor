// LIVRO DE MIGRATIONS do Ponto de Obra (docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md).
//
// Substitui a reaplicação de 016-018 a cada deploy
// (scripts/apply-ponto-eletronico.mjs) por: cada arquivo do manifesto é
// aplicado UMA vez, numa transação com lock_timeout/statement_timeout, e
// fica registrado com o SHA-256 em public.ponto_migracoes_aplicadas.
//
// Regras:
//   - arquivo diferente do SHA-256 do manifesto: recusa (ninguém edita
//     migration aplicada; correção é migration nova);
//   - arquivo já no livro com outro SHA-256: recusa;
//   - migration aplicada antes do livro (016-018 em produção): só é
//     REGISTRADA (sem executar) se a validação de objetos for completa;
//   - estado parcial (parte dos objetos existe): recusa - exige pessoa;
//   - NUNCA executa uma migration se alguma POSTERIOR do manifesto já
//     estiver presente no banco (ex.: 017 por cima da 019 reescreveria a
//     ARP com a versão antiga): recusa;
//   - um livro por vez (pg_advisory_lock de sessão): deploys concorrentes
//     esperam um pelo outro;
//   - modo "planejar" não muda nada (nem cria o livro).
//
// O adaptador (db) tem: query(texto, params) -> linhas; exec(texto) para SQL
// com vários comandos; transacao(fn). Ver adaptadores.mjs.
import { createHash } from "node:crypto";
import { validarMigracao } from "./validacao.mjs";

export const TABELA_LIVRO = "ponto_migracoes_aplicadas";
export const CHAVE_TRAVA = "arcd:ponto:migracoes";
export const LIMITES_PADRAO = { lockTimeout: "5s", statementTimeout: "120s" };

// LF sempre (o repositório já guarda LF; isto só protege de checkout CRLF).
export const sha256Migracao = conteudo => createHash("sha256").update(String(conteudo).replace(/\r\n/g, "\n"), "utf8").digest("hex");

const DDL_LIVRO = `
create table if not exists public.${TABELA_LIVRO} (
  arquivo      text        primary key,
  sha256       text        not null check (sha256 ~ '^[0-9a-f]{64}$'),
  modo         text        not null check (modo in ('aplicada','registrada_existente')),
  aplicada_em  timestamptz not null default now(),
  origem       text        not null,
  duracao_ms   integer,
  validacao    jsonb       not null default '{}'::jsonb
);
alter table public.${TABELA_LIVRO} enable row level security;
create or replace function public.ponto_migracoes_imutavel() returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp as $$
begin raise exception 'ponto_migracoes_aplicadas é append-only: o histórico de migrations não muda'; end $$;
drop trigger if exists ponto_migracoes_no_update on public.${TABELA_LIVRO};
drop trigger if exists ponto_migracoes_no_delete on public.${TABELA_LIVRO};
drop trigger if exists ponto_migracoes_no_truncate on public.${TABELA_LIVRO};
create trigger ponto_migracoes_no_update before update on public.${TABELA_LIVRO} for each row execute function public.ponto_migracoes_imutavel();
create trigger ponto_migracoes_no_delete before delete on public.${TABELA_LIVRO} for each row execute function public.ponto_migracoes_imutavel();
create trigger ponto_migracoes_no_truncate before truncate on public.${TABELA_LIVRO} for each statement execute function public.ponto_migracoes_imutavel();
do $$
declare papel text;
begin
  revoke all on table public.${TABELA_LIVRO} from public;
  foreach papel in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on table public.${TABELA_LIVRO} from %I', papel);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.${TABELA_LIVRO} from service_role';
    execute 'grant select on table public.${TABELA_LIVRO} to service_role';
  end if;
end $$;`;

export class ErroLivro extends Error {
  constructor(mensagem, detalhe = {}) { super(mensagem); this.name = "ErroLivro"; this.detalhe = detalhe; }
}

async function livroExiste(db) {
  const [l] = await db.query(`select to_regclass('public.${TABELA_LIVRO}') is not null as existe`);
  return !!l?.existe;
}

// Plano sem efeito colateral. manifesto: [{ arquivo, sha256 }] em ordem.
// lerArquivo(arquivo) -> conteúdo.
export async function planejar({ db, manifesto, lerArquivo }) {
  const existe = await livroExiste(db);
  const registrados = new Map(existe ? (await db.query(`select arquivo, sha256, modo from public.${TABELA_LIVRO}`)).map(l => [l.arquivo, l]) : []);
  const validacoes = [];
  for (const item of manifesto) validacoes.push(await validarMigracao(db, item.arquivo));
  const passos = [];
  for (let i = 0; i < manifesto.length; i += 1) {
    const { arquivo, sha256: esperado } = manifesto[i];
    const conteudo = await lerArquivo(arquivo);
    const sha = sha256Migracao(conteudo);
    if (!/^[0-9a-f]{64}$/.test(String(esperado || ""))) throw new ErroLivro(`${arquivo}: manifesto sem SHA-256`);
    if (sha !== esperado) throw new ErroLivro(`${arquivo}: o arquivo mudou (SHA-256 ${sha}) e não confere com o manifesto (${esperado}). Migration aplicada não se edita; correção é migration nova.`, { arquivo, sha, esperado });
    const reg = registrados.get(arquivo);
    if (reg) {
      if (reg.sha256 !== sha) throw new ErroLivro(`${arquivo}: já aplicada com outro conteúdo (livro ${reg.sha256}, arquivo ${sha})`, { arquivo });
      // Deriva: registrada, mas os objetos não batem (reversão manual ou
      // migration antiga reaplicada por fora do livro). Exige pessoa.
      if (!validacoes[i].completa) throw new ErroLivro(`${arquivo}: registrada no livro, mas o banco não confere (faltando: ${validacoes[i].faltando.join(", ")}). Reversão manual ou deriva - exige análise.`, { arquivo, validacao: validacoes[i] });
      passos.push({ arquivo, sha256: sha, acao: "ja_aplicada" });
      continue;
    }
    const v = validacoes[i];
    if (!v.conhecida) throw new ErroLivro(`${arquivo}: sem validação de objetos cadastrada (scripts/migracoes-ponto/validacao.mjs)`);
    if (v.completa) { passos.push({ arquivo, sha256: sha, acao: "registrar_existente", validacao: v }); continue; }
    if (v.parcial) throw new ErroLivro(`${arquivo}: estado PARCIAL no banco (faltando: ${v.faltando.join(", ")}). Não aplico nem registro: exige análise.`, { arquivo, validacao: v });
    // Vai executar: nada posterior pode estar presente (nem parcialmente).
    const posterior = manifesto.slice(i + 1).map((m, k) => ({ m, v: validacoes[i + 1 + k] })).find(x => x.v.presentes.length > 0 || registrados.has(x.m.arquivo));
    if (posterior) throw new ErroLivro(`${arquivo}: não executo - ${posterior.m.arquivo} (posterior) já está no banco; aplicar esta reescreveria objetos dela.`, { arquivo, posterior: posterior.m.arquivo });
    passos.push({ arquivo, sha256: sha, acao: "aplicar" });
  }
  return { livroExiste: existe, passos };
}

// Executa o plano. origem: quem/onde (ex.: "deploy:vercel", "manual:fulano").
export async function aplicar({ db, manifesto, lerArquivo, origem, limites = LIMITES_PADRAO, agora = () => Date.now() }) {
  if (!/^\d+(ms|s|min)$/.test(limites.lockTimeout) || !/^\d+(ms|s|min)$/.test(limites.statementTimeout)) throw new ErroLivro("limites de tempo inválidos");
  await db.query(`select pg_advisory_lock(hashtextextended($1, 0))`, [CHAVE_TRAVA]);
  try {
    if (!(await livroExiste(db))) await db.transacao(async () => { await db.exec(DDL_LIVRO); });
    const plano = await planejar({ db, manifesto, lerArquivo });
    const feitos = [];
    for (const passo of plano.passos) {
      if (passo.acao === "ja_aplicada") { feitos.push(passo); continue; }
      const inicio = agora();
      await db.transacao(async () => {
        await db.exec(`set local lock_timeout = '${limites.lockTimeout}'; set local statement_timeout = '${limites.statementTimeout}';`);
        if (passo.acao === "aplicar") {
          await db.exec(await lerArquivo(passo.arquivo));
          const depois = await validarMigracao(db, passo.arquivo);
          if (!depois.completa) throw new ErroLivro(`${passo.arquivo}: aplicada mas a validação falhou (faltando: ${depois.faltando.join(", ")}) - desfeita`);
          passo.validacao = depois;
        }
        await db.query(
          `insert into public.${TABELA_LIVRO}(arquivo, sha256, modo, origem, duracao_ms, validacao) values ($1, $2, $3, $4, $5, $6::text::jsonb)`,
          [passo.arquivo, passo.sha256, passo.acao === "aplicar" ? "aplicada" : "registrada_existente", origem, Math.round(agora() - inicio),
            JSON.stringify({ presentes: passo.validacao?.presentes?.length ?? 0, faltando: passo.validacao?.faltando ?? [] })]);
      });
      feitos.push(passo);
    }
    return { passos: feitos };
  } finally {
    await db.query(`select pg_advisory_unlock(hashtextextended($1, 0))`, [CHAVE_TRAVA]);
  }
}

// Para o script ANTIGO (apply-ponto-eletronico.mjs), antes de reaplicar
// 016-018: com o livro ativo ele não reaplica nada; com a 019 no banco e sem
// livro, reaplicar 016/017 sobrescreveria as funções da 019 - bloqueia
// (o deploy falha e a versão anterior continua no ar).
export async function guardaScriptAntigo(db) {
  if (await livroExiste(db)) return { acao: "pular", motivo: "livro de migrations ativo (ponto_migracoes_aplicadas): o script antigo não reaplica 016-018" };
  const v019 = await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql");
  if (v019.presentes.length > 0) {
    return { acao: "bloquear", motivo: "a migration 019 está no banco e não há livro de migrations: reaplicar 016/017 sobrescreveria as funções da 019. Implante o livro (docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md)." };
  }
  return { acao: "seguir", motivo: "sem livro e sem 019: comportamento anterior (reaplicar 016-018)" };
}
