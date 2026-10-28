// Aba "Pedidos" (R4): quais ações o cartão mostra e como a lista se filtra.
// Tudo puro, para a tela e os testes usarem a mesma regra. Aqui só se decide
// o que aparece e onde; quem pode executar continua sendo o servidor.
import { statusPedido } from "./calculations";

// `ids` + `origem` (R5): pedidos exatos de uma exceção do painel, com o nome dela.
export const FILTROS_PEDIDOS_VAZIOS = Object.freeze({ status: "todos", fornecedorId: "", obraId: "", atrasados: false, ids: null, origem: "" });

export const OPCOES_STATUS_PEDIDO = Object.freeze([
  { value: "todos", label: "Todos os status" },
  { value: "a_receber", label: "A receber (enviado ou parcial)" },
  { value: "rascunho", label: "Rascunho" },
  { value: "enviado", label: "Enviado" },
  { value: "parcial", label: "Parcial" },
  { value: "recebido", label: "Recebido" },
  { value: "cancelado", label: "Cancelado" },
]);

const aguardandoEntrega = status => status === "enviado" || status === "parcial";

export const filtrosPedidosAtivos = filtros =>
  Object.keys(FILTROS_PEDIDOS_VAZIOS).some(chave => (filtros?.[chave] ?? FILTROS_PEDIDOS_VAZIOS[chave]) !== FILTROS_PEDIDOS_VAZIOS[chave]);

const combinaStatus = (status, filtro) =>
  !filtro || filtro === "todos" || (filtro === "a_receber" ? aguardandoEntrega(status) : status === filtro);

// atrasadoIds: Set com o id dos pedidos que `pedidosEmAtraso` apontou.
export function filtrarPedidos(pedidos, filtros = FILTROS_PEDIDOS_VAZIOS, atrasadoIds = new Set()) {
  return (pedidos || []).filter(pedido =>
    combinaStatus(statusPedido(pedido), filtros.status)
    && (!filtros.fornecedorId || pedido.fornecedorId === filtros.fornecedorId)
    && (!filtros.obraId || pedido.obraId === filtros.obraId)
    && (!filtros.atrasados || atrasadoIds.has(pedido.id))
    && (!Array.isArray(filtros.ids) || filtros.ids.includes(pedido.id)));
}

export function contarPedidosPorStatus(pedidos) {
  const total = { todos: 0, a_receber: 0, rascunho: 0, enviado: 0, parcial: 0, recebido: 0, cancelado: 0 };
  (pedidos || []).forEach(pedido => {
    const status = statusPedido(pedido);
    total.todos += 1;
    total[status] = (total[status] || 0) + 1;
    if (aguardandoEntrega(status)) total.a_receber += 1;
  });
  return total;
}

// No máximo UMA ação principal por cartão; o resto vai para o menu "⋯" e as
// destrutivas ficam num grupo à parte, no fim dele.
//   rascunho  → revisar (ainda não foi para o fornecedor)
//   enviado / parcial → receber material
//   recebido / cancelado → nenhuma
export function acoesDoPedido({ pedido, podeEnviar = false, podeExcluir = false, atrasado = false, temTelefone = false, liberadoParaReceber = true }) {
  const status = statusPedido(pedido);
  const encerrado = status === "cancelado" || status === "recebido";
  const emEntrega = aguardandoEntrega(status);
  const jaEnviado = (pedido.envios || []).length > 0;

  const principal = status === "rascunho" ? { id: "revisar", label: "Revisar pedido" }
    : emEntrega ? { id: "receber", label: "Receber material" }
    : null;

  const comuns = [];
  if (emEntrega) comuns.push({ id: "editar", label: "Editar pedido" });
  if (emEntrega && podeEnviar) comuns.push({ id: "enviar", label: jaEnviado ? "Reenviar ao fornecedor" : "Enviar ao fornecedor" });
  if (emEntrega && podeEnviar && !pedido.aceiteFornecedor?.nome) comuns.push({ id: "aceite", label: "Registrar aceite" });
  if (emEntrega && !liberadoParaReceber) comuns.push({ id: "saldo", label: "Ver saldo em aberto" });
  if (atrasado && temTelefone && !encerrado) comuns.push({ id: "cobrar", label: "Cobrar entrega" });
  if (!encerrado && temTelefone) comuns.push({ id: "whatsapp", label: "Conversar no WhatsApp" });

  const destrutivas = [];
  if (!encerrado) destrutivas.push({ id: "cancelar", label: "Cancelar pedido" });
  if (podeExcluir) destrutivas.push({ id: "excluir", label: "Excluir definitivamente" });

  return { principal, comuns, destrutivas };
}
