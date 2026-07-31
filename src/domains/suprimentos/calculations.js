// Motor determinístico de marcos e suprimentos. Ele não grava dados nem usa
// IA: telas e automações apenas persistem as propostas que este módulo monta.

export const SUPPLY_ENGINE_VERSION = "supply-engine-1";

const number = value => Number(value || 0);
const dayMs = 24 * 60 * 60 * 1000;
const cancelled = record => ["cancelado", "cancelada", "estornado", "rejeitado", "rejeitada", "arquivado"]
  .includes(String(record?.status || "").toLowerCase());

export const parseLocalDate = value => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? date : null;
};
export const toLocalDate = date => date ? date.toISOString().slice(0, 10) : "";
export const addCalendarDays = (date, days) => {
  const parsed = parseLocalDate(date); if (!parsed) return "";
  return toLocalDate(new Date(parsed.getTime() + Math.round(number(days)) * dayMs));
};
export const assertCalendar = calendar => {
  const workingDays = Array.isArray(calendar?.diasSemana) ? calendar.diasSemana : [1, 2, 3, 4, 5, 6];
  if (!workingDays.length) throw new Error("O calendário precisa ter ao menos um dia trabalhado.");
  return { diasSemana: [...new Set(workingDays.map(Number))].filter(day => day >= 0 && day <= 6), feriados: calendar?.feriados || [] };
};
export const isWorkingDay = (date, calendar = {}) => {
  const parsed = parseLocalDate(date); if (!parsed) return false;
  const cal = assertCalendar(calendar);
  const holidays = new Set(cal.feriados.map(item => typeof item === "string" ? item : item?.data).filter(Boolean));
  return cal.diasSemana.includes(parsed.getUTCDay()) && !holidays.has(toLocalDate(parsed));
};
export const addBusinessDays = (date, days, calendar = {}) => {
  let cursor = parseLocalDate(date); if (!cursor) return "";
  assertCalendar(calendar);
  let left = Math.abs(Math.trunc(number(days))), direction = number(days) >= 0 ? 1 : -1;
  while (left > 0) {
    cursor = new Date(cursor.getTime() + direction * dayMs);
    if (isWorkingDay(toLocalDate(cursor), calendar)) left -= 1;
  }
  return toLocalDate(cursor);
};
export const subtractBusinessDays = (date, days, calendar = {}) => addBusinessDays(date, -Math.abs(number(days)), calendar);
export const businessDaysBetweenInclusive = (start, end, calendar = {}) => {
  let cursor = parseLocalDate(start), finish = parseLocalDate(end);
  if (!cursor || !finish) return 0;
  assertCalendar(calendar);
  const direction = cursor <= finish ? 1 : -1;
  let count = 0;
  while ((direction > 0 && cursor <= finish) || (direction < 0 && cursor >= finish)) {
    if (isWorkingDay(toLocalDate(cursor), calendar)) count += direction;
    cursor = new Date(cursor.getTime() + direction * dayMs);
  }
  return count;
};

export const DEFAULT_LEAD_PROFILES = [
  { id:"pronta_entrega", nome:"Estoque local ou pronta entrega", engenharia:2, compra:5, fornecimento:3, logistica:2, buffer:3 },
  { id:"nacional", nome:"Fornecedor nacional padrão", engenharia:3, compra:8, fornecimento:15, logistica:4, buffer:5 },
  { id:"sob_medida", nome:"Material sob medida", engenharia:7, compra:12, fornecimento:30, logistica:6, buffer:10 },
  { id:"longo_prazo", nome:"Equipamento de longo prazo", engenharia:10, compra:15, fornecimento:65, logistica:10, buffer:20 },
  { id:"importado", nome:"Item importado", engenharia:15, compra:18, fornecimento:90, logistica:25, buffer:32 },
].map(profile => ({ ...profile, unidade:"uteis", total:profile.engenharia + profile.compra + profile.fornecimento + profile.logistica + profile.buffer }));

export const defaultSupplySettings = () => ({
  abc:{ limiteA:80, limiteB:95 },
  calendario:{ diasSemana:[1,2,3,4,5,6], feriados:[] },
  perfisLeadTime:DEFAULT_LEAD_PROFILES.map(item => ({ ...item })),
  alertasDias:[30,15,7,3,1],
});

const materialKey = item => String(item?.materialId || item?.insumoId || item?.codigoMaterial || item?.codigo || "").trim();
const analyticalInputs = item => {
  const direct = item?.materialId || item?.insumoId ? [item] : [];
  const nested = [item?.insumos, item?.analitico, item?.composicao?.itens, item?.composicaoAnalitica]
    .find(Array.isArray) || [];
  return nested.length ? nested : direct;
};

// Consolida somente relações explícitas (ID/código): nunca liga insumo e tarefa
// por semelhança de texto, pois isso comprometeria o planejamento oficial.
export const buildBudgetMaterialDemand = ({ budget, materials = [], tasks = [] }) => {
  const materialById = new Map(materials.map(item => [String(item.id), item]));
  const grouped = new Map();
  (budget?.itens || []).filter(item => item?.tipo !== "titulo" && !cancelled(item)).forEach(item => {
    const stageTasks = tasks.filter(task => task.etapaId && task.etapaId === item.etapaId && !cancelled(task));
    analyticalInputs(item).forEach(input => {
      const id = materialKey(input);
      const material = materialById.get(id);
      const code = String(input?.codigoRef || input?.codigo || material?.codigo || "").trim();
      // Sem materialId/código explícito o dado entra como pendência, mas não é
      // colocado em um plano de compra automaticamente.
      const reliable = Boolean(id && material) || Boolean(code && material && code === String(material.codigo || ""));
      const key = reliable ? String(material?.id || id) : `pendente:${item.id || item.codigo || item.descricao}:${code || "sem-codigo"}`;
      const quantity = number(item.quantidade) * number(input?.coeficiente ?? input?.coef ?? input?.quantidade ?? 1);
      const unitPrice = number(input?.precoUnitario ?? input?.precoUnit ?? input?.custoUnitario ?? material?.precoMedio);
      const old = grouped.get(key) || {
        materialId: reliable ? String(material?.id || id) : "", codigo:code, descricao:material?.descricao || input?.descricao || item?.descricao || "Insumo sem vínculo",
        unidade:input?.unidade || material?.unidade || item?.unidade || "un", quantidade:0, custoTotal:0,
        composicaoIds:[], itemOrcamentoIds:[], etapaIds:[], tarefaIds:[], vinculo:"confirmado", pendencias:[],
        forcadoParaA:Boolean(material?.curvaAEstrategica || material?.forcadoParaA), motivoCriticidade:material?.motivoCriticidade || "",
      };
      old.quantidade += quantity;
      old.custoTotal += quantity * unitPrice;
      [input?.composicaoId, item?.composicaoId].filter(Boolean).forEach(value => { if (!old.composicaoIds.includes(value)) old.composicaoIds.push(value); });
      if (item?.id && !old.itemOrcamentoIds.includes(item.id)) old.itemOrcamentoIds.push(item.id);
      if (item?.etapaId && !old.etapaIds.includes(item.etapaId)) old.etapaIds.push(item.etapaId);
      stageTasks.forEach(task => { if (!old.tarefaIds.includes(task.id)) old.tarefaIds.push(task.id); });
      if (!reliable) {
        old.vinculo = "pendente";
        old.pendencias.push({ tipo:"material", itemOrcamentoId:item.id || "", codigo:code, confianca:0, candidatos:materials.filter(m => code && String(m.codigo || "") === code).map(m => m.id) });
      }
      if (!stageTasks.length) old.pendencias.push({ tipo:"tarefa", etapaId:item.etapaId || "", confianca:0, candidatos:tasks.filter(t => t.etapaId === item.etapaId).map(t => t.id) });
      grouped.set(key, old);
    });
  });
  return [...grouped.values()].map(item => ({ ...item, quantidade:Number(item.quantidade.toFixed(6)), custoTotal:Number(item.custoTotal.toFixed(2)), tarefaIds:[...new Set(item.tarefaIds)], etapaIds:[...new Set(item.etapaIds)] }));
};

export const classifyAbc = (demands, limits = {}) => {
  const limiteA = number(limits.limiteA || 80), limiteB = number(limits.limiteB || 95);
  if (!(limiteA > 0 && limiteA < limiteB && limiteB <= 100)) throw new Error("Os limites ABC precisam respeitar 0 < A < B ≤ 100.");
  const sorted = [...demands].sort((a,b) => b.custoTotal - a.custoTotal || String(a.materialId || a.codigo).localeCompare(String(b.materialId || b.codigo)));
  const total = sorted.reduce((sum, item) => sum + number(item.custoTotal), 0);
  let accumulated = 0;
  return sorted.map((item, index) => {
    const before = total ? accumulated / total * 100 : 0;
    const percentage = total ? number(item.custoTotal) / total * 100 : 0;
    accumulated += number(item.custoTotal);
    const classeFinanceira = before < limiteA ? "A" : before < limiteB ? "B" : "C";
    const forced = item.forcadoParaA === true || item.estrategico === true;
    return { ...item, ordem:index + 1, percentual:percentage, percentualAcumulado:total ? accumulated / total * 100 : 0,
      classeFinanceira, classeFinal:forced ? "A" : classeFinanceira, forcadoParaA:forced,
      responsavelDecisao:item.responsavelDecisao || "" };
  });
};

export const createAbcSnapshot = ({ id, obraId, budget, baselineVersionId = "", demands, limits, actor = {}, now }) => {
  const createdAt = now || new Date().toISOString();
  const items = classifyAbc(demands, limits);
  return { id, obraId, budgetId:budget?.id || "", budgetVersionId:budget?.versionId || budget?.id || "", baselineVersionId,
    status:"proposta", version:1, engineVersion:SUPPLY_ENGINE_VERSION, limites:{ limiteA:number(limits?.limiteA || 80), limiteB:number(limits?.limiteB || 95) },
    itens:items, total:items.reduce((sum,item) => sum + item.custoTotal, 0), createdAt, createdById:actor.id || "", createdBy:actor.nome || "", updatedAt:createdAt, updatedById:actor.id || "", updatedBy:actor.nome || "", origem:"orcamento" };
};

const movementSign = type => ({ entrada:1, devolucao:1, ajuste:1, consumo:-1, perda:-1 }[type] || 0);
export const availableStock = ({ movements = [], reservations = [], obraId, materialId }) => {
  const physical = movements.filter(item => item.obraId === obraId && item.materialId === materialId && !cancelled(item))
    .reduce((sum,item) => sum + movementSign(item.tipo) * number(item.qtd), 0);
  const reserved = reservations.filter(item => item.materialId === materialId && item.obraId === obraId && !cancelled(item) && item.liberada !== true)
    .reduce((sum,item) => sum + number(item.quantidade ?? item.qtd), 0);
  return { fisico:Math.max(0, physical), reservado:Math.max(0, reserved), livre:Math.max(0, physical - reserved) };
};

export const validOpenOrderQuantity = ({ orders = [], obraId, materialId }) => orders
  .filter(order => order.obraId === obraId && !cancelled(order))
  .reduce((sum,order) => sum + (order.itens || []).filter(item => item.materialId === materialId && !cancelled(item))
    .reduce((subtotal,item) => subtotal + Math.max(0, number(item.qtd) - number(item.qtdRecebida)), 0), 0);

export const reverseSupplySchedule = ({ needDate, profile, calendar }) => {
  if (!needDate) return { etapas:[], inicioSugerido:"", disponibilidadeSugerida:"", totalDias:0 };
  const stages = [
    ["congelamento_especificacao", "Congelamento da especificação", 0], ["liberacao_projeto", "Liberação de projeto", profile?.engenharia],
    ["cotacao_e_compra", "Cotação, equalização e compra", profile?.compra], ["fornecimento", "Fabricação ou fornecimento", profile?.fornecimento],
    ["logistica", "Expedição, transporte e recebimento", profile?.logistica], ["buffer", "Inspeção e estoque de segurança", profile?.buffer],
  ];
  let cursor = needDate;
  const backwards = [...stages].reverse().map(([id,nome,dias]) => {
    const end = cursor, start = number(dias) > 0 ? subtractBusinessDays(end, Math.max(0, number(dias) - 1), calendar) : end;
    cursor = number(dias) > 0 ? subtractBusinessDays(start, 1, calendar) : start;
    return { id, nome, duracaoDias:number(dias), unidade:"uteis", dataSugeridaInicio:start, dataSugeridaFim:end,
      dataCompromissada:"", dataPrevista:"", dataRealizada:"", status:"nao_iniciado", origemData:"calculada" };
  }).reverse();
  return { etapas:backwards, inicioSugerido:backwards[0]?.dataSugeridaInicio || needDate, disponibilidadeSugerida:needDate,
    totalDias:backwards.reduce((sum,item) => sum + item.duracaoDias, 0) };
};

export const calculateSupplyRisk = ({ needDate, forecastDate, profile, calendar, hasSupplier, hasOrder, linkPending, stockSufficient }) => {
  const slack = needDate && forecastDate ? businessDaysBetweenInclusive(forecastDate, needDate, calendar) - 1 : null;
  const causes = [];
  if (linkPending) causes.push("vínculo com tarefa pendente");
  if (!stockSufficient) causes.push("estoque insuficiente");
  if (!hasSupplier) causes.push("fornecedor não definido");
  if (!hasOrder) causes.push("pedido não emitido");
  let risco = "baixo";
  if (slack === null || slack <= 0) risco = "critico";
  else if (slack <= 5 || !hasSupplier || !hasOrder) risco = "alto";
  else if (slack <= Math.max(10, Math.ceil(number(profile?.total) * .2))) risco = "medio";
  return { folgaDias:slack, risco, causas:causes };
};

export const createSupplyPlan = ({ id, obraId, snapshot, item, tasks = [], movements, reservations, orders, profile, calendar, stockSafety = 0, actor = {}, now }) => {
  const needDates = tasks.filter(task => item.tarefaIds.includes(task.id) && task.inicio && !cancelled(task)).map(task => task.inicio).sort();
  const needDate = needDates[0] || "";
  const stock = availableStock({ movements, reservations, obraId, materialId:item.materialId });
  const openOrder = validOpenOrderQuantity({ orders, obraId, materialId:item.materialId });
  const toBuy = Math.max(0, number(item.quantidade) + number(stockSafety) - stock.livre - openOrder);
  const schedule = reverseSupplySchedule({ needDate, profile, calendar });
  const order = (orders || []).filter(value => value.obraId === obraId && !cancelled(value) && (value.itens || []).some(line => line.materialId === item.materialId))[0];
  const forecast = order?.previsao || schedule.disponibilidadeSugerida;
  const risk = calculateSupplyRisk({ needDate, forecastDate:forecast, profile, calendar, hasSupplier:!!order?.fornecedorId, hasOrder:!!order, linkPending:item.vinculo !== "confirmado" || !needDate, stockSufficient:stock.livre + openOrder >= item.quantidade });
  const timestamp = now || new Date().toISOString();
  return { id, obraId, snapshotId:snapshot.id, materialId:item.materialId, codigo:item.codigo, descricao:item.descricao, unidade:item.unidade,
    budgetVersionId:snapshot.budgetVersionId, quantidadeOrcada:item.quantidade, quantidadeNecessaria:item.quantidade,
    estoqueSeguranca:number(stockSafety), estoqueFisico:stock.fisico, estoqueReservado:stock.reservado, estoqueDisponivel:stock.livre,
    quantidadePedidosAbertos:openOrder, quantidadeAComprar:toBuy, tarefaIds:item.tarefaIds, etapaIds:item.etapaIds, vinculo:item.vinculo,
    dataNecessidade:needDate, memoriaNecessidade:{ regra:"menor_inicio_tarefa_consumidora", tarefas:item.tarefaIds, datas:needDates },
    perfilLeadTimeId:profile?.id || "", perfilLeadTimeNome:profile?.nome || "Sem perfil", etapas:schedule.etapas,
    dataInicioSugerido:schedule.inicioSugerido, dataDisponibilidadeSugerida:schedule.disponibilidadeSugerida,
    dataCompromissada:order?.previsao || "", dataPrevista:forecast, dataRealizada:"", origemData:order?.previsao ? "pedido" : "calculada",
    fornecedorId:order?.fornecedorId || "", pedidoIds:order ? [order.id] : [], ...risk, status:"aberto", version:1,
    createdAt:timestamp, createdById:actor.id || "", createdBy:actor.nome || "", updatedAt:timestamp, updatedById:actor.id || "", updatedBy:actor.nome || "", origem:"curva_abc" };
};

export const detectDependencyCycle = (nodes = []) => {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const visiting = new Set(), visited = new Set();
  const visit = (id, trail) => {
    if (visiting.has(id)) return [...trail, id];
    if (visited.has(id) || !byId.has(id)) return null;
    visiting.add(id);
    for (const predecessor of byId.get(id).predecessoras || []) {
      const cycle = visit(predecessor, [...trail, id]); if (cycle) return cycle;
    }
    visiting.delete(id); visited.add(id); return null;
  };
  for (const node of nodes) { const cycle = visit(node.id, []); if (cycle) return cycle; }
  return null;
};
