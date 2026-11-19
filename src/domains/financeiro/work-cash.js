import { active } from "./facts.js";

export const workCashInternalTransfer = movement =>
  ["transferencia_empresa", "devolucao_empresa"].includes(movement?.naturezaEntrada);

export function workCashNature(movement) {
  if (movement.tipo === "devolucao") return "Devolução à empresa";
  if (movement.tipo === "despesa") return movement.pagamentoId || movement.notaFiscalId || movement.pedidoId || movement.medicaoId ? "Despesa vinculada" : "Despesa do caixa";
  return ({
    transferencia_empresa: "Transferência da empresa",
    entrada_caixa_obra: "Aporte do cliente",
    aporte_socio: "Aporte de sócio",
    adiantamento: "Adiantamento",
    emprestimo: "Empréstimo",
    recebimento_avulso: "Entrada avulsa",
    outra_entrada: "Outra entrada",
  })[movement.naturezaEntrada] || "Aporte registrado";
}

export const calculateWorkCash = (data, obraId) => {
  const movements = (data?.caixaObra || [])
    .filter(movement => movement?.obraId === obraId)
    .filter(active)
    .sort((left, right) => String(left?.data || "").localeCompare(String(right?.data || "")));
  let balance = 0;
  const withBalance = movements.map(movement => {
    balance += movement.tipo === "aporte"
      ? Number(movement.valor || 0)
      : -Number(movement.valor || 0);
    return { ...movement, saldoAcumulado:balance };
  });
  const totalAportes = movements
    .filter(movement => movement.tipo === "aporte")
    .reduce((total, movement) => total + Number(movement.valor || 0), 0);
  const totalDespesas = movements
    .filter(movement => movement.tipo === "despesa")
    .reduce((total, movement) => total + Number(movement.valor || 0), 0);
  const totalDevolucoes = movements
    .filter(movement => movement.tipo === "devolucao")
    .reduce((total, movement) => total + Number(movement.valor || 0), 0);

  return {
    movimentos:withBalance.reverse(),
    saldo:balance,
    totalAportes,
    totalDespesas,
    totalDevolucoes,
  };
};
