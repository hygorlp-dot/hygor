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
//   - um livro por vez (trava consultiva de sessão COM PRAZO, obterTrava):
//     execuções concorrentes se serializam e nenhuma espera para sempre;
//   - a versão nova precisa fechar íntegra (verificarIntegridadeFiscal) NA
//     MESMA transação, senão é desfeita; verificarGate decide o deploy
//     (GO / NO-GO / INTERVENCAO_HUMANA);
//   - modo "planejar" não muda nada (nem cria o livro).
//
// O adaptador (db) tem: query(texto, params) -> linhas; exec(texto) para SQL
// com vários comandos; transacao(fn). Ver adaptadores.mjs.
import { createHash } from "node:crypto";
import { OBJETOS, validarMigracao, verificarIntegridadeFiscal } from "./validacao.mjs";

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

// ---------------------------------------------------------------- trava com prazo
// pg_advisory_lock espera para sempre. Aqui: pg_try_advisory_lock em laço
// até o prazo, depois erro explícito. Trava de SESSÃO: se a conexão cair, o
// Postgres solta sozinho (não fica presa); liberarTrava nunca lança.
export const TRAVA_PADRAO = { timeoutMs: 60_000, intervaloMs: 250 };
export async function obterTrava(db, { timeoutMs = TRAVA_PADRAO.timeoutMs, intervaloMs = TRAVA_PADRAO.intervaloMs, registrar = () => {} } = {}) {
  const inicio = Date.now();
  for (let tentativa = 1; ; tentativa += 1) {
    const [l] = await db.query("select pg_try_advisory_lock(hashtextextended($1, 0)) as ok", [CHAVE_TRAVA]);
    if (l.ok) { registrar({ etapa: "trava_obtida", ms: Date.now() - inicio, tentativas: tentativa }); return; }
    if (Date.now() - inicio >= timeoutMs) {
      registrar({ etapa: "trava_expirou", ms: Date.now() - inicio, tentativas: tentativa });
      throw new ErroLivro(`trava do livro de migrations não obtida em ${Math.round(timeoutMs / 1000)} s: outra execução (deploy ou CLI) está em andamento. Nada foi alterado; tente de novo depois.`, { codigo: "TRAVA_EXPIROU" });
    }
    await new Promise(r => setTimeout(r, intervaloMs));
  }
}
// A trava consultiva é REENTRANTE na mesma sessão (obter 2x exige soltar 2x):
// solta até o Postgres dizer que não há mais nenhuma camada.
export async function liberarTrava(db, registrar = () => {}) {
  try {
    for (let i = 0; i < 16; i += 1) {
      const [l] = await db.query("select pg_advisory_unlock(hashtextextended($1, 0)) as ok", [CHAVE_TRAVA]);
      if (!l.ok) break;
    }
    registrar({ etapa: "trava_liberada" });
  }
  catch (e) { registrar({ etapa: "trava_liberada_pela_desconexao", erro: String(e.message || e).slice(0, 120) }); }
}

const versaoDoArquivo = arquivo => arquivo.slice(0, 3);

// Executa o plano. origem: quem/onde (ex.: "deploy:vercel", "manual:fulano").
// registrar(evento): observabilidade sem dado sensível ({ etapa, arquivo, acao, ms }).
//
// ATOMICIDADE: o plano é feito ANTES de qualquer escrita. Os passos
// pendentes viram lotes: migrations já existentes consecutivas
// (registrar_existente) entram num lote só; cada "aplicar" é um lote. Se o
// livro ainda não existe, a criação dele vai no PRIMEIRO lote. Cada lote
// termina conferindo a integridade fiscal da versão a que chega; se não
// fechar, o lote inteiro é desfeito. Assim, uma recusa ou queda na
// implantação nunca deixa um livro vazio ou pela metade (que travaria o
// deploy: o gate exige um histórico completo).
export async function aplicar({ db, manifesto, lerArquivo, origem, limites = LIMITES_PADRAO, trava = TRAVA_PADRAO, registrar = () => {}, agora = () => Date.now() }) {
  if (!/^\d+(ms|s|min)$/.test(limites.lockTimeout) || !/^\d+(ms|s|min)$/.test(limites.statementTimeout)) throw new ErroLivro("limites de tempo inválidos");
  await obterTrava(db, { ...trava, registrar });
  try {
    const plano = await planejar({ db, manifesto, lerArquivo });
    const feitos = [], lotes = [];
    for (const passo of plano.passos) {
      if (passo.acao === "ja_aplicada") { feitos.push(passo); registrar({ etapa: "migration", arquivo: passo.arquivo, acao: passo.acao }); continue; }
      const ultimo = lotes.at(-1);
      if (passo.acao === "registrar_existente" && ultimo?.[0].acao === "registrar_existente") ultimo.push(passo);
      else lotes.push([passo]);
    }
    let criarLivro = !plano.livroExiste;
    for (const lote of lotes) {
      const inicio = agora();
      await db.transacao(async () => {
        await db.exec(`set local lock_timeout = '${limites.lockTimeout}'; set local statement_timeout = '${limites.statementTimeout}';`);
        if (criarLivro) await db.exec(DDL_LIVRO);
        for (const passo of lote) {
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
        }
        // A versão a que o lote chega precisa fechar íntegra NA MESMA transação; senão, desfaz tudo (inclusive o livro recém-criado).
        const alvo = lote.at(-1).arquivo;
        const violacoes = await verificarIntegridadeFiscal(db, versaoDoArquivo(alvo));
        if (violacoes.length) {
          throw new ErroLivro(`${lote.map(p => p.arquivo).join(", ")}: integridade fiscal da versão ${versaoDoArquivo(alvo)} não confere (${violacoes.join("; ")}) - nada foi gravado`, { violacoes });
        }
      });
      criarLivro = false;
      for (const passo of lote) { registrar({ etapa: "migration", arquivo: passo.arquivo, acao: passo.acao, ms: Math.round(agora() - inicio) }); feitos.push(passo); }
    }
    return { passos: feitos };
  } finally {
    await liberarTrava(db, registrar);
  }
}

// ---------------------------------------------------------------- gate de deploy
// Só LÊ. Resultado:
//   GO                 - livro íntegro e versão fiscal conferida (ou: sem livro e sem 019 = comportamento anterior)
//   NO-GO              - deriva comprovada: arquivo aplicado mudou, objeto registrado sumiu ou foi trocado,
//                        trigger ausente/desabilitado, permissão ampliada, função da 019 substituída
//   INTERVENCAO_HUMANA - estado que a ferramenta não deve interpretar: histórico com lacuna, migration
//                        desconhecida no livro, migration presente sem registro, 019 sem livro
// Nunca corrige nada. acao: "seguir" (sem livro: script antigo reaplica 016-018), "pular" (GO com livro:
// nada a reaplicar), "bloquear" (o deploy falha; a versão anterior continua no ar).
export async function verificarGate(db, { lerArquivo }) {
  const conhecidas = Object.keys(OBJETOS);
  if (!(await livroExiste(db))) {
    const v019 = await validarMigracao(db, "019_ponto_integridade_fiscal.up.sql");
    if (v019.presentes.length > 0) {
      return { resultado: "INTERVENCAO_HUMANA", acao: "bloquear", versaoFiscal: null, motivos: ["a migration 019 está no banco sem livro de migrations: reaplicar 016/017 sobrescreveria as funções dela. Implante o livro (docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md)."] };
    }
    return { resultado: "GO", acao: "seguir", versaoFiscal: null, motivos: ["sem livro e sem 019: comportamento anterior (reaplicar 016-018)"] };
  }
  const intervencao = [], nogo = [];
  const linhas = await db.query(`select arquivo, sha256 from public.${TABELA_LIVRO} order by arquivo`);
  const registradas = linhas.map(l => l.arquivo);
  const conhecidasRegistradas = registradas.filter(a => conhecidas.includes(a));
  for (const a of registradas.filter(a => !conhecidas.includes(a))) intervencao.push(`migration desconhecida no livro: ${a}`);
  if (!registradas.length) intervencao.push("livro existe mas está vazio");
  if (conhecidasRegistradas.some((a, i) => a !== conhecidas[i])) {
    intervencao.push(`histórico incompleto: registradas ${registradas.join(", ")} (esperado em ordem a partir de ${conhecidas[0]})`);
  }
  for (const l of linhas.filter(x => conhecidas.includes(x.arquivo))) {
    let conteudo = null;
    try { conteudo = await lerArquivo(l.arquivo); } catch { intervencao.push(`${l.arquivo}: arquivo da migration ausente neste deploy`); continue; }
    if (sha256Migracao(conteudo) !== l.sha256) nogo.push(`${l.arquivo}: o arquivo mudou depois de aplicado (SHA-256 diferente do livro)`);
    const v = await validarMigracao(db, l.arquivo);
    if (!v.completa) nogo.push(`${l.arquivo}: registrada, mas o banco não confere (faltando: ${v.faltando.join(", ")})`);
  }
  for (const a of conhecidas.filter(a => !registradas.includes(a))) {
    const v = await validarMigracao(db, a);
    if (v.presentes.length > 0) intervencao.push(`${a}: objetos presentes no banco sem registro no livro`);
  }
  const versaoFiscal = conhecidasRegistradas.map(versaoDoArquivo).sort().at(-1) || null;
  if (versaoFiscal) for (const v of await verificarIntegridadeFiscal(db, versaoFiscal)) nogo.push(v);
  if (intervencao.length) return { resultado: "INTERVENCAO_HUMANA", acao: "bloquear", versaoFiscal, motivos: [...intervencao, ...nogo] };
  if (nogo.length) return { resultado: "NO-GO", acao: "bloquear", versaoFiscal, motivos: nogo };
  return { resultado: "GO", acao: "pular", versaoFiscal, motivos: [`livro íntegro; versão fiscal ${versaoFiscal} conferida (objetos, triggers, permissões e funções)`] };
}

// Para o script ANTIGO (apply-ponto-eletronico.mjs), antes de reaplicar 016-018.
export const guardaScriptAntigo = (db, opcoes) => verificarGate(db, opcoes);
