import { describe, expect, it } from "vitest";
import { availabilityOnDate } from "./availability.js";
import {
  activeTimelineFilterCount, barLabel, buildFleetTimeline, buildTimelineChips, buildTimelineFilterOptions,
  GROUP_BY, QUICK_FILTER, resumoLocacaoEquip, TIMELINE_STATE, timelineMonthOptions,
} from "./fleet-timeline.js";
import { buildTimelineData, ownerNameFor, TIMELINE_HOJE, TIMELINE_YM } from "./fleet-timeline.fixture.js";

const data = buildTimelineData();
const build = (options = {}) => buildFleetTimeline(data, { ym: TIMELINE_YM, hoje: TIMELINE_HOJE, ownerName: ownerNameFor(data), ...options });
const rowOf = (model, id) => model.allRows.find(row => row.id === id);
const listMonth = () => Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

describe("timeline da frota — segmentos", () => {
  const model = build();

  it("monta os 30 dias com fim de semana e hoje", () => {
    expect(model.days).toHaveLength(30);
    expect(model.days.filter(day => day.weekend).map(day => day.day)).toEqual(["05", "06", "12", "13", "19", "20", "26", "27"]);
    expect(model.todayIdx).toBe(14);
    expect(model.days[14]).toMatchObject({ iso: "2026-09-15", isToday: true });
  });

  it("locação de vários dias vira UM segmento contínuo", () => {
    const rentals = rowOf(model, "eq-bet").segments.filter(segment => segment.type === "rental");
    expect(rentals).toHaveLength(1);
    expect(rentals[0]).toMatchObject({ state: TIMELINE_STATE.IN_USE, startIdx: 0, endIdx: 17, durationDays: 18, work: { name: "Terras Alpha", code: "K1-04" } });
  });

  it("locação de um dia ocupa uma única coluna", () => {
    const [segment] = rowOf(model, "eq-ger").segments.filter(item => item.type === "rental");
    expect(segment).toMatchObject({ startIdx: 7, endIdx: 7, durationDays: 1 });
  });

  it("recorta início antes e fim depois do mês, sem mudar as datas reais", () => {
    const segments = rowOf(model, "eq-and").segments;
    const before = segments.find(item => item.rentalId === "R-AND1");
    const after = segments.find(item => item.rentalId === "R-AND2");
    expect(before).toMatchObject({ startIdx: 0, endIdx: 9, clippedStart: true, clippedEnd: false, startDate: "2026-08-20" });
    expect(after).toMatchObject({ startIdx: 4, endIdx: 29, clippedStart: false, clippedEnd: true, endDate: "2026-10-20" });
  });

  it("ocupação que atravessa o mês inteiro cobre todas as colunas", () => {
    const [segment] = rowOf(model, "eq-vib").segments;
    expect(segment).toMatchObject({ startIdx: 0, endIdx: 29, clippedStart: true, clippedEnd: true });
  });

  it("locação sem data de fim é aberta e vai até o fim do mês", () => {
    const [segment] = rowOf(model, "eq-gru").segments;
    expect(segment).toMatchObject({ openEnded: true, startIdx: 9, endIdx: 29, durationDays: null });
  });

  it("dois períodos separados continuam dois segmentos", () => {
    expect(rowOf(model, "eq-com").segments.map(item => [item.startIdx, item.endIdx])).toEqual([[0, 3], [9, 14]]);
  });

  it("ocupações simultâneas do lote ficam em raias diferentes", () => {
    const row = rowOf(model, "eq-and");
    expect(row.lanes).toBe(2);
    expect(new Set(row.segments.map(item => item.lane))).toEqual(new Set([0, 1]));
  });

  it("livre não gera segmento", () => {
    expect(rowOf(model, "eq-esc").segments).toEqual([]);
  });

  it("reserva e manutenção têm estados próprios; status do cadastro vira faixa do mês", () => {
    expect(rowOf(model, "eq-ger").segments.find(item => item.type === "reservation")).toMatchObject({ state: TIMELINE_STATE.RESERVED, startIdx: 21, endIdx: 25, work: { code: "K1-04" } });
    expect(rowOf(model, "eq-bet").segments.find(item => item.type === "maintenance")).toMatchObject({ state: TIMELINE_STATE.MAINTENANCE, startIdx: 11, endIdx: 11 });
    expect(rowOf(model, "eq-ser").segments).toEqual([expect.objectContaining({ state: TIMELINE_STATE.MAINTENANCE, fromStatus: true, startIdx: 0, endIdx: 29 })]);
  });

  it("equipamento inativo não aparece (mesma regra da grade antiga)", () => {
    expect(rowOf(model, "eq-old")).toBeUndefined();
  });

  it("valor do período vem do resumo por contrato (sem regra nova)", () => {
    const segment = rowOf(model, "eq-bet").segments.find(item => item.rentalId === "R-BET");
    const resumo = resumoLocacaoEquip(data, "eq-bet", listMonth());
    expect(segment.periodValue).toBe(resumo.porContrato.find(item => item.locId === "R-BET").liquido);
    expect(segment.periodDays).toBe(18);
  });
});

describe("timeline da frota — conflito e disponibilidade", () => {
  const model = build();

  it("conflito = demanda acima da capacidade (locação + manutenção no mesmo dia)", () => {
    const row = rowOf(model, "eq-bet");
    expect(row.conflicts).toEqual([{ startIdx: 11, endIdx: 11, startDate: "2026-09-12", endDate: "2026-09-12", demand: 2, total: 1 }]);
    expect(row.segments.filter(item => item.conflict)).toHaveLength(2);
    expect(rowOf(model, "eq-and").conflicts).toEqual([]);
    expect(model.kpis.conflitos).toBe(1);
  });

  it("próxima disponibilidade usa availabilityOnDate", () => {
    expect(rowOf(model, "eq-esc").next).toMatchObject({ kind: "now", free: 4, total: 4 });
    expect(rowOf(model, "eq-bet").next).toMatchObject({ kind: "date", date: "2026-09-19" });
    expect(rowOf(model, "eq-com").next).toMatchObject({ kind: "date", date: "2026-09-16" });
    expect(rowOf(model, "eq-gru").next.kind).toBe("undefined");
    expect(rowOf(model, "eq-ser").next.kind).toBe("undefined");
    expect(rowOf(model, "eq-and").next).toMatchObject({ kind: "now", free: 7 });
    expect(rowOf(model, "eq-bet").freeToday).toBe(availabilityOnDate(data, data.equipamentos[0], TIMELINE_HOJE).livre);
  });

  it("próximas liberações: só locações futuras com data de fim, em ordem", () => {
    expect(model.releases.map(item => [item.date, item.equipmentId])).toEqual([
      ["2026-09-15", "eq-com"], ["2026-09-18", "eq-bet"], ["2026-10-20", "eq-and"], ["2026-10-31", "eq-vib"],
    ]);
    expect(model.kpis.liberacoesSemana).toBe(2);
  });

  it("KPIs operacionais e financeiros preservam o resumo antigo", () => {
    const days = listMonth();
    const active = data.equipamentos.filter(item => item.ativo !== false);
    const resumos = active.map(item => resumoLocacaoEquip(data, item.id, days));
    const locado = resumos.reduce((sum, item) => sum + item.diasLocado, 0);
    const ocioso = resumos.reduce((sum, item) => sum + item.diasOciosos, 0);
    expect(model.kpis.diasLocado).toBe(locado);
    expect(model.kpis.diasOciosos).toBe(ocioso);
    expect(model.kpis.ocupacaoPct).toBeCloseTo(locado / (locado + ocioso) * 100, 6);
    expect(model.kpis.receita).toBeCloseTo(resumos.reduce((sum, item) => sum + item.receita, 0), 6);
    expect(model.kpis.resultado).toBeCloseTo(resumos.reduce((sum, item) => sum + item.resultado, 0), 6);
    expect(model.kpis).toMatchObject({ equipamentos: 8, emUsoHoje: 5, livresHoje: 3 });
  });
});

describe("timeline da frota — filtros, grupos e textos", () => {
  it("filtra por obra, categoria, propriedade, situação e busca", () => {
    expect(build({ filters: { obraId: "ob-a" } }).rows.map(row => row.id)).toEqual(["eq-bet", "eq-com", "eq-ger", "eq-vib"]);
    expect(build({ filters: { categoria: "Concreto" } }).rows.map(row => row.id)).toEqual(["eq-bet", "eq-vib"]);
    expect(build({ filters: { propriedade: "terceiros" } }).rows.map(row => row.id)).toEqual(["eq-and", "eq-esc", "eq-gru"]);
    expect(build({ filters: { situacao: "livre" } }).rows.map(row => row.id)).toEqual(["eq-esc"]);
    expect(build({ filters: { situacao: TIMELINE_STATE.MAINTENANCE } }).rows.map(row => row.id)).toEqual(["eq-bet", "eq-ser"]);
    expect(build({ filters: { busca: "green garden" } }).rows.map(row => row.id)).toEqual(["eq-and", "eq-gru"]);
  });

  it("atalhos: livres hoje, liberam em 7 dias, com conflito", () => {
    expect(build({ filters: { rapido: QUICK_FILTER.FREE_TODAY } }).rows.map(row => row.id)).toEqual(["eq-and", "eq-esc", "eq-ger"]);
    expect(build({ filters: { rapido: QUICK_FILTER.RELEASE_WEEK } }).rows.map(row => row.id)).toEqual(["eq-bet", "eq-com"]);
    expect(build({ filters: { rapido: QUICK_FILTER.CONFLICT } }).rows.map(row => row.id)).toEqual(["eq-bet"]);
  });

  it("obra fixa (dentro da obra) sempre filtra e não vira chip", () => {
    const model = build({ obraIdFixo: "ob-b", filters: { obraId: "all" } });
    expect(model.rows.map(row => row.id)).toEqual(["eq-and", "eq-com", "eq-ger"]);
    const options = buildTimelineFilterOptions(model, data);
    expect(buildTimelineChips(model.filters, options, "ob-b")).toEqual([]);
    expect(activeTimelineFilterCount(model.filters, "ob-b")).toBe(0);
  });

  it("mês sem ocupação: linhas livres, KPIs zerados e sem liberações no mês", () => {
    const model = build({ ym: "2026-03" });
    expect(model.rows.every(row => row.segments.every(segment => segment.fromStatus))).toBe(true);
    expect(model.kpis.diasLocado).toBe(0);
    expect(model.todayIdx).toBe(-1);
  });

  it("agrupa por categoria e por proprietário", () => {
    expect(build({ groupBy: GROUP_BY.CATEGORY }).groups.map(group => [group.label, group.rows.length]))
      .toEqual([["Concreto", 2], ["Corte", 1], ["Elevação", 3], ["Energia", 1], ["Terraplenagem", 1]]);
    expect(build({ groupBy: GROUP_BY.OWNER }).groups.map(group => group.label)).toEqual(["Locadora Norte", "Próprio"]);
  });

  it("chips nomeiam a obra mesmo sem ocupação no mês", () => {
    const model = build({ ym: "2026-03", filters: { obraId: "ob-a", rapido: QUICK_FILTER.CONFLICT } });
    const options = buildTimelineFilterOptions(model, data);
    expect(buildTimelineChips(model.filters, options).map(chip => chip.label)).toEqual(["K1-04 — Terras Alpha", "Com conflito"]);
  });

  it("texto da barra conforme a largura", () => {
    const segment = { work: { name: "Terras Alpha", code: "K1-04" }, typeLabel: "Locação" };
    expect(barLabel(segment, 400)).toBe("Terras Alpha · K1-04");
    expect(barLabel(segment, 80)).toBe("K1-04");
    expect(barLabel(segment, 40)).toBe("");
    expect(barLabel({ work: null, typeLabel: "Status do cadastro" }, 80)).toBe("");
  });

  it("meses: 6 à frente para planejar, 12 para trás", () => {
    const options = timelineMonthOptions("2026-09", "2026-09");
    expect(options[0].value).toBe("2027-03");
    expect(options.at(-1).value).toBe("2025-09");
    expect(timelineMonthOptions("2026-09", "2024-01").some(option => option.value === "2024-01")).toBe(true);
  });
});
