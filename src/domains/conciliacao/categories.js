import { INCOME_RECONCILIATION_CATEGORIES } from "../dre/receipt-classification.js";
export { incomeCategoryEffect } from "../dre/receipt-classification.js";
import { COMPANY_EXPENSE_CATEGORIES, COMPANY_EXPENSE_GROUPS } from "../dre/expense-taxonomy.js";
import { workExpenseCategories } from "../dre/work-expense-categories.js";

export const normalizeCategorySearch = value => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

const workCategories = [
  { id:"material", label:"Material / Insumos" },
  { id:"mao_obra", label:"Mão de obra / Salários" },
  { id:"beneficios", label:"Benefícios da equipe" },
  { id:"terceirizado", label:"Serviços terceirizados" },
  { id:"equipamento", label:"Equipamentos / Locação" },
  { id:"transporte", label:"Transporte / Frete" },
];



// A natureza do lançamento é resolvida no servidor pelo mesmo catálogo da
// interface. O cliente nunca decide livremente se um movimento vira receita.
export const reconciliationCategories = (data = {}, { direction = "saida", destination = "obra" } = {}) => {
  if (direction === "entrada") return INCOME_RECONCILIATION_CATEGORIES.map(category => ({ ...category }));
  if (direction !== "saida") return [];
  if (destination === "empresa") return COMPANY_EXPENSE_CATEGORIES.map(category => ({
    ...category, groupLabel:COMPANY_EXPENSE_GROUPS.find(group => group.id === category.group)?.label || "Outras despesas operacionais",
    effect:"cost", description:"Despesa da empresa reconhecida na competência informada. Vincule o pagamento quando a despesa já estiver cadastrada.",
  }));
  const categories = new Map(workCategories.map(category => [category.id, category]));
  for (const category of workExpenseCategories(data)) {
    if (!category?.v || category.ativo === false || category.active === false) continue;
    categories.set(String(category.v), { id:String(category.v), label:String(category.l || category.v) });
  }
  return [...categories.values()].map(category => ({
    ...category, effect:"cost", group:"custos_obra", groupLabel:"Custos da obra no DRE",
    description:category.id === "mao_obra"
      ? "Se o salário já consta da folha ou do ponto, concilie com o título de folha para preservar o custo e o rateio originais."
      : "Novo custo da obra na competência informada. Vincule a compra ou despesa quando ela já estiver cadastrada.",
  }));
};

export const findReconciliationCategory = (data, { direction, destination, category } = {}) =>
  reconciliationCategories(data, { direction, destination }).find(item => item.id === String(category || "")) || null;

