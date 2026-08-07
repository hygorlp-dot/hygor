import { active } from "./ledger.js";

const enabledFlag=value=>value===true||value===1||["true","1","sim"].includes(String(value||"").trim().toLowerCase());
const normalizedReference=value=>String(value??"").trim().toLocaleLowerCase("pt-BR");
const projectReferences=project=>[
  project?.id,project?.obraId,project?.codigo,project?.code,project?.name,project?.nome,
].map(normalizedReference).filter(Boolean);
const workReferences=(data,obraId)=>{
  const target=normalizedReference(obraId);
  const project=(data?.obras||[]).find(item=>projectReferences(item).includes(target));
  return new Set(project?[target,...projectReferences(project)]:[target]);
};

export const workCashIsEnabled=(data,obraId)=>{
  const references=workReferences(data,obraId);
  const project=(data?.obras||[]).find(item=>projectReferences(item).some(value=>references.has(value)));
  if(project&&[
    project.hasCaixa,
    project.caixaAtivo,
    project.possuiCaixa,
    project.caixaObraAtivo,
  ].some(enabledFlag))return true;
  return (data?.caixaObra||[])
    .some(movement=>references.has(normalizedReference(movement?.obraId))&&active(movement));
};

export const calculateWorkCash = (data, obraId) => {
  const references=workReferences(data,obraId);
  const movements = (data?.caixaObra || [])
    .filter(movement => references.has(normalizedReference(movement?.obraId)))
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
