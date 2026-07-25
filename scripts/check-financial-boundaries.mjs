import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/LegacyApp.jsx", import.meta.url), "utf8");
const section = (startToken, endToken) => {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error(`Fronteira não localizada: ${startToken}`);
  return source.slice(start, end);
};
const financialScreen = section("function Financeiro({", "function ClienteContratualModal(");
const canonicalScreens = [
  ["FinanceiroObraPainel", section("function FinanceiroObraPainel(", "function DRE(")],
  ["DRELegado", section("function DRELegado(", "function MedicoesView(")],
  ["MedicoesView", section("function MedicoesView(", "function ModoIADocumento(")],
  ["FinanceiroAdministrativo", section("function FinanceiroAdministrativo(", "function calcularRankingFinanceiro(")],
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

if (violations.length) {
  console.error("Fronteira financeira violada:");
  violations.forEach(([description]) => console.error(`- ${description}`));
  process.exit(1);
}

console.log("Fronteira financeira válida: a tela Financeiro consome somente o motor canônico.");
