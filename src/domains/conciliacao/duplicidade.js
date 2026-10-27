// Aviso de duplicidade na apropriação do extrato (D-E).
//
// Conciliar uma saída do extrato direto em obra/categoria (CONFIRM_ALLOCATION)
// lança o custo sem passar por nota nem pedido. Se a nota fiscal do mesmo
// fornecedor chegar depois, o custo entra duas vezes. Antes de apropriar, a
// tela avisa quando já existe nota ou pedido em aberto de valor igual na obra.
// É só um aviso: quem concilia decide, nada é bloqueado nem alterado.
import { saldoPagamentoPedido } from "../compras/calculations.js";
import { pedidoVivo } from "../compras/purchase-position.js";
import { notaSemEfeito, saldoPagamentoNota } from "../financeiro/payables.js";
import { igualCentavos, semAcento } from "./calculations.js";

const tokens = texto => semAcento(texto).split(/[^a-z0-9]+/).filter(parte => parte.length >= 4);

const mesmoFornecedor = (transacao, nome) => {
  const alvo = new Set(tokens(`${transacao?.contraparteNome || ""} ${transacao?.descricao || ""}`));
  return tokens(nome).some(parte => alvo.has(parte));
};

export const possiveisDuplicidades = (data, transacao, alocacoes = []) => {
  const valor = Math.abs(Number(transacao?.valor || 0));
  if (!(Number(transacao?.valor) < 0) || !(valor > 0)) return [];
  const obras = new Set((alocacoes || [])
    .filter(item => item.destination === "obra" && item.obraId)
    .map(item => String(item.obraId)));
  if (!obras.size) return [];
  const fornecedor = id => (data?.fornecedores || []).find(item => String(item.id) === String(id));
  const avisos = [];
  for (const nota of data?.notasFiscais || []) {
    if (notaSemEfeito(nota) || nota.status === "rascunho" || !obras.has(String(nota.obraId))) continue;
    if ((nota.pagamentos || []).some(pagamento => pagamento.transacaoId === transacao.id)) continue;
    const saldo = saldoPagamentoNota(nota);
    if (saldo <= 0.01 || !igualCentavos(saldo, valor)) continue;
    const nome = nota.fornecedorNome || fornecedor(nota.fornecedorId)?.nome || "";
    avisos.push({
      tipo: "nota", id: nota.id, documento: `NF ${nota.numero || nota.id}`, valor: saldo, fornecedor: nome,
      provavelmenteOMesmo: mesmoFornecedor(transacao, nome),
    });
  }
  for (const pedido of data?.pedidos || []) {
    if (!pedidoVivo(pedido) || !obras.has(String(pedido.obraId))) continue;
    // Pedido que já tem nota ativa é conciliado pela nota; o aviso é da nota.
    if ((data?.notasFiscais || []).some(nota => nota.pedidoId === pedido.id && !notaSemEfeito(nota))) continue;
    const saldo = saldoPagamentoPedido(pedido);
    if (saldo <= 0.01 || !igualCentavos(saldo, valor)) continue;
    const nome = fornecedor(pedido.fornecedorId)?.nome || "";
    avisos.push({
      tipo: "pedido", id: pedido.id, documento: `Pedido ${pedido.numero || pedido.id}`, valor: saldo, fornecedor: nome,
      provavelmenteOMesmo: mesmoFornecedor(transacao, nome),
    });
  }
  return avisos.sort((a, b) => Number(b.provavelmenteOMesmo) - Number(a.provavelmenteOMesmo));
};

export const textoAvisoDuplicidade = avisos => {
  const lista = avisos.slice(0, 3).map(aviso =>
    `• ${aviso.documento}${aviso.fornecedor ? ` · ${aviso.fornecedor}` : ""} (saldo ${aviso.valor.toFixed(2).replace(".", ",")})`).join("\n");
  return `Já existe documento em aberto com este mesmo valor na obra:\n${lista}\n\n`
    + "Apropriar o extrato direto como custo pode duplicar o gasto quando a nota chegar. "
    + "O correto costuma ser conciliar com o documento. Apropriar mesmo assim?";
};
