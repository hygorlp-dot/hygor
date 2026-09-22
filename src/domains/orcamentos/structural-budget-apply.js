import { aplicarCriterioEstrutural } from "./structural-quantity-policy";
import { budgetIsImmutable } from "./calculations";
import { compatibleStructuralItem } from "./structural-budget-matching";
import { recuperarGeometriaSapatas } from "./sapata-geometria-recovery";
import { resumoSapatas, novaPilarPavimento, novaVigaPavimento, novaLajePavimento, calcularConcretoMagroViga, calcularAcoVigotaLaje } from "./memoria-calculo-estrutural";

const row = (key, label, value, unit, pending = false) => ({ key, label, value: Number(value || 0), unit, pending });
const steelRows = list => {
  const totals = new Map();
  for (const item of list || []) {
    const bitola = String(Number(String(item.bitola).replace(",", ".")));
    totals.set(bitola, (totals.get(bitola) || 0) + Number(item.kg || 0));
  }
  return [...totals].map(([bitola, kg]) => row(`aco-${bitola}`, `Aço Ø ${bitola} mm`, kg, "kg"));
};

// Uma única projeção alimenta tanto a tela quanto a aplicação no orçamento.
export function structuralBudgetRows(budget) {
  const memory = aplicarCriterioEstrutural(budget?.memoriaCalculo || {});
  const sapatas = recuperarGeometriaSapatas(memory.fundacao?.sapatas || []);
  const resumo = resumoSapatas(sapatas), t = resumo.totais;
  const pending = sapatas.some(s => s.geometriaPendente);
  const result = { fundacao: [
    row("escavacao", "Escavação", t.volumeEscavacao, "m³"),
    row("concreto", "Concreto das sapatas", t.volumeSapata, "m³", pending),
    row("forma", "Fôrma", t.formaArea, "m²", pending),
    row("magro", "Lastro de concreto magro", t.areaConcretoMagro, "m²"),
    row("reaterro", "Reaterro", t.reaterro, "m³", pending), ...steelRows(resumo.acoPorBitola),
  ] };
  for (const pav of ["terreo", "pavimento1", "cobertura", "reservatorio"]) {
    const p = { ...novaPilarPavimento(), ...memory[pav]?.pilar };
    const v = { ...novaVigaPavimento(), ...memory[pav]?.viga };
    result[`${pav}-pilares`] = [row("concreto", "Concreto", p.concretoM3, "m³", p.precisaRevisar), row("forma", "Fôrma", p.formaM2, "m²", p.precisaRevisar), ...steelRows(p.acoPorBitola)];
    result[`${pav}-vigas`] = [row("concreto", "Concreto", v.concretoM3, "m³", v.avisoConcretoIncorreto), row("forma", "Fôrma", v.formaM2, "m²"),
      ...(pav === "terreo" ? [row("magro", "Lastro de concreto magro", calcularConcretoMagroViga(v), "m³", !(Number(v.magroEspessuraCm) > 0))] : []), ...steelRows(v.acoPorBitola)];
    if (pav === "terreo") continue;
    const l = { ...novaLajePavimento(), ...memory[pav]?.laje };
    result[`${pav}-laje`] = [row("concreto", "Concreto total", l.volumeM3, "m³"), row("area-macica", "Área maciça", l.areaMacicaM2, "m²"), row("area-vigota", "Área de vigotas", l.areaVigotaM2, "m²"),
      ...(l.acoSemBitolas ? [row("aco-projeto", "Aço do projeto (sem bitolas)", l.acoTotalProjetoKg, "kg", true)] : [...steelRows(l.acoPorBitola), row("aco-vigota", "Tela das vigotas", calcularAcoVigotaLaje(l), "kg")])];
  }
  return result;
}

export function applyStructuralBudgetLinks(budget, scope) {
  const fail = reason => ({ ok: false, reason });
  if (budgetIsImmutable(budget)) return fail("Crie uma revisão para alterar as quantidades deste orçamento aprovado.");
  const memory = aplicarCriterioEstrutural(budget?.memoriaCalculo || {});
  const links = memory.vinculosEstruturais || {};
  const previous = memory.aplicacoesEstruturais || {};
  const groups = structuralBudgetRows(budget);
  if (!groups[scope]) return fail("Seção estrutural não encontrada.");
  const entries = Object.entries(groups).flatMap(([group, rows]) => rows.map(r => ({ ...r, source: `${group}.${r.key}` })));
  const prefix = `${scope}.`;
  const affected = new Set([...Object.entries(links), ...Object.entries(previous)].filter(([key]) => key.startsWith(prefix)).map(([, id]) => id).filter(Boolean));
  if (!affected.size) return fail("Defina ao menos um destino no orçamento.");
  const items = new Map((budget.itens || []).map(item => [item.id, item]));
  const totals = new Map([...affected].map(id => [id, 0]));
  for (const [source, id] of Object.entries(links)) {
    if (!affected.has(id)) continue;
    const item = items.get(id), measure = entries.find(r => r.source === source);
    if (!item || item.tipo === "titulo") return fail("Um destino foi removido. Redefina o vínculo antes de aplicar.");
    if (!measure) return fail(`O quantitativo ${source} não está mais disponível. Revise seus vínculos.`);
    if (measure.pending) return fail(`${measure.label} (${source.split(".")[0]}) tem uma pendência técnica e não pode ser aplicado.`);
    if (!Number.isFinite(measure.value) || measure.value < 0 || !compatibleStructuralItem(measure, item)) return fail(`Destino incompatível para ${measure.label}. Confira serviço e unidade.`);
    totals.set(id, totals.get(id) + measure.value);
  }
  const applied = { ...previous };
  // Registra também parcelas de outras seções somadas ao mesmo destino.
  for (const [source, id] of Object.entries(previous)) if (affected.has(id)) delete applied[source];
  for (const [source, id] of Object.entries(links)) if (affected.has(id)) applied[source] = id;
  return { ok: true, count: [...affected].filter(id => items.has(id)).length, budget: {
    ...budget,
    itens: budget.itens.map(item => totals.has(item.id) ? { ...item, quantidade: Math.round(totals.get(item.id) * 1e6) / 1e6 } : item),
    memoriaCalculo: { ...memory, aplicacoesEstruturais: applied },
  } };
}
