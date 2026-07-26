const fold=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

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
