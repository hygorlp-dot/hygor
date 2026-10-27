import { SINAL_MOV, baixarPorComposicao, calcSaldos, custoMedioPonderado, saldoDe } from "./calculations.js";

export const STOCK_COMMAND = Object.freeze({
  MATERIAL_MOVEMENT_RECORDED: "MOVIMENTO_ESTOQUE_REGISTRADO",
  SERVICE_EXECUTION_RECORDED: "EXECUCAO_SERVICO_REGISTRADA",
  MATERIAL_MOVEMENT_REVERSED: "MOVIMENTO_ESTOQUE_ESTORNADO",
  COMPOSITION_SAVED: "COMPOSICAO_SALVA",
  COMPOSITION_DELETED: "COMPOSICAO_EXCLUIDA",
});

export const STOCK_COMMAND_TYPES = new Set(Object.values(STOCK_COMMAND));
// Composições são o catálogo de serviços da empresa; movimentos pertencem a uma obra.
export const STOCK_COMPANY_COMMAND_TYPES = new Set([STOCK_COMMAND.COMPOSITION_SAVED, STOCK_COMMAND.COMPOSITION_DELETED]);

export const stockCommandObraId = (data = {}, command = {}) => {
  const payload = command?.payload || {};
  if (command?.type === STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED) return String(payload.movement?.obraId || "");
  if (command?.type === STOCK_COMMAND.SERVICE_EXECUTION_RECORDED) return String(payload.obraId || "");
  if (command?.type === STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED) return String((data?.movEstoque || []).find(item => item.id === payload.movementId)?.obraId || "");
  return "";
};

const fail = reason => ({ ok: false, reason });
const versionOf = item => Number(item?.version || 0);
const inactiveStatus = status => ["cancelado","cancelada","estornado","estornada"].includes(String(status||"").toLowerCase());

const STATUS_NOTA_SEM_EFEITO = ["cancelada","cancelado","estornada","estornado","rejeitada","rejeitado","rascunho"];

// Desfaz, no pedido, o recebimento que originou a entrada de estoque. O
// recebimento estornado sai de `recebimentos` (que alimenta histórico de
// preço e prazo) e fica guardado em `recebimentosEstornados`: nada se perde.
const reabrirRecebimentoDoPedido = (data, pedido, entrada, estornada, movimentos, command, now) => {
  if (pedido.status === "cancelado") return { ok: true, data: { ...data, movEstoque: movimentos } };
  const notaAtiva = (data.notasFiscais || []).some(nota =>
    String(nota.pedidoId || "") === String(pedido.id)
    && !STATUS_NOTA_SEM_EFEITO.includes(String(nota.status || "").toLowerCase()));
  if (notaAtiva) return fail("Este pedido já tem nota fiscal lançada. Cancele ou rejeite a nota antes de estornar o recebimento.");
  const depois = saldoDe(calcSaldos(movimentos), entrada.obraId, entrada.materialId);
  if (depois < -1e-6) return fail("Parte desse material já foi consumida na obra. Registre a devolução ou o ajuste de estoque antes de estornar o recebimento.");
  const item = (pedido.itens || []).find(x => String(x.id) === String(entrada.pedidoItemId || ""));
  if (!item) return { ok: true, data: { ...data, movEstoque: movimentos } };
  const fator = Number(entrada.fatorConversao) > 0 ? Number(entrada.fatorConversao) : 1;
  const qtdCompra = Number(entrada.qtdCompra ?? Number(entrada.qtd || 0) / fator);
  const recebimentoId = String(entrada.receiptId || "");
  const evento = (item.recebimentos || []).find(r => recebimentoId && String(r.id) === recebimentoId);
  const estornadoEvento = evento && {
    ...evento, estornadoEm: now, motivoEstorno: estornada.motivoEstorno,
    estornadoPorId: command.actorId || "", estornadoPor: command.actorName || "",
    movimentoEstoqueId: entrada.id,
  };
  const itens = (pedido.itens || []).map(x => x !== item ? x : {
    ...x,
    qtdRecebida: Math.max(0, Number(x.qtdRecebida || 0) - qtdCompra),
    recebimentos: (x.recebimentos || []).filter(r => r !== evento),
    recebimentosEstornados: [...(x.recebimentosEstornados || []),
      ...(estornadoEvento ? [estornadoEvento] : [{
        id: recebimentoId || entrada.id, qtd: qtdCompra, data: entrada.data || "",
        estornadoEm: now, motivoEstorno: estornada.motivoEstorno,
        estornadoPorId: command.actorId || "", estornadoPor: command.actorName || "",
        movimentoEstoqueId: entrada.id,
      }])],
  });
  const atualizado = { ...pedido, itens, version: versionOf(pedido) + 1, updatedAt: now };
  const materiais = (data.materiais || []).map(material => {
    if (material.id !== entrada.materialId) return material;
    const medio = custoMedioPonderado(movimentos, material.id);
    return medio == null ? material : { ...material, precoMedio: medio };
  });
  return {
    ok: true,
    data: {
      ...data, movEstoque: movimentos,
      pedidos: (data.pedidos || []).map(x => x.id === pedido.id ? atualizado : x),
      ...(data.materiais ? { materiais } : {}),
    },
  };
};

export const applyStockCommand = (data = {}, command = {}, now = new Date().toISOString()) => {
  if (!STOCK_COMMAND_TYPES.has(command.type)) return null;
  const movEstoque = Array.isArray(data.movEstoque) ? data.movEstoque : [];
  const composicoes = Array.isArray(data.composicoes) ? data.composicoes : [];

  if (command.type === STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED) {
    const raw = command.payload?.movement || {};
    const id = String(raw.id || "").trim();
    const obraId = String(raw.obraId || "").trim();
    const materialId = String(raw.materialId || "").trim();
    const qtd = Number(raw.qtd || 0);
    if (!id || !obraId || !materialId) return fail("Movimento de estoque sem identificação, obra ou material.");
    if (!(data.obras || []).some(item => String(item.id) === obraId)) return fail("A obra do movimento de estoque não existe.");
    if (!(qtd > 0)) return fail("A quantidade precisa ser maior que zero.");
    if (movEstoque.some(item => item.id === id)) return fail("Já existe um movimento de estoque com esta identificação.");
    const sinal = SINAL_MOV[raw.tipo] ?? 0;
    if (sinal < 0) {
      const disponivel = saldoDe(calcSaldos(movEstoque), obraId, materialId);
      if (qtd > disponivel + 0.0001) return fail(`Saldo insuficiente: há ${disponivel.toFixed(2)} disponível.`);
    }
    const movement = {
      id, obraId, materialId, tipo: raw.tipo,
      qtd, valorUnit: Number(raw.valorUnit || 0),
      data: raw.data || now.slice(0, 10),
      descricao: raw.descricao || "", transacaoId: "", servicoId: "",
      etapa: raw.etapa || "",
    };
    return { ok: true, entityId: id, data: { ...data, movEstoque: [...movEstoque, movement] } };
  }

  if (command.type === STOCK_COMMAND.SERVICE_EXECUTION_RECORDED) {
    const compositionId = String(command.payload?.compositionId || "").trim();
    const obraId = String(command.payload?.obraId || "").trim();
    const qtdExecutada = Number(command.payload?.qtdExecutada || 0);
    const entries = Array.isArray(command.payload?.entries) ? command.payload.entries : [];
    const comp = composicoes.find(item => item.id === compositionId);
    if (!comp) return fail("Composição não encontrada.");
    if (!obraId || !(data.obras || []).some(item => String(item.id) === obraId)) return fail("Selecione uma obra válida para o serviço.");
    if (!(qtdExecutada > 0)) return fail("Informe a quantidade executada.");
    const esperado = baixarPorComposicao(comp, qtdExecutada);
    if (entries.length !== esperado.length || entries.some(entry => {
      const ids = new Set(movEstoque.map(item => item.id));
      const item = esperado.find(x => x.materialId === entry.materialId);
      return !entry?.id || ids.has(entry.id) || !item || Math.abs(Number(entry.qtd || 0) - item.qtd) >= 1e-4;
    })) return fail("A composição foi alterada. Recarregue a tela e execute o serviço novamente.");
    const saldos = calcSaldos(movEstoque);
    const faltando = entries.filter(entry => Number(entry.qtd || 0) > saldoDe(saldos, obraId, entry.materialId) + 0.0001);
    if (faltando.length) return fail("Saldo insuficiente para baixar todos os insumos desta execução.");
    const novos = entries.map(entry => ({
      id: entry.id, obraId, materialId: entry.materialId, tipo: "consumo",
      qtd: Number(entry.qtd || 0), valorUnit: Number(entry.valorUnit || 0),
      data: entry.data || now.slice(0, 10), descricao: entry.descricao || "",
      transacaoId: "", servicoId: comp.id, etapa: entry.etapa || "",
    }));
    return { ok: true, entityId: comp.id, data: { ...data, movEstoque: [...movEstoque, ...novos] } };
  }

  if (command.type === STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED) {
    const id = String(command.payload?.movementId || "").trim();
    const current = movEstoque.find(item => item.id === id);
    if (!current) return fail("Movimento de estoque não encontrado.");
    if (inactiveStatus(current.status)) return fail("Este movimento já foi estornado.");
    const reason = String(command.payload?.reason || "").trim();
    if (!reason) return fail("Informe o motivo do estorno do movimento de estoque.");
    const reversed = {
      ...current, status: "estornado", motivoEstorno: reason, estornadoEm: now,
      estornadoPorId: command.actorId || "", estornadoPor: command.actorName || "",
    };
    const movimentos = movEstoque.map(item => item.id === id ? reversed : item);
    // Entrada que veio do recebimento de um pedido não é só estoque: o pedido
    // conta o que já chegou. Estornar só o movimento deixaria o pedido
    // "recebido" sem material na obra e sem como receber de novo.
    if (current.pedidoId && SINAL_MOV[current.tipo] > 0) {
      const pedido = (data.pedidos || []).find(item => String(item.id) === String(current.pedidoId));
      if (pedido) {
        const reaberto = reabrirRecebimentoDoPedido(data, pedido, current, reversed, movimentos, command, now);
        if (!reaberto.ok) return reaberto;
        return { ok: true, entityId: id, data: reaberto.data };
      }
    }
    return { ok: true, entityId: id, data: { ...data, movEstoque: movimentos } };
  }

  const raw = command.payload?.composition || {};
  if (command.type === STOCK_COMMAND.COMPOSITION_SAVED) {
    const id = String(raw.id || "").trim();
    if (!id) return fail("Composição sem identificação.");
    if (!String(raw.nome || "").trim()) return fail("Dê um nome ao serviço.");
    const itens = (raw.itens || []).filter(item => item.materialId && Number(item.coef) > 0)
      .map(item => ({ materialId: item.materialId, coef: Number(item.coef) }));
    if (!itens.length) return fail("Adicione ao menos um insumo com coeficiente.");
    const current = composicoes.find(item => item.id === id);
    if (versionOf(current) !== Number(command.expectedVersion || 0)) {
      return fail("Esta composição foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
    }
    const record = {
      ...(current || {}), ...raw, id, itens,
      unidade: raw.unidade || current?.unidade || "m2",
      version: versionOf(current) + 1,
    };
    const next = current
      ? composicoes.map(item => item.id === id ? record : item)
      : [...composicoes, record];
    return { ok: true, entityId: id, data: { ...data, composicoes: next } };
  }

  const id = String(command.payload?.compositionId || "").trim();
  const current = composicoes.find(item => item.id === id);
  if (!current) return fail("Composição não encontrada.");
  if (versionOf(current) !== Number(command.expectedVersion || 0)) {
    return fail("Esta composição foi alterada por outra pessoa. Atualize a tela antes de tentar novamente.");
  }
  return {
    ok: true, entityId: id,
    data: { ...data, composicoes: composicoes.filter(item => item.id !== id) },
  };
};
