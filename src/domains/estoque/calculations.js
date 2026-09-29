export const TIPOS_MOV = [
  { v:"entrada",   l:"Entrada (compra)",       sinal:+1, cor:"#1E6B31" },
  { v:"consumo",   l:"Consumo (aplicado)",     sinal:-1, cor:"#0D47A1" },
  { v:"perda",     l:"Perda / quebra",         sinal:-1, cor:"#B71C1C" },
  { v:"devolucao", l:"Devolução ao fornecedor",sinal:+1, cor:"#6B6459" },
  { v:"ajuste",    l:"Ajuste de inventário",   sinal:+1, cor:"#C2185B" },
];

export const SINAL_MOV = Object.fromEntries(TIPOS_MOV.map(t => [t.v, t.sinal]));

const inactiveStatus = status => ["cancelado","cancelada","estornado","estornada"].includes(String(status||"").toLowerCase());

// Saldo por obra+material. NÃO é armazenado - é somado dos movimentos, para
// que todo saldo seja rastreável até sua origem.
export const calcSaldos = (movs) => {
  const m = {};
  (movs || []).filter(x=>!inactiveStatus(x?.status)).forEach(x => {
    const k = `${x.obraId}|${x.materialId}`;
    m[k] = (m[k] || 0) + (SINAL_MOV[x.tipo] ?? 0) * Number(x.qtd || 0);
  });
  return m;
};

export const saldoDe = (saldos, obraId, materialId) => saldos[`${obraId}|${materialId}`] || 0;

// "Executei 120 m de alvenaria" → quanto sai de cada insumo
export const baixarPorComposicao = (comp, qtdExecutada) =>
  (comp?.itens || [])
    .filter(i => i.materialId && i.coef > 0)
    .map(i => ({
      materialId: i.materialId,
      qtd: Number((i.coef * Number(qtdExecutada || 0)).toFixed(4)),
    }));

// ── Reposicao por estoque minimo ───────────────────────────────────
// Varre todas as obras ativas: material com minimo cadastrado e saldo abaixo
// dele vira uma linha de reposicao, com o deficit ja calculado. So considera
// obras onde o material JA circulou (teve movimento) - minimo global nao deve
// cobrar estoque de obra que nunca usou o item.
export const materiaisAbaixoMinimo = (data) => {
  const saldos = calcSaldos(data.movEstoque);
  const minimos = (data.materiais || []).filter(m => m.ativo !== false && Number(m.estoqueMin || 0) > 0);
  if (!minimos.length) return [];
  const obrasAtivas = (data.obras || []).filter(o => o.status !== "done");
  const movimentou = new Set((data.movEstoque || []).filter(x=>!['cancelado','cancelada','estornado','estornada'].includes(String(x?.status||'').toLowerCase())).map(x => `${x.obraId}|${x.materialId}`));
  const out = [];
  obrasAtivas.forEach(o => {
    minimos.forEach(m => {
      if (!movimentou.has(`${o.id}|${m.id}`)) return;
      const saldo = saldoDe(saldos, o.id, m.id);
      const minimo = Number(m.estoqueMin || 0);
      if (saldo >= minimo) return;
      out.push({
        obraId: o.id, obraNome: o.name,
        materialId: m.id, descricao: m.descricao, unidade: m.unidade || "un",
        saldo, minimo, deficit: Math.ceil((minimo - saldo) * 100) / 100,
      });
    });
  });
  return out.sort((a, b) => a.obraNome.localeCompare(b.obraNome) || a.descricao.localeCompare(b.descricao));
};

// Curva ABC pelo VALOR consumido (80/95 é o corte clássico)
export const calcCurvaABC = (movs, materiais) => {
  const val = {};
  (movs || []).filter(x => x.tipo === "consumo" && !['cancelado','cancelada','estornado','estornada'].includes(String(x?.status||'').toLowerCase())).forEach(x => {
    val[x.materialId] = (val[x.materialId] || 0) + Number(x.qtd||0) * Number(x.valorUnit||0);
  });
  const lista = Object.entries(val)
    .map(([id, v]) => ({
      id, valor: v,
      nome: (materiais || []).find(m => m.id === id)?.descricao || "-",
    }))
    .sort((a, b) => b.valor - a.valor);

  const total = lista.reduce((s, x) => s + x.valor, 0);
  let acum = 0;
  return lista.map(x => {
    acum += x.valor;
    const pct = total ? (acum / total) * 100 : 0;
    return { ...x, pctAcum: pct, classe: pct <= 80 ? "A" : pct <= 95 ? "B" : "C" };
  });
};

// Curva ABC por COMPOSICAO (servico executado).
//
// A curva de insumos acima nunca mostra composicao: executar "120 m2 de
// alvenaria" nao gera movimento de "alvenaria", gera consumo de cimento,
// areia e bloco. O servico se dissolve nos insumos. Aqui ele e remontado:
// todo consumo gerado por "Executar servico" carrega servicoId, entao basta
// agrupar por ele para saber quanto cada SERVICO custou de material.
// Consumo avulso (baixa manual, sem servico) ganha linha propria - se ficasse
// de fora, a curva mentiria sobre o total gasto.
export const calcCurvaABCServicos = (movs, composicoes) => {
  const val = {};
  (movs || []).filter(x => x.tipo === "consumo" && !['cancelado','cancelada','estornado','estornada'].includes(String(x?.status||'').toLowerCase())).forEach(x => {
    const k = x.servicoId || "__avulso__";
    if (!val[k]) val[k] = { valor: 0, execucoes: new Set() };
    val[k].valor += Number(x.qtd || 0) * Number(x.valorUnit || 0);
    if (x.servicoId) val[k].execucoes.add(`${x.data}|${x.descricao}`);
  });

  const lista = Object.entries(val)
    .map(([id, v]) => ({
      id, valor: v.valor, execucoes: v.execucoes.size,
      avulso: id === "__avulso__",
      nome: id === "__avulso__"
        ? "Consumo avulso (sem composicao)"
        : (composicoes || []).find(c => c.id === id)?.nome || "Composicao removida",
    }))
    .filter(x => x.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const total = lista.reduce((s, x) => s + x.valor, 0);
  let acum = 0;
  return lista.map(x => {
    acum += x.valor;
    const pct = total ? (acum / total) * 100 : 0;
    return { ...x, pctAcum: pct, classe: pct <= 80 ? "A" : pct <= 95 ? "B" : "C" };
  });
};
