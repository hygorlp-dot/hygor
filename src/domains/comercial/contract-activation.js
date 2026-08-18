const fail=error=>({ok:false,error});
const dateOnly=value=>String(value||"").slice(0,10);
const userName=(data,id)=>(data?.usuarios||[]).find(item=>item.id===id)?.nome||"";
const addMonths=(iso,months)=>{
  const base=/^\d{4}-\d{2}-\d{2}$/.test(String(iso||""))?new Date(`${iso}T12:00:00`):new Date();
  const day=base.getDate();
  const target=new Date(base.getFullYear(),base.getMonth()+Number(months||0),1,12);
  const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
  target.setDate(Math.min(day,last));
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}-${String(target.getDate()).padStart(2,"0")}`;
};
const requiredIds=(ids,hasEntry,count)=>[
  ids.clientId,ids.obraId,ids.saleId,ids.commissionId,ids.kickoffId,ids.postSaleId,
  ...(hasEntry?[ids.entryMeasurementId,ids.entryReceiptId]:[]),
  ...((ids.installmentMeasurementIds||[]).slice(0,count)),
].every(Boolean)&&(ids.installmentMeasurementIds||[]).length>=count;

export const activateCommercialContract=({
  data={},contractId="",obraId="",ids={},actor={},now=new Date().toISOString(),
}={})=>{
  if(!actor?.id)return fail("Sessão do usuário indisponível para ativar o contrato.");
  const commercial=data.comercial||{};
  const contracts=Array.isArray(commercial.contratos)?commercial.contratos:[];
  const contract=contracts.find(item=>item.id===contractId);
  if(!contract)return fail("Contrato comercial não encontrado.");
  if(String(contract.status||"").toLowerCase()==="contratado")return fail("Este contrato já foi transferido para uma obra.");
  const leads=Array.isArray(commercial.leads)?commercial.leads:[];
  const lead=leads.find(item=>item.id===contract.leadId);
  const proposal=(commercial.propostas||[]).find(item=>item.id===contract.propostaId);
  const missing=[];
  if(!lead)missing.push("lead vinculado");
  if(contract.propostaId&&proposal?.status!=="aceita")missing.push("proposta aceita");
  if(!contract.contratante)missing.push("contratante");
  if(!(Number(contract.valor)>0))missing.push("valor do contrato");
  if(!contract.assinadoEm&&contract.status!=="assinado")missing.push("contrato assinado");
  if(!contract.documentosRecebidos)missing.push("documentos recebidos");
  if(!contract.entradaPaga)missing.push("entrada confirmada");
  if(!contract.escopoValidado)missing.push("escopo validado");
  if(!contract.responsavelTecnicoId)missing.push("responsável técnico");
  if(missing.length)return fail(`Falta: ${missing.join(", ")}.`);

  const projectId=String(obraId||contract.obraId||ids.obraId||"");
  if(!projectId||String(ids.obraId||"")!==projectId)return fail("Identificação da nova obra inválida.");
  if((data.obras||[]).some(item=>String(item.id)===projectId)){
    return fail("Já existe uma obra com esta identificação. Gere uma nova identificação para concluir a contratação.");
  }
  const installmentCount=Math.max(1,Number(contract.parcelas||1));
  const hasEntry=Number(contract.entrada||0)>0;
  if(!requiredIds(ids,hasEntry,installmentCount))return fail("Identificadores insuficientes para ativar contrato, obra e parcelas.");
  const generatedIds=[
    ids.saleId,ids.commissionId,ids.kickoffId,ids.postSaleId,
    ...(hasEntry?[ids.entryMeasurementId,ids.entryReceiptId]:[]),
    ...ids.installmentMeasurementIds.slice(0,installmentCount),
  ];
  if(new Set(generatedIds).size!==generatedIds.length)return fail("A ativação contém identificadores repetidos.");
  const occupiedIds=new Set([
    ...(data.medicoes||[]).flatMap(item=>[item.id,...(item.recebimentos||[]).map(receipt=>receipt.id)]),
    ...(commercial.vendas||[]).map(item=>item.id),
    ...(commercial.comissoes||[]).map(item=>item.id),
    ...(commercial.reunioes||[]).map(item=>item.id),
    ...(commercial.atividades||[]).map(item=>item.id),
  ].filter(Boolean));
  if(generatedIds.some(id=>occupiedIds.has(id)))return fail("Um identificador da ativação já está em uso. Gere novos identificadores.");
  const clients=Array.isArray(commercial.clientes)?commercial.clientes:[];
  const existingClient=clients.find(item=>item.leadId===lead.id);
  const client=existingClient||{
    id:ids.clientId,leadId:lead.id,nome:lead.nome||"",tipoPessoa:lead.tipoPessoa||"PF",
    documento:lead.documento||"",telefone:lead.telefone||"",whatsapp:lead.whatsapp||"",
    email:lead.email||"",cidade:lead.cidade||"",endereco:lead.endereco||"",
    createdAt:now,updatedAt:now,
  };
  const start=dateOnly(contract.inicio)||dateOnly(now);
  const project={
    id:projectId,name:lead.nome||contract.objeto,clienteId:client.id,
    cliente:client.tipoPessoa==="PJ"?(client.razaoSocial||client.nome):client.nome,
    address:lead.endereco||lead.cidade||"",engineerId:contract.responsavelTecnicoId||"",
    engineer:userName(data,contract.responsavelTecnicoId),startDate:start,status:"active",
    areaM2:Number(lead.areaConstrucao||0),contractType:"fixed_labor",
    contractValue:Number(contract.valor||0),adminPercentage:0,billingType:"parcelado",
    parcelaMensal:installmentCount?Math.max(0,(Number(contract.valor||0)-Number(contract.entrada||0))/installmentCount):0,
    contractStart:start,contractEnd:dateOnly(contract.conclusao),totalParcelas:installmentCount,
    billingFrequency:"mensal",diaVenc1:Number(contract.diaVencimento||5),
    diaVenc2:Number(contract.diaVencimento||5),entrada:Number(contract.entrada||0),
    entradaDate:dateOnly(now),hasCaixa:true,faseId:"",
  };
  const sale={
    id:ids.saleId,leadId:lead.id,contratoId:contract.id,clienteId:client.id,obraId:projectId,
    valor:Number(contract.valor||0),fechadaEm:now,
    responsavelId:contract.responsavelComercialId||lead.responsavelId||"",
  };
  const partner=(commercial.parceiros||[]).find(item=>item.id===lead.parceiroId);
  // Achado P3 da auditoria de 18/08/2026: quando a venda não tem parceiro de
  // indicação (o caso comum - venda direta), não existe hoje nenhum campo de
  // comissão de vendedor/usuário no schema (só parceiros e corretores
  // imobiliários têm `comissaoPct`). Este 1% é um valor de fallback
  // histórico, sem origem documentada nem configuração - mantido como está
  // para não inventar uma regra de negócio nova sem confirmação do usuário.
  // Se um dia existir uma taxa de comissão por vendedor, ela deve substituir
  // esta constante aqui.
  const DIRECT_SALE_DEFAULT_COMMISSION_PCT=1;
  const commissionPercentage=Number(partner?.comissaoPct||DIRECT_SALE_DEFAULT_COMMISSION_PCT);
  const commission={
    id:ids.commissionId,vendaId:sale.id,responsavelId:sale.responsavelId,
    parceiroId:partner?.id||"",base:sale.valor,percentual:commissionPercentage,
    valor:sale.valor*commissionPercentage/100,status:"prevista",
  };

  const measurements=[];
  const explicitSourceReceiptIds=(contract.recebimentosEntrada||[]).map(item=>item.id).filter(Boolean);
  if(new Set(explicitSourceReceiptIds).size!==explicitSourceReceiptIds.length
    ||explicitSourceReceiptIds.some(id=>occupiedIds.has(id))){
    return fail("Um recebimento da entrada já está vinculado a outro título.");
  }
  const sourceReceipts=(contract.recebimentosEntrada||[]).map((item,index)=>({
    ...item,id:item.id||`${ids.entryReceiptId}-${index}`,
    origem:item.origem||"contrato",createdAt:item.createdAt||now,
  }));
  if(hasEntry){
    const receipts=sourceReceipts.length?sourceReceipts:[{
      id:ids.entryReceiptId,valor:Number(contract.entrada||0),data:dateOnly(now),
      origem:"confirmacao_comercial",createdAt:now,createdById:actor.id,
      createdBy:actor.nome||"Usuário autenticado",
    }];
    const received=receipts.reduce((sum,item)=>sum+Number(item.valor||0),0);
    const last=receipts.slice().sort((a,b)=>String(b.data||"").localeCompare(String(a.data||"")))[0];
    measurements.push({
      id:ids.entryMeasurementId,obraId:projectId,
      competencia:String(last?.data||start).slice(0,7),dataVencimento:last?.data||start,
      numeroParcela:"Entrada",tipo:"entrada",percentualAcumulado:0,percentualPeriodo:0,
      valorMOFixo:Number(contract.entrada),valorAdminPct:0,valorPrevisto:Number(contract.entrada),
      valorRecebido:received,dataPagamento:last?.data||"",recebimentos:receipts,
      descricao:`Entrada contrato ${contract.numero}`,recebido:received>=Number(contract.entrada)-0.01,
      status:"emitida",origem:"ativacao_contrato",version:1,
      createdAt:now,createdById:actor.id,createdBy:actor.nome||"Usuário autenticado",
      updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||"Usuário autenticado",
    });
  }
  const balance=Math.max(0,Number(contract.valor||0)-Number(contract.entrada||0));
  const installmentValue=balance/installmentCount;
  for(let index=0;index<installmentCount&&installmentValue>0;index+=1){
    const due=addMonths(start,index);
    measurements.push({
      id:ids.installmentMeasurementIds[index],obraId:projectId,
      competencia:due.slice(0,7),dataVencimento:due,numeroParcela:String(index+1),
      tipo:"parcela",percentualAcumulado:0,percentualPeriodo:0,
      valorMOFixo:installmentValue,valorAdminPct:0,valorPrevisto:installmentValue,
      valorRecebido:0,dataPagamento:"",recebimentos:[],
      descricao:`Parcela ${index+1}/${installmentCount} · ${contract.numero}`,
      recebido:false,status:"emitida",origem:"ativacao_contrato",version:1,
      createdAt:now,createdById:actor.id,createdBy:actor.nome||"Usuário autenticado",
      updatedAt:now,updatedById:actor.id,updatedBy:actor.nome||"Usuário autenticado",
    });
  }
  const kickoff={
    id:ids.kickoffId,leadId:lead.id,dataHora:`${start}T09:00`,tipo:"inicio_obra",
    local:lead.endereco||"Obra",
    participantes:`Cliente, ${userName(data,contract.responsavelTecnicoId)}, ${userName(data,sale.responsavelId)}`,
    responsavelComercialId:sale.responsavelId,responsavelTecnicoId:contract.responsavelTecnicoId,
    pauta:"Reunião de início e transferência para Engenharia",resumo:"",
    necessidades:lead.observacoes||"",objecoes:"",orcamentoDisponivel:Number(contract.valor||0),
    proximosPassos:"Validar mobilização e cronograma",proximoContato:start,status:"agendada",documentos:[],
  };
  const postSale={
    id:ids.postSaleId,leadId:lead.id,tipo:"pos_venda",
    titulo:"Contato de pós-venda e confirmação do início",
    dataHora:`${addMonths(start,1)}T09:00`,responsavelId:sale.responsavelId,status:"pendente",
    observacoes:`Criado automaticamente após a contratação ${contract.numero}.`,createdAt:now,
  };
  const updatedCommercial={
    ...commercial,
    clientes:existingClient?clients:[...clients,client],
    vendas:[...(commercial.vendas||[]),sale],
    comissoes:[...(commercial.comissoes||[]),commission],
    atividades:[...(commercial.atividades||[]),postSale],
    reunioes:[...(commercial.reunioes||[]),kickoff],
    contratos:contracts.map(item=>item.id===contract.id?{
      ...item,status:"contratado",obraId:projectId,clienteId:client.id,atualizadoEm:now,
    }:item),
    leads:leads.map(item=>item.id===lead.id?{
      ...item,etapa:"transferido",status:"ganho",etapaDesde:now,
      historico:[...(item.historico||[]),{
        id:`contract-activation-${contract.id}`,data:now,tipo:"fechamento",
        texto:`Venda fechada e transferida para obra ${project.name}`,
      }],
    }:item),
  };
  return {
    ok:true,obraId:projectId,entityId:contract.id,
    data:{
      ...data,obras:[...(data.obras||[]),project],
      medicoes:[...(data.medicoes||[]),...measurements],comercial:updatedCommercial,
    },
  };
};
