export const BDI_TCU = Object.freeze([
  { v:"edificios", l:"Construção de edifícios", q1:20.34, med:22.12, q3:25 },
  { v:"rodovias", l:"Construção de rodovias e ferrovias", q1:19.60, med:20.97, q3:24.23 },
  { v:"saneamento", l:"Redes de água, esgoto e correlatas", q1:20.76, med:24.18, q3:26.44 },
  { v:"energia", l:"Estações e redes de distribuição de energia", q1:24, med:25.84, q3:27.86 },
  { v:"portuarias", l:"Obras portuárias, marítimas e fluviais", q1:22.80, med:27.48, q3:30.95 },
  { v:"fornecimento", l:"Fornecimento de materiais e equipamentos", q1:11.10, med:14.02, q3:16.80 },
]);

export const BDI_COMPONENTES_EDIF = Object.freeze({
  ac:{ q1:3, med:4, q3:5.5, l:"Administração Central" },
  seguro:{ q1:.8, med:.8, q3:1, l:"Seguro e Garantia" },
  risco:{ q1:.97, med:1.27, q3:1.27, l:"Risco" },
  df:{ q1:.59, med:1.23, q3:1.39, l:"Despesas Financeiras" },
  lucro:{ q1:6.16, med:7.4, q3:8.96, l:"Lucro" },
});

export function calculateBdi(parameters = {}) {
  const rate = key => Number(parameters[key] || 0) / 100;
  const direct = rate("ac") + rate("seguro") + rate("risco") + rate("garantia");
  const taxes = rate("pis") + rate("cofins") + rate("iss") + rate("cprb");
  if (taxes >= 1) return { bdi:0, tributos:taxes * 100, erro:"Tributos somam 100% ou mais." };
  const bdi = (((1 + direct) * (1 + rate("df")) * (1 + rate("lucro"))) / (1 - taxes) - 1) * 100;
  return { bdi, tributos:taxes * 100, erro:null };
}

export const formatBdiPercent = value => `${Number(value || 0).toFixed(2).replace(".", ",")}%`;

export function classifyBdi(bdi, type) {
  const range = BDI_TCU.find(item => item.v === type) || BDI_TCU[0];
  if (bdi < range.q1) return { st:"abaixo", cor:"#BF360C", faixa:range, msg:`Abaixo do 1º quartil (${range.q1}%). Exige justificativa - o TCU questiona BDI subestimado por indício de jogo de planilha.` };
  if (bdi > range.q3) return { st:"acima", cor:"#B71C1C", faixa:range, msg:`Acima do 3º quartil (${range.q3}%). Exige justificativa técnica expressa no processo.` };
  return { st:"dentro", cor:"#1E6B31", faixa:range, msg:`Dentro da faixa aceitável do TCU (${range.q1}% a ${range.q3}%).` };
}

