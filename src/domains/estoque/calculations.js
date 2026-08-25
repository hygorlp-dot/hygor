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
