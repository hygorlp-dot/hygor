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

// O cartão PIX e a fila precisam falar a mesma linguagem. Quando a evidência
// bancária, o ponto, o valor e a obra coincidem, devolvemos uma candidata
// padronizada para a fila -- ainda sem efetivar nenhuma conciliação.
export const createExactPixLaborCandidate=(transaction,suggestion)=>{
  if(!isExactPixLaborMatch(transaction,suggestion))return null;
  const employee=suggestion.emp;
  return {
    tipo:"maoObraPonto",
    entidadeId:employee.id,
    obraId:employee.obra,
    titulo:`Mão de obra · ${employee.name||employee.nome||"Operário"}`,
    subtitulo:`${suggestion.periodoPonto||"Período do ponto"} · ${Number(suggestion.diasTrabalhados||0)} dia(s)`,
    contraparte:employee.pixHolder||employee.name||"",
    valorOriginalCentavos:Math.round(Math.abs(Number(transaction?.valor||0))*100),
    saldoCentavos:Math.round(Math.abs(Number(transaction?.valor||0))*100),
    score:100,
    confianca:"forte",
    motivos:[...new Set([...(suggestion.motivos||[]),"titular/chave PIX e obra confirmados"])],
    alertas:[],
    bloqueios:[],
    podeVincular:false,
    podeRegistrarPagamento:false,
    metadados:{
      employeeId:employee.id,
      obraId:employee.obra,
      periodoPonto:suggestion.periodoPonto||"",
      esperado:Number(suggestion.esperado||0),
      evidencias:["PIX","ponto","obra"],
    },
  };
};
