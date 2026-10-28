// Contexto de apresentação dos vínculos confirmados. Depois da conciliação,
// o documento deixa de ser candidato, mas sua categoria/obra continuam sendo
// a fonte do filtro e da busca. Não recalcula valores ou regras do DRE.
export const confirmedClassificationContext = (data, transaction) => {
  const categories = new Set(), works = new Set(), descriptions = new Set();
  const definitions = {
    nota:["notasFiscais","material"], pagamentoNota:["notasFiscais","material"], nota_fiscal:["notasFiscais","material"], pagamento_nota:["notasFiscais","material"],
    pedido:["pedidos","material"], pagamentoPedido:["pedidos","material"],
    tituloFolha:["titulosFolha","mao_obra"], liquidacaoFolha:["titulosFolha","mao_obra"], titulo_folha:["titulosFolha","mao_obra"],
    funcionario:["employees","mao_obra"], pagamentoFolha:["pagamentosFolha","mao_obra"],
    despesasEmpresa:["despesasEmpresa","outros"], despesa_empresa:["despesasEmpresa","outros"],
    outrasDesp:["outrasDesp","outros"], outra_despesa:["outrasDesp","outros"],
    payments:["payments","receita"], recebimento_avulso:["payments","receita"],
    medicao:["medicoes","receita"], recebimentoMedicao:["medicoes","receita"],
    entradaContrato:["contratos","receita"],
    medicaoTerc:["medicoesTerc","terceirizado"], medicao_terceiro:["medicoesTerc","terceirizado"],
    terceiro:["terceirizados","terceirizado"], pagamentoTerceiro:["pagsTerceiros","terceirizado"], pagsTerceiros:["pagsTerceiros","terceirizado"], pagamento_terceiro_legado:["pagsTerceiros","terceirizado"],
    caixaObra:["caixaObra","outros"], caixa_obra:["caixaObra","outros"],
    rescisao:["rescisoes","mao_obra"],
  };
  const readSource = (type, id) => {
    if(type==="pagamento_folha")return readSource((data.titulosFolha||[]).some(item=>String(item.id)===String(id))?"tituloFolha":"pagamentoFolha",id);
    if(type==="pagamento_terceiro")return readSource((data.medicoesTerc||[]).some(item=>String(item.id)===String(id))?"medicaoTerc":"pagamentoTerceiro",id);
    const definition=definitions[type];
    if(!definition)return;
    const [collection,fallback]=definition;
    const rows=collection==="contratos"?data.comercial?.contratos:data[collection];
    const item=(rows||[]).find(row=>String(row.id)===String(id));
    if(!item)return;
    const raw=item.categoria||item.category||(collection==="caixaObra"&&item.tipo==="aporte"?"aporte_cliente":fallback);
    categories.add(["faturamento","recebimento_avulso"].includes(raw)?"receita":raw);
    [item.obraId,item.obra,...(item.rateiosPorObra||[]).map(row=>row.obraId),...(item.rateios||[]).map(row=>row.obraId)].filter(Boolean).forEach(work=>works.add(work));
    [item.descricao,item.description,item.name,item.nome,item.fornecedorNome,item.funcionarioNome,item.contratante,item.numero].filter(Boolean).forEach(text=>descriptions.add(text));
    if(item.employeeId){
      const employee=(data.employees||[]).find(row=>row.id===item.employeeId);
      if(employee?.name)descriptions.add(employee.name);
      if(!item.obraId&&!item.rateiosPorObra?.length&&employee?.obra)works.add(employee.obra);
    }
    if(item.fornecedorId){
      const supplier=(data.fornecedores||[]).find(row=>row.id===item.fornecedorId);
      if(supplier?.nome)descriptions.add(supplier.nome);
    }
  };
  const link=transaction.vinculo;
  if(link)readSource(link.tipo,link.id);
  (transaction.gerados||[]).filter(item=>item&&typeof item==="object").forEach(item=>readSource(item.tipo,item.entidadeId||item.id));
  (data.reconciliationLinks||[]).filter(item=>item.transactionId===transaction.id&&item.status==="active").forEach(item=>{
    readSource(item.sourceType,item.sourceId);
    if(item.obraId)works.add(item.obraId);
  });
  if(link?.tipo==="conciliacao_multipla"){
    const multiple=(data.conciliacoes||[]).find(item=>item.id===link.id);
    (multiple?.itens||[]).forEach(item=>readSource(item.tipo,item.entidadeId||item.id));
  }
  if(transaction.recebedorMaoObra?.employeeId)readSource("funcionario",transaction.recebedorMaoObra.employeeId);
  return {categories:[...categories],works:[...works],text:[...descriptions].join(" ")};
};
