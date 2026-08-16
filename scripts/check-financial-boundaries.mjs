import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/LegacyApp.jsx", import.meta.url), "utf8");
// MedicoesView foi extraída de LegacyApp.jsx para seu próprio arquivo em
// 2026-08-16 (ver docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #8) - a
// tela canônica agora mora lá, não em `source`.
const medicoesSource = await readFile(new URL("../src/domains/medicoes/components/MedicoesView.jsx", import.meta.url), "utf8");
const section = (startToken, endToken) => {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error(`Fronteira não localizada: ${startToken}`);
  return source.slice(start, end);
};
const financialScreen = section("function Financeiro({", "function ClienteContratualModal(");
const canonicalScreens = [
  ["FinanceiroObraPainel", section("function FinanceiroObraPainel(", "function DRE(")],
  ["DRELegado", section("function DRELegado(", "function ModoIADocumento(")],
  ["MedicoesView", medicoesSource],
  ["FinanceiroAdministrativo", section("function FinanceiroAdministrativo(", "function RankingFinanceiro(")],
];
const violations = [
  ["cálculo direto de mão de obra", /\bcalcObraLaborCost\s*\(/],
  ["cálculo direto de terceiros", /\bcalcObraTercCost\s*\(/],
  ["cálculo direto de compras", /\bcalcObraComprasCost\s*\(/],
  [
    "agregação monetária sobre coleção operacional",
    /\(data\.(payments|medicoes|notasFiscais|pedidos|pagsTerceiros|medicoesTerc|outrasDesp|despesasEmpresa|transacoes|caixaObra)\s*\|\|\s*\[\]\)[\s\S]{0,160}\.reduce\s*\(/,
  ],
].filter(([, pattern]) => pattern.test(financialScreen));

if (!/\bcalcVisaoFinanceira\s*\(/.test(financialScreen)) {
  violations.push(["tela sem o adaptador financeiro canônico", /./]);
}
canonicalScreens.forEach(([name, screen]) => {
  if (/\bcalcObra(ComprasCost|TercCost|TercEmpresaCost|MaterialCost|LaborCost)\s*\(/.test(screen)) {
    violations.push([`${name} chamou cálculo financeiro legado`, /./]);
  }
});
[
  ["ranking financeiro voltou para a UI", /\bfunction\s+calcularRankingFinanceiro\s*\(/],
  ["posição de notas voltou para a UI", /\bconst\s+(totalPagoNota|saldoPagamentoNota|statusPagamentoNota)\s*=/],
  ["resumo de conciliação voltou para a UI", /\bconst\s+calcConciliacao\s*=/],
  ["relatório financeiro mensal voltou para a UI", /\bconst\s+calcRelatorioMensal\s*=/],
].forEach(([description, pattern]) => {
  if (pattern.test(source)) violations.push([description, pattern]);
});

if (violations.length) {
  console.error("Fronteira financeira violada:");
  violations.forEach(([description]) => console.error(`- ${description}`));
  process.exit(1);
}

console.log("Fronteira financeira válida: a tela Financeiro consome somente o motor canônico.");
