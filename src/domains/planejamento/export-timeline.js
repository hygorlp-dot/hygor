import { somaDias } from "./legacy-engine.js";

// Régua da exportação A2 (30/09/2026, pedido do usuário: "o cronograma não
// está saindo as datas"). A folha tinha só 9 marcas equidistantes em 5 pt,
// sem ano e com a primeira cortada pela borda. Obra atravessa o ano (set/26 a
// jul/27), então a régua passa a ser por mês, sempre com o ano, e cada
// data da tabela sai com o ano também.
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Faixas mensais da janela [inicioIso, inicioIso + totalDias - 1]:
// { rotulo:"set/26", inicio:<offset em dias>, dias:<duração na janela> }.
export const faixasMensais = (inicioIso, totalDias) => {
  const faixas = [];
  const total = Math.max(0, Math.floor(Number(totalDias) || 0));
  if (!inicioIso || !total) return faixas;
  for (let off = 0; off < total; off++) {
    const chave = somaDias(inicioIso, off).slice(0, 7);
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.chave === chave) { ultima.dias += 1; continue; }
    const [ano, mes] = chave.split("-");
    faixas.push({ chave, rotulo: `${MESES[Number(mes) - 1]}/${ano.slice(2)}`, inicio: off, dias: 1 });
  }
  return faixas.map(({ chave, ...faixa }) => faixa);
};

// "2026-10-15" -> "15/10/26": curto para caber na coluna, mas com o ano.
export const dataCurtaComAno = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : "-";
};
