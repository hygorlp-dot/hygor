import { SINAL_MOV, TIPOS_MOV_AVULSO, baixarPorComposicao, calcSaldos, custoMedioPonderado, entradaDaTransferencia, saldoDe } from "./calculations.js";
import { isDateInClosedPeriod } from "../financeiro/workflows.js";
import { INVENTORY_STATUS, ajustesDoInventario, inventarioPendenteDaObra, linhasDoInventario, precisaAprovacao, resumoDoInventario } from "./inventory.js";
import { resolverTarefaDoConsumo } from "./task-allocation.js";

export const STOCK_COMMAND = Object.freeze({
  MATERIAL_MOVEMENT_RECORDED: "MOVIMENTO_ESTOQUE_REGISTRADO",
  SERVICE_EXECUTION_RECORDED: "EXECUCAO_SERVICO_REGISTRADA",
  MATERIAL_MOVEMENT_REVERSED: "MOVIMENTO_ESTOQUE_ESTORNADO",
  COMPOSITION_SAVED: "COMPOSICAO_SALVA",
  COMPOSITION_DELETED: "COMPOSICAO_EXCLUIDA",
  TRANSFER_SENT: "TRANSFERENCIA_ESTOQUE_ENVIADA",
  TRANSFER_RECEIVED: "TRANSFERENCIA_ESTOQUE_RECEBIDA",
  INVENTORY_SUBMITTED: "INVENTARIO_ESTOQUE_REGISTRADO",
  INVENTORY_DECIDED: "INVENTARIO_ESTOQUE_DECIDIDO",
});

export const STOCK_COMMAND_TYPES = new Set(Object.values(STOCK_COMMAND));
// Composições são o catálogo de serviços da empresa; movimentos pertencem a uma obra.
export const STOCK_COMPANY_COMMAND_TYPES = new Set([STOCK_COMMAND.COMPOSITION_SAVED, STOCK_COMMAND.COMPOSITION_DELETED]);

export const stockCommandObraId = (data = {}, command = {}) => {
  const payload = command?.payload || {};
  if (command?.type === STOCK_COMMAND.MATERIAL_MOVEMENT_RECORDED) return String(payload.movement?.obraId || "");
  if (command?.type === STOCK_COMMAND.SERVICE_EXECUTION_RECORDED) return String(payload.obraId || "");
  if (command?.type === STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED) return String((data?.movEstoque || []).find(item => item.id === payload.movementId)?.obraId || "");
  // Quem envia responde pela origem; quem confirma a chegada, pelo destino.
  if (command?.type === STOCK_COMMAND.TRANSFER_SENT) return String(payload.transfer?.obraOrigemId || "");
  if (command?.type === STOCK_COMMAND.TRANSFER_RECEIVED) return String((data?.movEstoque || []).find(item => item.id === payload.saidaId)?.obraDestinoId || "");
  if (command?.type === STOCK_COMMAND.INVENTORY_SUBMITTED) return String(payload.inventory?.obraId || "");
  if (command?.type === STOCK_COMMAND.INVENTORY_DECIDED) return String((data?.inventarios || []).find(item => item.id === payload.inventarioId)?.obraId || "");
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
    if (!TIPOS_MOV_AVULSO.some(tipo => tipo.v === raw.tipo)) return fail("Tipo de movimento inválido. Transferência entre obras tem fluxo próprio.");
    const sinal = SINAL_MOV[raw.tipo] ?? 0;
    if (sinal < 0) {
      const disponivel = saldoDe(calcSaldos(movEstoque), obraId, materialId);
      if (qtd > disponivel + 0.0001) return fail(`Saldo insuficiente: há ${disponivel.toFixed(2)} disponível.`);
    }
    const aplicacao = resolverTarefaDoConsumo(data, { obraId, tipo: raw.tipo, tarefaId: raw.tarefaId });
    if (!aplicacao.ok) return fail(aplicacao.reason);
    const movement = {
      ...aplicacao.campos,
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
    const aplicacao = resolverTarefaDoConsumo(data, { obraId, tipo: "consumo", tarefaId: command.payload?.tarefaId });
    if (!aplicacao.ok) return fail(aplicacao.reason);
    const saldos = calcSaldos(movEstoque);
    const faltando = entries.filter(entry => Number(entry.qtd || 0) > saldoDe(saldos, obraId, entry.materialId) + 0.0001);
    if (faltando.length) return fail("Saldo insuficiente para baixar todos os insumos desta execução.");
    const novos = entries.map(entry => ({
      id: entry.id, obraId, materialId: entry.materialId, tipo: "consumo",
      qtd: Number(entry.qtd || 0), valorUnit: Number(entry.valorUnit || 0),
      data: entry.data || now.slice(0, 10), descricao: entry.descricao || "",
      transacaoId: "", servicoId: comp.id, etapa: entry.etapa || "",
      ...aplicacao.campos,
    }));
    return { ok: true, entityId: comp.id, data: { ...data, movEstoque: [...movEstoque, ...novos] } };
  }

  if (command.type === STOCK_COMMAND.TRANSFER_SENT) {
    const raw = command.payload?.transfer || {};
    const id = String(raw.id || "").trim();
    const origem = String(raw.obraOrigemId || "").trim(), destino = String(raw.obraDestinoId || "").trim();
    const materialId = String(raw.materialId || "").trim();
    const qtd = Number(raw.qtd || 0);
    const quando = String(raw.data || now.slice(0, 10)).slice(0, 10);
    if (!id || !origem || !destino || !materialId) return fail("Transferência sem identificação, obras ou material.");
    const obraExiste = obraId => (data.obras || []).some(item => String(item.id) === obraId);
    if (!obraExiste(origem) || !obraExiste(destino)) return fail("A obra de origem ou de destino não existe.");
    if (origem === destino) return fail("Escolha uma obra de destino diferente da origem.");
    if (!(qtd > 0)) return fail("A quantidade precisa ser maior que zero.");
    if (movEstoque.some(item => item.id === id)) return fail("Já existe um movimento de estoque com esta identificação.");
    const disponivel = saldoDe(calcSaldos(movEstoque), origem, materialId);
    if (qtd > disponivel + 0.0001) return fail(`Saldo insuficiente na obra de origem: há ${disponivel.toFixed(2)} disponível.`);
    // O valor é sempre o custo médio do insumo calculado aqui, nunca o que a tela mandou.
    const material = (data.materiais || []).find(item => String(item.id) === materialId);
    const custo = custoMedioPonderado(movEstoque, materialId) ?? Number(material?.precoMedio || 0);
    // Sem custo, o material mudaria de obra sem levar o valor na DRE.
    if (!(Number(custo) > 0)) return fail("Este material não tem custo médio. Registre uma entrada com valor ou o preço médio no cadastro antes de transferir.");
    if (quando > now.slice(0, 10)) return fail("A data do envio não pode ser futura.");
    const saida = {
      id, obraId: origem, obraDestinoId: destino, materialId, tipo: "transferencia_saida",
      qtd, valorUnit: Math.round(Number(custo || 0) * 10000) / 10000, data: quando,
      descricao: String(raw.descricao || "").trim(), transacaoId: "", servicoId: "", etapa: "",
      enviadoEm: now, enviadoPorId: command.actorId || "", enviadoPor: command.actorName || "",
    };
    return { ok: true, entityId: id, data: { ...data, movEstoque: [...movEstoque, saida] } };
  }

  if (command.type === STOCK_COMMAND.TRANSFER_RECEIVED) {
    const saidaId = String(command.payload?.saidaId || "").trim();
    const id = String(command.payload?.entradaId || "").trim();
    const saida = movEstoque.find(item => item.id === saidaId && item.tipo === "transferencia_saida");
    if (!saida || inactiveStatus(saida.status)) return fail("Transferência não encontrada ou estornada.");
    if (entradaDaTransferencia(movEstoque, saida.id)) return fail("A chegada desta transferência já foi confirmada.");
    if (!id || movEstoque.some(item => item.id === id)) return fail("A chegada precisa de uma identificação nova.");
    const quando = String(command.payload?.data || now.slice(0, 10)).slice(0, 10);
    if (quando < String(saida.data || "")) return fail("A chegada não pode ser antes do envio.");
    // A data define o mês da DRE: não aceita lançar custo em mês futuro.
    if (quando > now.slice(0, 10)) return fail("A data da chegada não pode ser futura.");
    // A chegada move o custo na DRE das duas obras na data dela.
    if (isDateInClosedPeriod(data, quando)) return fail("Esta data está em um período financeiro fechado. Use uma data de período aberto.");
    const entrada = {
      id, obraId: saida.obraDestinoId, obraOrigemId: saida.obraId, transferenciaSaidaId: saida.id,
      materialId: saida.materialId, tipo: "transferencia_entrada", qtd: Number(saida.qtd || 0),
      valorUnit: Number(saida.valorUnit || 0), data: quando,
      descricao: saida.descricao || "", transacaoId: "", servicoId: "", etapa: "",
      recebidoEm: now, recebidoPorId: command.actorId || "", recebidoPor: command.actorName || "",
    };
    return { ok: true, entityId: id, data: { ...data, movEstoque: [...movEstoque, entrada] } };
  }

  if (command.type === STOCK_COMMAND.INVENTORY_SUBMITTED) {
    const raw = command.payload?.inventory || {};
    const id = String(raw.id || "").trim();
    const obraId = String(raw.obraId || "").trim();
    const quando = String(raw.data || now.slice(0, 10)).slice(0, 10);
    const motivo = String(raw.motivo || "").trim();
    const inventarios = Array.isArray(data.inventarios) ? data.inventarios : [];
    if (!id || inventarios.some(item => item.id === id)) return fail("O inventário precisa de uma identificação nova.");
    if (!(data.obras || []).some(item => String(item.id) === obraId)) return fail("A obra do inventário não existe.");
    if (quando > now.slice(0, 10)) return fail("A data da contagem não pode ser futura.");
    if (inventarioPendenteDaObra(data, obraId)) return fail("Esta obra já tem uma contagem aguardando o Administrador. Decida-a antes de contar de novo.");
    const contagens = Array.isArray(raw.contagens) ? raw.contagens : [];
    const materiais = new Set((data.materiais || []).map(item => String(item.id)));
    const vistos = new Set();
    for (const contagem of contagens) {
      const materialId = String(contagem?.materialId || "");
      const contado = Number(contagem?.contado);
      if (!materiais.has(materialId)) return fail("Um dos materiais contados não existe no cadastro.");
      if (vistos.has(materialId)) return fail("O mesmo material apareceu duas vezes na contagem.");
      if (!Number.isFinite(contado) || contado < 0) return fail("A quantidade contada precisa ser zero ou mais.");
      vistos.add(materialId);
    }
    if (!contagens.length) return fail("Informe a quantidade contada de ao menos um material.");
    // O saldo do sistema é o do servidor, agora; nunca o que a tela mostrou.
    const linhas = linhasDoInventario(data, obraId, contagens);
    const resumo = resumoDoInventario(linhas);
    if (resumo.itensComDiferenca && !motivo) return fail("Informe o motivo das diferenças encontradas na contagem.");
    const aguardando = resumo.itensComDiferenca > 0 && precisaAprovacao(data, resumo, command.actorRole);
    const inventario = {
      id, obraId, data: quando, motivo, linhas, ...resumo,
      status: aguardando ? INVENTORY_STATUS.AGUARDANDO : INVENTORY_STATUS.APLICADO,
      criadoEm: now, criadoPorId: command.actorId || "", criadoPor: command.actorName || "",
      ...(aguardando ? {} : { decididoEm: now, decididoPorId: command.actorId || "", decididoPor: command.actorName || "" }),
    };
    let movimentos = movEstoque;
    if (!aguardando) {
      const ajustes = ajustesDoInventario(data, inventario);
      if (!ajustes.ok) return fail(ajustes.reason);
      movimentos = [...movEstoque, ...ajustes.movimentos];
      inventario.movimentoIds = ajustes.movimentos.map(item => item.id);
    }
    return { ok: true, entityId: id, data: { ...data, movEstoque: movimentos, inventarios: [...inventarios, inventario] } };
  }

  if (command.type === STOCK_COMMAND.INVENTORY_DECIDED) {
    if (command.actorRole !== "admin") return fail("Somente o Administrador decide uma contagem acima da alçada.");
    const inventarios = Array.isArray(data.inventarios) ? data.inventarios : [];
    const inventario = inventarios.find(item => item.id === String(command.payload?.inventarioId || ""));
    if (!inventario || inventario.status !== INVENTORY_STATUS.AGUARDANDO) return fail("Contagem não encontrada ou já decidida.");
    const aprovar = command.payload?.aprovar === true;
    const motivoDecisao = String(command.payload?.motivo || "").trim();
    if (!aprovar && !motivoDecisao) return fail("Informe o motivo da recusa.");
    const decisao = { decididoEm: now, decididoPorId: command.actorId || "", decididoPor: command.actorName || "", motivoDecisao };
    if (!aprovar) {
      return { ok: true, entityId: inventario.id, data: { ...data, inventarios: inventarios.map(item =>
        item.id === inventario.id ? { ...item, ...decisao, status: INVENTORY_STATUS.REJEITADO } : item) } };
    }
    const ajustes = ajustesDoInventario(data, inventario);
    if (!ajustes.ok) return fail(ajustes.reason);
    return { ok: true, entityId: inventario.id, data: {
      ...data, movEstoque: [...movEstoque, ...ajustes.movimentos],
      inventarios: inventarios.map(item => item.id === inventario.id
        ? { ...item, ...decisao, status: INVENTORY_STATUS.APLICADO, movimentoIds: ajustes.movimentos.map(mov => mov.id) } : item),
    } };
  }

  if (command.type === STOCK_COMMAND.MATERIAL_MOVEMENT_REVERSED) {
    const id = String(command.payload?.movementId || "").trim();
    const current = movEstoque.find(item => item.id === id);
    if (!current) return fail("Movimento de estoque não encontrado.");
    if (inactiveStatus(current.status)) return fail("Este movimento já foi estornado.");
    const reason = String(command.payload?.reason || "").trim();
    if (!reason) return fail("Informe o motivo do estorno do movimento de estoque.");
    // Transferência: a chegada confirmada já moveu o custo na DRE das duas obras.
    // E1.2: ajuste de inventário faz parte de uma contagem; corrige-se contando de novo.
    if (current.inventarioId) return fail("Ajuste de inventário não se estorna sozinho. Faça uma nova contagem.");
    if (current.tipo === "transferencia_saida" && entradaDaTransferencia(movEstoque, current.id)) {
      return fail("A obra de destino já confirmou a chegada. Estorne primeiro a chegada no destino.");
    }
    if (current.tipo === "transferencia_entrada") {
      if (isDateInClosedPeriod(data, current.data)) return fail("A chegada é de um período financeiro fechado e não pode ser estornada.");
      const semEntrada = movEstoque.map(item => item.id === id ? { ...item, status: "estornado" } : item);
      if (saldoDe(calcSaldos(semEntrada), current.obraId, current.materialId) < -1e-6) {
        return fail("Parte desse material já foi usada na obra de destino. Registre a devolução ou o ajuste antes de estornar a chegada.");
      }
    }
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
