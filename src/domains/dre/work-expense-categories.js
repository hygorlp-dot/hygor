// Catálogo de despesas cadastrado no DRE da obra. A conciliação consulta a
// mesma fonte para que uma categoria personalizada não desapareça no extrato.
export const DEFAULT_WORK_EXPENSE_CATEGORIES = Object.freeze([
  { v:"material", l:"Material / Insumos" },
  { v:"equipamento", l:"Equipamentos / Locação" },
  { v:"subempreitada", l:"Subempreitada" },
  { v:"taxa", l:"Taxa / Licença / Imposto" },
  { v:"overhead", l:"Overhead / Administrativo" },
  { v:"outros", l:"Outros" },
]);

export const workExpenseCategories = data => {
  const custom = Array.isArray(data?.categoriasDesp) ? data.categoriasDesp : [];
  if (!custom.length) return DEFAULT_WORK_EXPENSE_CATEGORIES;
  return custom.some(category => category.v === "outros")
    ? custom : [...custom, { v:"outros", l:"Outros" }];
};
