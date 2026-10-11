// Objetos que comprovam cada migration do Ponto de Obra no banco. Usado pelo
// livro de migrations (livro.mjs) para:
//   - registrar como "já existente" uma migration aplicada antes do livro
//     (só se TODOS os objetos existem - validação completa);
//   - recusar estado parcial (alguns objetos sim, outros não: exige pessoa);
//   - conferir depois de aplicar.
// Mesmas verificações que scripts/apply-ponto-eletronico.mjs fazia depois de
// cada deploy, mais a 019. `marcadores`: trecho que só existe no corpo da
// função na versão daquela migration (detecta 017 recriada por cima da 019).

export const OBJETOS = {
  "016_create_ponto_eletronico.up.sql": {
    tabelasComRls: ["ponto_dispositivos", "ponto_pareamentos", "ponto_marcacoes", "ponto_biometrias", "ponto_responsaveis"],
    funcoes: ["ponto_registrar_marcacoes"],
    triggers: ["ponto_marcacoes_no_update", "ponto_marcacoes_no_delete"],
  },
  "017_ponto_arp_estabelecimento_nsr.up.sql": {
    tabelasComRls: ["ponto_estabelecimentos", "ponto_estabelecimento_obras", "ponto_eventos", "ponto_arp_contadores", "ponto_arp_registros", "ponto_tempo_verificacoes"],
    funcoes: ["ponto_arp_registrar", "ponto_arp_texto_fiscal", "ponto_arp_imutavel", "ponto_dispositivo_protegido"],
    triggers: ["ponto_eventos_no_update", "ponto_eventos_no_delete", "ponto_eventos_so_arp", "ponto_arp_registros_no_update",
      "ponto_arp_registros_no_delete", "ponto_arp_registros_so_arp", "ponto_arp_contadores_protegido"],
  },
  "018_ponto_apropriacoes.up.sql": {
    tabelasComRls: ["ponto_apropriacoes", "ponto_apropriacoes_auditoria"],
    funcoes: ["ponto_apropriacao_salvar", "ponto_apropriacao_cancelar"],
    triggers: ["ponto_apropriacoes_so_funcao", "ponto_aprop_auditoria_no_update", "ponto_aprop_auditoria_no_delete"],
  },
  "019_ponto_integridade_fiscal.up.sql": {
    tabelasComRls: ["ponto_estabelecimentos_auditoria"],
    funcoes: ["ponto_estabelecimento_protegido", "ponto_estabelecimento_auditar", "ponto_estab_nsr_emitidos"],
    triggers: ["ponto_estabelecimentos_protegido", "ponto_estabelecimentos_auditar", "ponto_marcacoes_no_truncate",
      "ponto_estabelecimentos_auditoria_no_update", "ponto_estabelecimentos_auditoria_no_delete"],
    // Corpo da versão 019 (se a 017/016 forem reaplicadas por cima, somem).
    marcadores: [["ponto_arp_registrar", "fonteGravacao"], ["ponto_registrar_marcacoes", "v_formato2"], ["ponto_dispositivo_protegido", "ponto.legado_ingresso"]],
  },
};

// db.query(texto, params) -> linhas. Devolve { completa, parcial, faltando, presentes }.
export async function validarMigracao(db, arquivo) {
  const o = OBJETOS[arquivo];
  if (!o) return { completa: false, parcial: false, faltando: [`sem validação para ${arquivo}`], presentes: [], conhecida: false };
  const faltando = [], presentes = [];
  const tabelas = await db.query(
    `select c.relname as nome, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1::text[])`, [o.tabelasComRls]);
  for (const t of o.tabelasComRls) {
    const l = tabelas.find(x => x.nome === t);
    if (!l) faltando.push(`tabela ${t}`);
    else if (!l.rls) { presentes.push(`tabela ${t}`); faltando.push(`RLS em ${t}`); }
    else presentes.push(`tabela ${t}`);
  }
  const funcoes = await db.query(
    `select p.proname as nome, p.prosrc as corpo from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])`, [[...o.funcoes, ...(o.marcadores || []).map(m => m[0])]]);
  for (const f of o.funcoes) (funcoes.some(x => x.nome === f) ? presentes : faltando).push(`função ${f}`);
  const triggers = await db.query(`select tgname as nome from pg_trigger where not tgisinternal and tgname = any($1::text[])`, [o.triggers]);
  for (const t of o.triggers) (triggers.some(x => x.nome === t) ? presentes : faltando).push(`trigger ${t}`);
  for (const [f, trecho] of o.marcadores || []) {
    (funcoes.some(x => x.nome === f && String(x.corpo).includes(trecho)) ? presentes : faltando).push(`corpo de ${f} na versão desta migration`);
  }
  return { completa: faltando.length === 0, parcial: faltando.length > 0 && presentes.length > 0, faltando, presentes, conhecida: true };
}

// ---------------------------------------------------------------- integridade fiscal (gate de deploy)
// Só LÊ o catálogo. versao = última migration registrada no livro ("016".."019").
// Devolve a lista de violações (vazia = íntegro). Regras por versão:
//   >= 017: RLS em todas as tabelas registradas; triggers obrigatórios
//           presentes e HABILITADOS; tabelas fiscais sem escrita direta
//           para a service_role; nada para anon/authenticated; funções da
//           ARP security definer e sem EXECUTE para anon/authenticated.
//   >= 019: sem TRUNCATE para a service_role em nenhuma tabela do ponto;
//           legado e auditoria do estabelecimento só leitura; search_path
//           endurecido nas funções security definer; corpo da versão 019.
const ESCRITA = ["INSERT", "UPDATE", "DELETE", "TRUNCATE"];
const PROIBIDOS_SERVICE_ROLE = {
  "017": { ponto_eventos: ESCRITA, ponto_arp_registros: ESCRITA, ponto_arp_contadores: ESCRITA, ponto_tempo_verificacoes: ["UPDATE", "DELETE", "TRUNCATE"] },
  "018": { ponto_apropriacoes: ESCRITA, ponto_apropriacoes_auditoria: ESCRITA },
  "019": { ponto_marcacoes: ESCRITA, ponto_dispositivos: ["DELETE", "TRUNCATE"], ponto_estabelecimentos_auditoria: ESCRITA },
};
const FUNCOES_PROTEGIDAS = {
  "016": ["ponto_registrar_marcacoes"],
  "017": ["ponto_arp_registrar"],
  "018": ["ponto_apropriacao_salvar", "ponto_apropriacao_cancelar"],
};
const SEARCH_PATH_019 = "search_path=pg_catalog, public, pg_temp";
const versaoDe = arquivo => arquivo.slice(0, 3);

export async function verificarIntegridadeFiscal(db, versao) {
  const violacoes = [];
  const migracoes = Object.keys(OBJETOS).filter(a => versaoDe(a) <= versao);
  const tabelas = [...new Set(migracoes.flatMap(a => OBJETOS[a].tabelasComRls))];
  const triggers = [...new Set(migracoes.flatMap(a => OBJETOS[a].triggers))];
  for (const t of await db.query(`select c.relname as nome, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any($1::text[])`, [tabelas])) if (!t.rls) violacoes.push(`RLS desligado em ${t.nome}`);
  const trg = await db.query(`select tgname as nome, tgenabled::text as estado from pg_trigger where not tgisinternal and tgname = any($1::text[])`, [triggers]);
  for (const t of triggers) {
    const l = trg.find(x => x.nome === t);
    if (!l) violacoes.push(`trigger ${t} ausente`);
    else if (!["O", "A"].includes(l.estado)) violacoes.push(`trigger ${t} desabilitado (${l.estado})`);
  }
  // Privilégios: só olha papéis que existem (PGlite/Supabase).
  const papeis = new Set((await db.query(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role')`)).map(r => r.rolname));
  const proibidos = {};
  for (const [v, mapa] of Object.entries(PROIBIDOS_SERVICE_ROLE)) if (v <= versao) for (const [t, ps] of Object.entries(mapa)) proibidos[t] = [...new Set([...(proibidos[t] || []), ...ps])];
  if (versao >= "019") for (const t of tabelas) proibidos[t] = [...new Set([...(proibidos[t] || []), "TRUNCATE"])];
  if (papeis.has("service_role")) {
    for (const [t, ps] of Object.entries(proibidos)) {
      if (!tabelas.includes(t)) continue;
      for (const p of ps) {
        const [l] = await db.query(`select has_table_privilege('service_role', $1, $2) as tem`, [`public.${t}`, p]);
        if (l.tem) violacoes.push(`service_role com ${p} em ${t}`);
      }
    }
  }
  for (const papel of ["anon", "authenticated"].filter(p => papeis.has(p))) {
    for (const t of tabelas) {
      for (const p of ["SELECT", ...ESCRITA]) {
        const [l] = await db.query(`select has_table_privilege($1, $2, $3) as tem`, [papel, `public.${t}`, p]);
        if (l.tem) violacoes.push(`${papel} com ${p} em ${t}`);
      }
    }
  }
  const funcs = Object.entries(FUNCOES_PROTEGIDAS).filter(([v]) => v <= versao).flatMap(([, fs]) => fs);
  for (const f of await db.query(`select p.oid::regprocedure::text as assinatura, p.proname as nome, p.prosecdef as definer,
      coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])`, [funcs])) {
    if (!f.definer) violacoes.push(`função ${f.nome} deixou de ser security definer`);
    if (versao >= "019" && f.config !== SEARCH_PATH_019) violacoes.push(`função ${f.nome} sem o search_path endurecido da 019`);
    for (const papel of ["anon", "authenticated"].filter(p => papeis.has(p))) {
      const [l] = await db.query(`select has_function_privilege($1, $2, 'execute') as tem`, [papel, f.assinatura]);
      if (l.tem) violacoes.push(`${papel} pode executar ${f.nome}`);
    }
  }
  return violacoes;
}
