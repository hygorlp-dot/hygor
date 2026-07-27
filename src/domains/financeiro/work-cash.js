export const calculateWorkCash = (data, obraId) => {
  const movements = (data?.caixaObra || [])
    .filter(movement => movement?.obraId === obraId)
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

  return {
    movimentos:withBalance.reverse(),
    saldo:balance,
    totalAportes,
    totalDespesas,
  };
};
