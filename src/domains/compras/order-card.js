// Cartão do pedido (R4): uma ação principal conforme a situação, ações comuns
// visíveis, ações raras e destrutivas num menu "⋯", e os filtros da lista.
//
// Só organiza o que a tela oferece; quem decide se a ação vale continua sendo
// o servidor (comandos de pedido, cancelamento, envio e aceite).
import { statusPedido } from "./calculations.js";

export const ROTULO_ACAO_PEDIDO = Object.freeze({
  receber: "Receber material",
  enviar: "Enviar ao fornecedor",
  reenviar: "Reenviar ao fornecedor",
  registrar_aceite: "Registrar aceite",
  cobrar: "Cobrar entrega",
  editar: "Editar pedido",
  saldo: "Saldo em aberto",
  whatsapp: "Mensagem no WhatsApp",
  cancelar: "Cancelar pedido",
  excluir: "Excluir definitivamente",
});

// `contexto`: {enviadoAoFornecedor, aceito, liberadoParaReceber, atrasado,
// temTelefone, podeEnviar, podeExcluir}.
export const acoesDoPedido = (status, contexto = {}) => {
  const {
    enviadoAoFornecedor = false, aceito = false, liberadoParaReceber = true, atrasado = false,
    temTelefone = false, podeEnviar = false, podeExcluir = false,
  } = contexto;
  const destrutivas = [];
  if (!["cancelado", "recebido"].includes(status)) destrutivas.push("cancelar");
  if (podeExcluir) destrutivas.push("excluir");

  if (status === "rascunho") {
    return { principal: "editar", comuns: [], menu: temTelefone ? ["whatsapp"] : [], destrutivas };
  }
  if (status !== "enviado" && status !== "parcial") {
    return { principal: null, comuns: [], menu: [], destrutivas };
  }

  const podeCobrar = atrasado && temTelefone;
  const principal = podeCobrar ? "cobrar" : podeEnviar && !enviadoAoFornecedor ? "enviar" : "receber";
  const comuns = [];
  if (principal !== "receber") comuns.push("receber");
  comuns.push("editar");
  if (!liberadoParaReceber) comuns.push("saldo");
  const menu = [];
  if (podeEnviar && principal !== "enviar") menu.push(enviadoAoFornecedor ? "reenviar" : "enviar");
  if (podeEnviar && !aceito) menu.push("registrar_aceite");
  if (temTelefone) menu.push("whatsapp");
  return { principal, comuns, menu, destrutivas };
};

export const FILTROS_PEDIDO_VAZIOS = Object.freeze({ status: "", fornecedorId: "", atraso: "", obraId: "" });

// `atrasoDe`: mapa pedidoId → atraso (o mesmo de `pedidosEmAtraso`).
export const filtrarPedidos = (pedidos, filtros = FILTROS_PEDIDO_VAZIOS, atrasoDe = {}) =>
  (pedidos || []).filter(pedido =>
    (!filtros.status || statusPedido(pedido) === filtros.status)
    && (!filtros.fornecedorId || String(pedido.fornecedorId || "") === String(filtros.fornecedorId))
    && (!filtros.obraId || String(pedido.obraId || "") === String(filtros.obraId))
    && (filtros.atraso !== "atrasados" || Boolean(atrasoDe[pedido.id])));

export const filtrosPedidoAtivos = filtros =>
  Object.values(filtros || {}).filter(Boolean).length;
