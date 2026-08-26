export const WBS_TYPES = Object.freeze(["project", "phase", "work_package", "activity", "milestone"]);
export const DEPENDENCY_TYPES = Object.freeze(["FS", "SS", "FF", "SF"]);
// O método é obrigatório sempre que houver avanço. Isso evita que um número
// digitado livremente pareça uma medição, uma quantidade ou um marco aprovado.
export const PROGRESS_METHODS = Object.freeze([
  "quantity",
  "physical_weight",
  "milestone",
  "approved_measurement",
  "checklist",
  "controlled_manual",
]);
export const PHYSICAL_WEIGHT_SOURCES = Object.freeze(["budget_value", "physical", "manual_approved"]);
