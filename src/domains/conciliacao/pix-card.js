import { candidata, FAIXA_CONFIANCA } from "./matching.js";

const fold=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const digits=value=>String(value??"").replace(/\D/g,"");
const words=value=>fold(value).split(/[^a-z0-9]+/).filter(word=>word.length>=3);
const hasPersonNameEvidence=(bankText,personName)=>{
  const normalizedName=fold(personName).trim();
  if(!normalizedName)return false;
  if(normalizedName.length>=5&&bankText.includes(normalizedName))return true;
  const nameWords=words(personName), bankWords=new Set(words(bankText));
  // Um primeiro nome isolado é comum demais para conciliar dinheiro. Exigimos
  // pelo menos dois termos significativos (ex.: "Iveson" + "Alves").
  return nameWords.length>=2&&nameWords.filter(word=>bankWords.has(word)).length>=2;
};

export const hasEmployeePixNameEvidence=(transaction,employee)=>{
  const bankText=fold([transaction?.chavePix,transaction?.pixKey,transaction?.chave,transaction?.descricao].filter(Boolean).join(" "));
  return hasPersonNameEvidence(bankText,employee?.name||employee?.nome)
    ||hasPersonNameEvidence(bankText,employee?.pixHolder);
};

// A chave/documento só ganha destaque quando a descrição do banco também
// comprova o nome do operário ou do titular PIX. Número isolado não é prova.
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
    const nameEvidence=hasEmployeePixNameEvidence(transaction,employee);
    return (matchesText||matchesNumeric)&&nameEvidence?{employee,match:matchesNumeric?"chave_documento_e_nome":"chave_pix_e_nome"}:null;
  }).find(Boolean)||null;
};

// A pré-seleção nunca nasce só do valor: a coincidência de valor com o ponto
// precisa ser acompanhada por uma evidência bancária (nome, titular ou chave)
// e por uma obra de destino conhecida.
export const isExactPixLaborMatch=(transaction,candidate)=>{
  if(Number(transaction?.valor||0)>=0||!transaction?.data||candidate?.periodoConfirmavel===false||Math.abs(Number(candidate?.divergencia||0))>=.01||!candidate?.emp?.obra)return false;
  return hasEmployeePixNameEvidence(transaction,candidate.emp);
};

// O cartão PIX e a fila precisam falar a mesma linguagem. Quando a evidência
// bancária, o ponto, o valor e a obra coincidem, devolvemos uma candidata
// padronizada para a fila -- ainda sem efetivar nenhuma conciliação.
export const createExactPixLaborCandidate=(transaction,suggestion)=>{
  if(!isExactPixLaborMatch(transaction,suggestion))return null;
  const employee=suggestion.emp;
  const valorCentavos=Math.round(Math.abs(Number(transaction?.valor||0))*100);
  const candidate=candidata({
    tipo:"maoObraPonto",
    entidadeId:employee.id,
    obraId:employee.obra,
    titulo:`Mão de obra · ${employee.name||employee.nome||"Operário"}`,
    subtitulo:`${suggestion.periodoPonto||"Período do ponto"} · ${Number(suggestion.diasTrabalhados||0)} dia(s)`,
    contraparte:employee.pixHolder||employee.name||"",
    valorOriginalCentavos:valorCentavos,
    saldoCentavos:valorCentavos,
    metadados:{
      employeeId:employee.id,
      obraId:employee.obra,
      periodoPonto:suggestion.periodoPonto||"",
      esperado:Number(suggestion.esperado||0),
      evidencias:["PIX","ponto","obra"],
    },
  });
  candidate.score=100;
  candidate.confianca=FAIXA_CONFIANCA.FORTE;
  candidate.motivos=[...new Set([...(suggestion.motivos||[]),"titular/chave PIX e obra confirmados"])];
  return candidate;
};
