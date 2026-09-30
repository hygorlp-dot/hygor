// Códigos que a Curva ABC pede à base analítica (composition-details).
//
// Bug real (30/09/2026, BA1-15): SINAPI 89408/94965 e ORSE 12943/12719 saíam
// em "composições sem documentação analítica" embora a base tivesse o
// analítico das quatro. Elas não são linhas do orçamento: são sub-composições
// das composições próprias ARCD001 (banheiro provisório) e ARCD003 (muro).
// Só os códigos das linhas eram enviados, então a base nunca era consultada
// para elas. Agora entram também as sub-composições (tipo COMPOSICAO) das
// composições próprias usadas no orçamento - o servidor já desce os níveis
// seguintes sozinho.
const FONTES_SEM_BASE = /^(EXTERNO|COTA[CÇ][AÃ]O|PR[ÓO]PRIA)$/;

export function entradasParaDetalheAnalitico(itens, composicoesProprias, normalizar = v => String(v ?? "").trim()) {
  const entradas = new Map();
  const adicionar = (codigo, fonte) => {
    const cod = normalizar(codigo);
    const fon = String(fonte || "").toUpperCase();
    if (!cod || FONTES_SEM_BASE.test(fon)) return;
    const chave = `${fon}|${cod}`;
    if (!entradas.has(chave)) entradas.set(chave, { codigo: cod, fonte: fonte || "" });
  };
  const linhas = (itens || []).filter(item => item?.tipo !== "titulo");
  linhas.forEach(item => adicionar(item.codigo, item.fonte));

  const propriasUsadas = new Set(linhas
    .filter(item => /^PR[ÓO]PRIA$/i.test(String(item.fonte || "")))
    .map(item => normalizar(item.codigo)));
  (composicoesProprias || [])
    .filter(comp => propriasUsadas.has(normalizar(comp?.codigo)))
    .forEach(comp => (comp.itens || [])
      .filter(sub => String(sub?.tipoItem || "").toUpperCase() === "COMPOSICAO")
      .forEach(sub => adicionar(sub.codigo, sub.fonte || "SINAPI")));
  return [...entradas.values()];
}
