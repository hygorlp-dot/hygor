import { RECONCILIATION_COMMAND } from "./reconciliation-command.js";

const findById=(items,id)=>(items||[]).find(item=>String(item?.id||"")===String(id||""));
const normalize=value=>String(value||"").trim().toLowerCase();

const allowedRhPaymentTarget=(data,payload,actor)=>{
  const actorWorkId=String(actor?.obraId||"");
  if(payload?.targetType==="funcionario"){
    const employee=findById(data?.employees,payload.targetId);
    return Boolean(employee&&(!actorWorkId||String(employee.obraId||employee.obra||"")===actorWorkId));
  }
  if(payload?.targetType==="tituloFolha"){
    const title=findById(data?.titulosFolha,payload.targetId);
    if(!title)return false;
    const employee=findById(data?.employees,title.employeeId||title.funcionarioId||title.employee?.id);
    return !actorWorkId||String(title.obraId||employee?.obraId||employee?.obra||"")===actorWorkId;
  }
  return false;
};

const rhAllocationError=(data,payload,actor)=>{
  const transaction=findById(data?.transacoes,payload?.transactionId);
  if(!transaction||Number(transaction.valor||0)>=0)return "O RH só pode conciliar saídas bancárias de mão de obra.";
  const employee=findById(data?.employees,payload?.worker?.employeeId);
  if(!employee)return "Selecione um funcionário cadastrado para confirmar o pagamento.";
  const allocations=Array.isArray(payload?.allocations)?payload.allocations:[];
  if(!allocations.length)return "Informe a obra do pagamento de mão de obra.";
  const employeeWorkId=String(employee.obraId||employee.obra||"");
  const actorWorkId=String(actor?.obraId||"");
  for(const allocation of allocations){
    if(allocation?.destination!=="obra"||normalize(allocation?.category)!=="mao_obra"){
      return "O RH só pode apropriar pagamentos na categoria Mão de obra de uma obra.";
    }
    const workId=String(allocation?.obraId||"");
    if(!findById(data?.obras,workId))return "A obra selecionada não existe mais.";
    if(actorWorkId&&workId!==actorWorkId)return "Seu perfil não pode conciliar pagamentos de outra obra.";
    if(employeeWorkId&&workId!==employeeWorkId)return "O pagamento deve ser vinculado à obra atual do funcionário.";
  }
  return "";
};

// Política de comando aplicada no servidor. O RH recebe uma capacidade
// estreita: confirmar somente saídas de folha/mão de obra. Entradas,
// fornecedores, transferências, estornos e reversões continuam financeiras.
export const authorizeReconciliationCommand=(data,command={},actor={})=>{
  if(["admin","financeiro"].includes(actor?.role))return {ok:true};
  if(actor?.role!=="rh")return {ok:false,error:"Seu perfil não pode operar a conciliação."};

  const payload=command.payload||{};
  if(command.type===RECONCILIATION_COMMAND.CONFIRM_ALLOCATION){
    const error=rhAllocationError(data,payload,actor);
    return error?{ok:false,error}:{ok:true};
  }
  if([RECONCILIATION_COMMAND.CONFIRM_PAYMENT,RECONCILIATION_COMMAND.LINK_EXISTING_PAYMENT].includes(command.type)){
    return allowedRhPaymentTarget(data,payload,actor)
      ?{ok:true}
      :{ok:false,error:"O RH só pode conciliar pagamentos de funcionários ou títulos da folha."};
  }
  return {ok:false,error:"Esta operação exige o perfil Financeiro ou Administrador."};
};
