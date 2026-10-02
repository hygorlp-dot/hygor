// Timeline operacional da frota (aba "Mapa de ocupação"). Domínio puro, sem
// React. Esta camada NÃO cria regra: só muda a REPRESENTAÇÃO (um período
// contínuo vira um segmento contínuo). Autoridades reaproveitadas:
//
//  - Ocupações: buildEquipmentUnavailability + isActiveUnavailability
//    (availability.js) - os mesmos eventos que a grade diária desenhava.
//    Estado = typeCategory de availability.js: locação -> em uso, reserva ->
//    reservado, manutenção -> manutenção, demais (inspeção, transporte,
//    avaria, bloqueio, quarentena) -> indisponível.
//  - Unidades livres, livre hoje e próxima disponibilidade: availabilityOnDate.
//  - Conflito: a regra da grade antiga - soma das quantidades dos eventos
//    ativos no dia acima da capacidade (quantidadeTotal).
//  - Dias locados/ociosos, ocupação, receita e resultado: resumoLocacaoEquip,
//    movida para cá sem mudança. Ver docs/EQUIPAMENTOS_TIMELINE_FROTA.md.
import {
  availabilityOnDate, buildEquipmentUnavailability, EQUIPMENT_BLOCKING_STATUS, EQUIPMENT_UNAVAILABILITY_LABEL,
  isActiveUnavailability,
} from "./availability.js";
import { cobrancaLocacao, diasLocacaoNoPeriodo, melhorTarifa, tarifasCustoDaLocacao } from "./calculations.js";
import { physicalIdentityForRecord } from "./registry.js";
import { normalizeText, obraLabel } from "./rental-operations.js";
import { addDays, daysBetween, listDays, monthBounds, monthLabel } from "./rental-period.js";

// ---------------------------------------------------- resumo (autoridade) --
// Movidas de components/EquipamentosView.jsx SEM ALTERAÇÃO.
// Linha da grade de um equipamento: um registro por dia do periodo, so para
// enxergar ONDE ele estava. O dinheiro NAO sai daqui: como a tarifa pode ser
// semanal/quinzenal/mensal, o valor do dia isolado nao existe - o total vem
// do contrato inteiro (ver resumoLocacaoEquip).
export const gradeLocacaoEquip = (data, equipId, days) => {
  const locacoes = (data.locacoesEquip || []).filter(l => l.equipamentoId === equipId);
  return (days || []).map(iso => {
    // Item de lote pode estar em VARIAS obras no mesmo dia - pegamos todas.
    const doDia = locacoes.filter(l => l.inicio && l.inicio <= iso && (!l.fim || l.fim >= iso));
    if (!doDia.length) {
      return { data: iso, locado: false, obraId: "", locId: "", unidades: 0, obras: [] };
    }
    const unidades = doDia.reduce((s, l) => s + Math.max(1, Number(l.quantidade || 1)), 0);
    const obras = [...new Set(doDia.map(l => l.obraId).filter(Boolean))];
    return {
      data: iso, locado: true,
      obraId: doDia.slice().sort((a,b)=>Number(b.quantidade||1)-Number(a.quantidade||1))[0].obraId,
      locId:  doDia.slice().sort((a,b)=>Number(b.quantidade||1)-Number(a.quantidade||1))[0].id,
      unidades, obras, varias: obras.length > 1,
    };
  });
};

// Resumo do periodo: dias locado/ocioso, ocupacao e o resultado financeiro.
// A receita e apurada POR CONTRATO (dias dele dentro do periodo), usando a
// combinacao de tarifas mais barata - nunca somando "diarias".
export const resumoLocacaoEquip = (data, equipId, days) => {
  const grade = gradeLocacaoEquip(data, equipId, days);
  const diasLocado = grade.filter(g => g.locado).length;
  const obras = [...new Set(grade.flatMap(g => g.obras || []))];

  const equip = (data.equipamentos || []).find(e => e.id === equipId);
  const pi = days?.[0] || "";
  const pf = days?.[days.length - 1] || "";
  let receita = 0, custo = 0, desconto = 0;
  const porContrato = [];
  if (pi && pf) {
    (data.locacoesEquip || []).filter(l => l.equipamentoId === equipId).forEach(l => {
      const dias = diasLocacaoNoPeriodo(l, pi, pf);
      if (!dias) return;
      const cob = cobrancaLocacao(l, equip, dias);
      const cst = melhorTarifa(tarifasCustoDaLocacao(l, equip), dias).total;
      receita += cob.liquido; custo += cst; desconto += cob.desconto;
      porContrato.push({ locId: l.id, obraId: l.obraId, dias, ...cob, custo: cst });
    });
  }

  return {
    grade, diasLocado,
    diasOciosos: grade.length - diasLocado,
    ocupacaoPct: grade.length ? (diasLocado / grade.length) * 100 : 0,
    receita, custo, desconto, resultado: receita - custo,
    porContrato,
    obras,                       // obras por onde passou no periodo
    transferencias: Math.max(0, obras.length - 1),   // trocou de obra no periodo
  };
};

// ------------------------------------------------------------- estados ----
export const TIMELINE_STATE = Object.freeze({
  IN_USE: "em_uso", RESERVED: "reservado", MAINTENANCE: "manutencao", UNAVAILABLE: "indisponivel",
});
export const TIMELINE_STATE_LABEL = Object.freeze({
  em_uso: "Em uso", reservado: "Reservado", manutencao: "Manutenção", indisponivel: "Indisponível",
});
const stateOfType = type => type === "rental" ? TIMELINE_STATE.IN_USE
  : type === "reservation" ? TIMELINE_STATE.RESERVED
  : type === "maintenance" ? TIMELINE_STATE.MAINTENANCE
  : TIMELINE_STATE.UNAVAILABLE;

export const ZOOM = Object.freeze({ DAY: "dia", WEEK: "semana" });
export const GROUP_BY = Object.freeze({ NONE: "nenhum", CATEGORY: "categoria", OWNER: "proprietario" });
export const QUICK_FILTER = Object.freeze({ FREE_TODAY: "livres_hoje", RELEASE_WEEK: "liberam_semana", CONFLICT: "conflito" });
export const QUICK_FILTER_LABEL = Object.freeze({
  livres_hoje: "Livres hoje", liberam_semana: "Liberam em 7 dias", conflito: "Com conflito",
});
export const DEFAULT_TIMELINE_FILTERS = Object.freeze({
  obraId: "all", situacao: "all", propriedade: "all", categoria: "all", busca: "", rapido: "none",
});
const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];
const qty = value => Math.max(1, Math.trunc(Number(value) || 1));
const weekdayOf = iso => new Date(`${iso}T00:00:00Z`).getUTCDay();

// Recorta o banco ao que interessa a UM equipamento: availabilityOnDate e
// resumoLocacaoEquip filtram por equipamento de qualquer forma, então o
// resultado é idêntico e a frota inteira deixa de ser varrida por dia.
const indexByEquipment = data => {
  const key = item => String(item?.equipamentoId ?? item?.equipmentId ?? item?.equipment_id ?? "");
  const buckets = new Map();
  const push = (field, item) => {
    const id = key(item);
    if (!buckets.has(id)) buckets.set(id, { locacoesEquip: [], manutencoesEquip: [], transferenciasEquip: [], equipmentUnavailability: [] });
    buckets.get(id)[field].push(item);
  };
  ["locacoesEquip", "manutencoesEquip", "transferenciasEquip", "equipmentUnavailability"].forEach(field =>
    (data[field] || []).forEach(item => push(field, item)));
  return (equipment) => ({
    ...data,
    equipamentos: [equipment],
    ...(buckets.get(String(equipment.id)) || { locacoesEquip: [], manutencoesEquip: [], transferenciasEquip: [], equipmentUnavailability: [] }),
  });
};

const workOf = (data, workId) => {
  if (!workId) return null;
  const obra = (data.obras || []).find(item => String(item.id) === String(workId));
  const name = String(obra?.name || obra?.nome || "").trim();
  const code = String(obra?.code || obra?.codigo || "").trim();
  return { id: String(workId), name: name || code || "Obra", code, label: obraLabel(obra) || name || "Obra" };
};

const equipmentCode = (data, equipment) => {
  if (equipment.patrimonio) return String(equipment.patrimonio);
  const identity = physicalIdentityForRecord(data, {}, equipment);
  return identity.assetTags[0] || identity.lotCode || "";
};

// Raias: ocupações simultâneas do mesmo equipamento (itens de lote) não se
// sobrepõem na tela - cada uma ganha a primeira raia livre.
const assignLanes = segments => {
  const ends = [];
  segments.slice().sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx).forEach(segment => {
    let lane = ends.findIndex(end => end < segment.startIdx);
    if (lane < 0) { lane = ends.length; ends.push(segment.endIdx); } else ends[lane] = segment.endIdx;
    segment.lane = lane;
  });
  return Math.max(1, ends.length);
};

const conflictRanges = (events, days, total) => {
  const ranges = [];
  days.forEach((iso, idx) => {
    const demand = events.filter(event => event.startDate <= iso && (!event.endDate || event.endDate >= iso))
      .reduce((sum, event) => sum + event.quantity, 0);
    if (demand <= total) return;
    const last = ranges.at(-1);
    if (last && last.endIdx === idx - 1) { last.endIdx = idx; last.endDate = iso; last.demand = Math.max(last.demand, demand); }
    else ranges.push({ startIdx: idx, endIdx: idx, startDate: iso, endDate: iso, demand, total });
  });
  return ranges;
};

const nextAvailability = (scoped, equipment, events, hoje) => {
  const now = availabilityOnDate(scoped, equipment, hoje);
  if (now.livre > 0) return { kind: "now", date: hoje, free: now.livre, total: now.total };
  const candidates = [...new Set(events.filter(event => event.endDate && event.endDate >= hoje).map(event => addDays(event.endDate, 1)))].sort();
  for (const date of candidates) {
    const at = availabilityOnDate(scoped, equipment, date);
    if (at.livre > 0) return { kind: "date", date, free: at.livre, total: at.total };
  }
  return { kind: "undefined", date: "", free: 0, total: now.total };
};

const buildRow = (data, scoped, equipment, { days, inicio, fim, hoje, ownerName }) => {
  const total = qty(equipment.quantidadeTotal);
  const events = buildEquipmentUnavailability(scoped)
    .filter(event => String(event.equipmentId) === String(equipment.id) && isActiveUnavailability(event) && event.affectsCapacity !== false);
  const rentals = new Map((scoped.locacoesEquip || []).map(item => [String(item.id), item]));
  const resumo = resumoLocacaoEquip(scoped, equipment.id, days);
  const valueByRental = new Map(resumo.porContrato.map(item => [String(item.locId), item]));

  const segments = events
    .filter(event => event.startDate <= fim && (!event.endDate || event.endDate >= inicio))
    .map(event => {
      const start = event.startDate < inicio ? inicio : event.startDate;
      const end = !event.endDate || event.endDate > fim ? fim : event.endDate;
      const rental = event.rentalId ? rentals.get(String(event.rentalId)) : null;
      const value = rental ? valueByRental.get(String(rental.id)) : null;
      return {
        id: event.id, type: event.type, state: stateOfType(event.type),
        typeLabel: EQUIPMENT_UNAVAILABILITY_LABEL[event.type] || "Indisponibilidade",
        reason: event.reason, quantity: event.quantity,
        startDate: event.startDate, endDate: event.endDate, openEnded: !event.endDate,
        clippedStart: event.startDate < inicio, clippedEnd: !event.endDate || event.endDate > fim,
        startIdx: daysBetween(inicio, start), endIdx: daysBetween(inicio, end),
        durationDays: event.endDate ? daysBetween(event.startDate, event.endDate) + 1 : null,
        work: workOf(data, event.workId || rental?.obraId),
        rentalId: event.rentalId || "", maintenanceId: event.maintenanceId || "",
        unavailabilityId: !event.id.startsWith("legacy-") ? event.id : "",
        periodValue: value ? value.liquido : null, periodDays: value ? value.dias : null,
      };
    });

  // Status do cadastro (em manutenção, bloqueado...) bloqueia a capacidade
  // inteira em fleetAvailability; aqui ele aparece como uma faixa do mês.
  const statusReason = EQUIPMENT_BLOCKING_STATUS[String(equipment.status || "")] || "";
  if (statusReason) segments.push({
    id: `equipment-status:${equipment.id}`, type: "status",
    state: equipment.status === "manutencao" ? TIMELINE_STATE.MAINTENANCE : TIMELINE_STATE.UNAVAILABLE,
    typeLabel: "Status do cadastro", reason: `Equipamento ${statusReason}`, quantity: total,
    startDate: "", endDate: "", openEnded: true, clippedStart: true, clippedEnd: true,
    startIdx: 0, endIdx: days.length - 1, durationDays: null, work: null,
    rentalId: "", maintenanceId: "", unavailabilityId: "", periodValue: null, periodDays: null, fromStatus: true,
  });

  const lanes = assignLanes(segments);
  const conflicts = conflictRanges(events, days, total);
  segments.forEach(segment => {
    segment.conflict = conflicts.some(range => range.startIdx <= segment.endIdx && range.endIdx >= segment.startIdx);
  });
  const today = availabilityOnDate(scoped, equipment, hoje);
  const inUseToday = events.some(event => event.type === "rental" && event.startDate <= hoje && (!event.endDate || event.endDate >= hoje));
  const releases = events
    .filter(event => event.type === "rental" && event.endDate && event.endDate >= hoje)
    .map(event => ({
      id: event.id, date: event.endDate, quantity: event.quantity, equipmentId: String(equipment.id),
      equipmentName: equipment.nome || "Equipamento", work: workOf(data, event.workId), rentalId: event.rentalId || "",
    }));
  const terceiro = Boolean(equipment.proprietarioId);
  return {
    id: String(equipment.id), equipment, name: equipment.nome || "Equipamento",
    code: equipmentCode(data, equipment), category: String(equipment.categoria || "").trim(),
    terceiro, owner: terceiro ? ownerName(equipment.proprietarioId) : "Próprio", total,
    segments, lanes, conflicts,
    works: [...new Set([...resumo.obras, ...segments.map(segment => segment.work?.id).filter(Boolean)])],
    freeToday: today.livre, inUseToday, next: nextAvailability(scoped, equipment, events, hoje), releases,
    resumo: {
      diasLocado: resumo.diasLocado, diasOciosos: resumo.diasOciosos, ocupacaoPct: resumo.ocupacaoPct,
      receita: resumo.receita, custo: resumo.custo, resultado: resumo.resultado,
    },
  };
};

// ------------------------------------------------------------- filtros ----
const matchesFilters = (row, f, hoje) => {
  if (f.obraId !== "all" && !row.works.includes(String(f.obraId))) return false;
  if (f.propriedade === "proprios" && row.terceiro) return false;
  if (f.propriedade === "terceiros" && !row.terceiro) return false;
  if (f.categoria !== "all" && row.category !== f.categoria) return false;
  if (f.situacao === "livre" && row.segments.length) return false;
  if (!["all", "livre"].includes(f.situacao) && !row.segments.some(segment => segment.state === f.situacao)) return false;
  if (f.rapido === QUICK_FILTER.FREE_TODAY && row.freeToday <= 0) return false;
  if (f.rapido === QUICK_FILTER.RELEASE_WEEK && !row.releases.some(release => release.date <= addDays(hoje, 6))) return false;
  if (f.rapido === QUICK_FILTER.CONFLICT && !row.conflicts.length) return false;
  const term = normalizeText(f.busca);
  if (term) {
    const haystack = normalizeText([row.name, row.code, row.category, row.owner, ...row.segments.map(segment => segment.work?.label)].join(" "));
    if (!haystack.includes(term)) return false;
  }
  return true;
};

export const activeTimelineFilterCount = (filters = {}, obraIdFixo = "") => {
  const f = { ...DEFAULT_TIMELINE_FILTERS, ...filters };
  return ["obraId", "situacao", "propriedade", "categoria"].filter(key => f[key] !== "all" && !(key === "obraId" && obraIdFixo)).length
    + (normalizeText(f.busca) ? 1 : 0) + (f.rapido !== "none" ? 1 : 0);
};

const groupRows = (rows, groupBy) => {
  if (groupBy === GROUP_BY.NONE) return [{ id: "all", label: "", rows }];
  const keyOf = row => groupBy === GROUP_BY.CATEGORY ? (row.category || "Sem categoria") : row.owner;
  const map = new Map();
  rows.forEach(row => { const key = keyOf(row); if (!map.has(key)) map.set(key, []); map.get(key).push(row); });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([label, items]) => ({ id: label, label, rows: items }));
};

// -------------------------------------------------------------- modelo ----
export const buildFleetTimeline = (data = {}, { ym, hoje, filters = {}, groupBy = GROUP_BY.NONE, ownerName = () => "Terceiro", obraIdFixo = "" } = {}) => {
  const f = { ...DEFAULT_TIMELINE_FILTERS, ...filters, ...(obraIdFixo ? { obraId: obraIdFixo } : {}) };
  const { inicio, fim } = monthBounds(ym);
  const days = listDays(inicio, fim).map(iso => {
    const weekday = weekdayOf(iso);
    return { iso, day: iso.slice(8, 10), weekday: WEEKDAY[weekday], weekend: weekday === 0 || weekday === 6, isToday: iso === hoje, weekStart: weekday === 1 };
  });
  const dayList = days.map(day => day.iso);
  const scopeFor = indexByEquipment(data);
  const equipments = (data.equipamentos || []).filter(item => item.ativo !== false)
    .slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  const allRows = equipments.map(equipment => buildRow(data, scopeFor(equipment), equipment, { days: dayList, inicio, fim, hoje, ownerName }));
  const rows = allRows.filter(row => matchesFilters(row, f, hoje));

  const locado = rows.reduce((sum, row) => sum + row.resumo.diasLocado, 0);
  const ocioso = rows.reduce((sum, row) => sum + row.resumo.diasOciosos, 0);
  const weekEnd = addDays(hoje, 6);
  const releases = rows.flatMap(row => row.releases).sort((a, b) => a.date.localeCompare(b.date) || a.equipmentName.localeCompare(b.equipmentName, "pt-BR"));
  const kpis = {
    ocupacaoPct: locado + ocioso > 0 ? (locado / (locado + ocioso)) * 100 : null,
    diasLocado: locado, diasOciosos: ocioso,
    emUsoHoje: rows.filter(row => row.inUseToday).length, livresHoje: rows.filter(row => row.freeToday > 0).length,
    equipamentos: rows.length,
    liberacoesSemana: releases.filter(release => release.date <= weekEnd).length,
    conflitos: rows.reduce((sum, row) => sum + row.conflicts.length, 0),
    equipamentosEmConflito: rows.filter(row => row.conflicts.length).length,
    receita: rows.reduce((sum, row) => sum + row.resumo.receita, 0),
    resultado: rows.reduce((sum, row) => sum + row.resumo.resultado, 0),
  };
  const todayIdx = days.findIndex(day => day.isToday);
  return {
    ym, label: monthLabel(ym), inicio, fim, hoje, days, todayIdx, filters: f, groupBy,
    rows, groups: groupRows(rows, groupBy), allRows, kpis,
    releases: releases.slice(0, 6), releasesTotal: releases.length,
    hasEquipment: allRows.length > 0,
    hasCategories: allRows.some(row => row.category),
  };
};

export const buildTimelineFilterOptions = (model, data = {}) => {
  const works = new Map();
  model.allRows.forEach(row => row.segments.forEach(segment => { if (segment.work) works.set(segment.work.id, segment.work.label); }));
  // Obra filtrada continua nomeada mesmo sem ocupação no mês exibido.
  const extra = [...model.allRows.flatMap(row => row.works), ...(model.filters.obraId !== "all" ? [model.filters.obraId] : [])];
  extra.forEach(id => { if (!works.has(id)) works.set(id, workOf(data, id)?.label || "Obra"); });
  const categories = [...new Set(model.allRows.map(row => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    obras: [{ value: "all", label: "Todas as obras" }, ...[...works.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))],
    situacao: [{ value: "all", label: "Todas as situações" }, ...Object.entries(TIMELINE_STATE_LABEL).map(([value, label]) => ({ value, label })), { value: "livre", label: "Sem ocupação no mês" }],
    propriedade: [{ value: "all", label: "Próprios + terceiros" }, { value: "proprios", label: "Próprios" }, { value: "terceiros", label: "Terceiros" }],
    categoria: [{ value: "all", label: "Todas as categorias" }, ...categories.map(value => ({ value, label: value }))],
  };
};

export const buildTimelineChips = (filters, options, obraIdFixo = "") => {
  const f = { ...DEFAULT_TIMELINE_FILTERS, ...filters };
  const labelOf = (list, value) => list.find(item => item.value === value)?.label || value;
  const chips = [];
  if (f.obraId !== "all" && !obraIdFixo) chips.push({ id: "obraId", label: labelOf(options.obras, f.obraId) });
  if (f.situacao !== "all") chips.push({ id: "situacao", label: labelOf(options.situacao, f.situacao) });
  if (f.propriedade !== "all") chips.push({ id: "propriedade", label: labelOf(options.propriedade, f.propriedade) });
  if (f.categoria !== "all") chips.push({ id: "categoria", label: f.categoria });
  if (f.rapido !== "none") chips.push({ id: "rapido", label: QUICK_FILTER_LABEL[f.rapido] });
  if (normalizeText(f.busca)) chips.push({ id: "busca", label: `Busca: “${f.busca.trim()}”` });
  return chips;
};

// Opções de mês: 12 para trás e 6 para frente (planejamento), sempre com o
// mês exibido incluído.
export const timelineMonthOptions = (hojeYm, currentYm) => {
  const [y, m] = hojeYm.split("-").map(Number);
  const out = [];
  for (let delta = 6; delta >= -12; delta--) {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: monthLabel(value) });
  }
  if (!out.some(option => option.value === currentYm)) out.push({ value: currentYm, label: monthLabel(currentYm) });
  return out.sort((a, b) => b.value.localeCompare(a.value));
};

// Texto dentro da barra conforme a largura disponível - nunca espremido.
export const barLabel = (segment, widthPx) => {
  const name = segment.work?.name || segment.typeLabel;
  const code = segment.work?.code || "";
  if (widthPx >= 150) return code && segment.work ? `${name} · ${code}` : name;
  if (widthPx >= 64) return code || (name.length <= 9 ? name : "");
  return "";
};
