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
