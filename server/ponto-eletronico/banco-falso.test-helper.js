// Banco falso em memória com a mesma API encadeada do supabase-js usada em
// server/ponto-eletronico/handler.js - compartilhado pelos testes do servidor
// e pelo teste ponta a ponta do app (apps/ponto-obra).
export function bancoFalso() {
  // Tabelas da 017 existem vazias aqui: o fluxo formato 2 (ARP) é testado no
  // Postgres real (banco-pglite.test-helper.js); este banco cobre o legado.
  const tabelas = { ponto_dispositivos: [], ponto_pareamentos: [], ponto_marcacoes: [], ponto_biometrias: [], ponto_responsaveis: [],
    ponto_estabelecimentos: [], ponto_estabelecimento_obras: [], ponto_eventos: [], ponto_arp_registros: [], ponto_arp_contadores: [], ponto_tempo_verificacoes: [] };
  const arquivos = new Map();
  const consulta = tabela => {
    const filtros = [];
    let modo = "select", patch = null, novo = null, ordem = null, limite = null, retornar = false, conflito = null;
    const casa = linha => filtros.every(f => f(linha));
    const executar = () => {
      const linhas = tabelas[tabela];
      if (modo === "insert") { for (const r of [].concat(novo)) linhas.push({ ...r }); return { data: null, error: null }; }
      if (modo === "upsert") {
        const chaves = conflito.split(",");
        for (const r of [].concat(novo)) {
          const i = linhas.findIndex(l => chaves.every(k => l[k] === r[k]));
          if (i >= 0) linhas[i] = { ...linhas[i], ...r }; else linhas.push({ ...r });
        }
        return { data: null, error: null };
      }
      if (modo === "update") {
        const alvo = linhas.filter(casa); alvo.forEach(l => Object.assign(l, patch));
        return { data: retornar ? alvo.map(l => ({ ...l })) : null, error: null };
      }
      if (modo === "delete") { tabelas[tabela] = linhas.filter(l => !casa(l)); return { data: null, error: null }; }
      let r = linhas.filter(casa).map(l => ({ ...l }));
      if (ordem) r.sort((a, b) => (a[ordem.k] < b[ordem.k] ? -1 : 1) * (ordem.asc ? 1 : -1));
      if (limite) r = r.slice(0, limite);
      return { data: r, error: null };
    };
    const b = {
      select() { if (modo !== "select") retornar = true; return b; },
      eq(k, v) { filtros.push(l => String(l[k]) === String(v)); return b; },
      gte(k, v) { filtros.push(l => String(l[k]) >= String(v)); return b; },
      lte(k, v) { filtros.push(l => String(l[k]) <= String(v)); return b; },
      is(k, v) { filtros.push(l => (l[k] ?? null) === v); return b; },
      in(k, lista) { filtros.push(l => lista.map(String).includes(String(l[k]))); return b; },
      order(k, o = {}) { ordem = { k, asc: o.ascending !== false }; return b; },
      limit(n) { limite = n; return b; },
      insert(r) { modo = "insert"; novo = r; return b; },
      update(p) { modo = "update"; patch = p; return b; },
      upsert(r, o) { modo = "upsert"; novo = r; conflito = o.onConflict; return b; },
      delete() { modo = "delete"; return b; },
      async maybeSingle() { const { data } = executar(); return { data: data?.[0] || null, error: null }; },
      then(ok, falha) { return Promise.resolve(executar()).then(ok, falha); },
    };
    return b;
  };
  return {
    tabelas, arquivos,
    from: consulta,
    async rpc(nome, p) {
      if (nome !== "ponto_registrar_marcacoes") throw new Error(`rpc inesperada: ${nome}`);
      const d = tabelas.ponto_dispositivos.find(x => x.id === p.p_dispositivo_id);
      let aceitas = 0;
      for (const m of p.p_marcacoes) {
        if (m.nsr <= d.ultimo_nsr) continue;
        tabelas.ponto_marcacoes.push({ company_id: p.p_company_id, id: m.id, dispositivo_id: d.id, obra_id: d.obra_id, nsr: m.nsr,
          tipo_registro: m.tipoRegistro || "ponto", employee_id: m.employeeId || null, terceiro_id: m.terceiroId || null, marcado_em: m.marcadoEm,
          hora_confiavel: m.horaConfiavel, relogio_alterado: !!m.relogioAlterado, metodo: m.metodo, confianca: m.confianca ?? null,
          encarregado_id: m.encarregadoId || null, gps: m.gps || null, foto_sha256: m.fotoSha256 || null, recebido_em: "agora" });
        d.ultimo_nsr = m.nsr; d.ultimo_hash = m.hash; aceitas++;
      }
      return { data: [{ aceitas, ultimo_nsr: d.ultimo_nsr, ultimo_hash: d.ultimo_hash, erro: null }], error: null };
    },
    storage: { from: () => ({
      async upload(caminho, buffer) { if (arquivos.has(caminho)) return { error: { message: "The resource already exists" } }; arquivos.set(caminho, buffer); return { error: null }; },
      async createSignedUrl(caminho) { return arquivos.has(caminho) ? { data: { signedUrl: `https://assinado/${caminho}` }, error: null } : { data: null, error: { message: "not found" } }; },
    }) },
  };
}

