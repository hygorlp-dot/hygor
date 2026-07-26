const fold=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const digits=value=>String(value??"").replace(/\D/g,"");

// Destaque visual da fila: identifica somente uma chave PIX já cadastrada em
// funcionário. Não é uma baixa automática e não usa coincidência de valor;
// o operador continua confirmando a conciliação no cartão PIX.
export const findRegisteredEmployeePix=(transaction,employees=[])=>{
  if(Number(transaction?.valor||0)>=0)return null;
  const bankText=[transaction?.chavePix,transaction?.pixKey,transaction?.chave,transaction?.descricao].filter(Boolean).join(" ");
  const normalized=fold(bankText), numeric=digits(bankText);
  return (employees||[]).filter(employee=>employee?.active!==false).map(employee=>{
    const key=String(employee.pixKey||"").trim();
    if(!key)return null;
    const normalizedKey=fold(key), numericKey=digits(key);
    const matchesText=normalizedKey.length>=6&&normalized.includes(normalizedKey);
    const matchesNumeric=numericKey.length>=8&&numeric.includes(numericKey);
    return matchesText||matchesNumeric?{employee,match:matchesNumeric?"chave_documento":"chave_pix"}:null;
  }).find(Boolean)||null;
};

// A pré-seleção nunca nasce só do valor: a coincidência de valor com o ponto
// precisa ser acompanhada por uma evidência bancária (nome, titular ou chave)
// e por uma obra de destino conhecida.
export const isExactPixLaborMatch=(transaction,candidate)=>{
  if(Number(transaction?.valor||0)>=0||!transaction?.data||candidate?.periodoConfirmavel===false||Math.abs(Number(candidate?.divergencia||0))>=.01||!candidate?.emp?.obra)return false;
  const description=fold(transaction?.descricao);
  const identifiers=[candidate.emp.name,candidate.emp.pixHolder,candidate.emp.pixKey].filter(Boolean).map(fold);
  return identifiers.some(value=>value.length>=3&&description.includes(value))
    ||(candidate.emp.pixKey&&description.includes(fold(candidate.emp.pixKey).slice(0,8)));
};
