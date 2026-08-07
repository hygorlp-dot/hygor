import { active } from "./ledger.js";

const enabledFlag=value=>value===true||value===1||["true","1","sim"].includes(String(value||"").trim().toLowerCase());

export const workCashIsEnabled=(data,obraId)=>{
  const id=String(obraId||"");
  const project=(data?.obras||[]).find(item=>String(item?.id||"")===id);
  if(!project)return false;
  if([
    project.hasCaixa,
    project.caixaAtivo,
    project.possuiCaixa,
    project.caixaObraAtivo,
  ].some(enabledFlag))return true;
  return (data?.caixaObra||[])
    .some(movement=>String(movement?.obraId||"")===id&&active(movement));
};

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

  return {
    movimentos:withBalance.reverse(),
    saldo:balance,
    totalAportes,
    totalDespesas,
  };
};
