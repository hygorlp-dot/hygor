export const REAL_ESTATE_SCHEMA_VERSION=1;

export const DEVELOPMENT_STATUSES=Object.freeze([
  "estudo","pre_lancamento","lancamento","em_construcao","pronto","entregue","encerrado","suspenso",
]);
export const UNIT_STATUSES=Object.freeze([
  "disponivel","em_atendimento","em_negociacao","proposta","reservada","vendida","bloqueada","permutada","indisponivel","distratada",
]);
export const PROPERTY_TYPES=Object.freeze([
  "casa","apartamento","terreno","lote","sala_comercial","loja","galpao","predio","propriedade_rural","outro",
]);
export const PROPERTY_NATURES=Object.freeze([
  "proprio","parceiro","terceiro","permuta","administracao_exclusiva","captacao_sem_exclusividade",
]);
export const REAL_ESTATE_LEAD_STAGES=Object.freeze([
  "novo","tentativa_contato","contato_realizado","qualificado","imoveis_apresentados","visita_agendada",
  "visita_realizada","simulacao","proposta","negociacao","reserva","documentacao","contrato","venda_concluida","pos_venda","perdido",
]);
export const REAL_ESTATE_LEAD_SOURCES=Object.freeze([
  "indicacao","site","whatsapp","instagram","facebook","google","portal_imobiliario","placa","evento",
  "corretor_parceiro","cliente_antigo","prospeccao","outro",
]);

const list=value=>Array.isArray(value)?value:[];
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const text=value=>String(value||"");
const statusActive=value=>!["cancelada","cancelado","expirada","distratada","arquivada","arquivado"].includes(text(value).toLowerCase());

export const normalizeRealEstateCommercial=(commercial={})=>({
  ...commercial,
  realEstateSchemaVersion:REAL_ESTATE_SCHEMA_VERSION,
  empreendimentos:list(commercial.empreendimentos).map(item=>({
    ...item,id:text(item.id),codigo:text(item.codigo),nome:text(item.nome),spe:text(item.spe),cnpjSpe:text(item.cnpjSpe),
    obraId:text(item.obraId),status:item.status||"estudo",vgvTotal:number(item.vgvTotal),quantidadeUnidades:number(item.quantidadeUnidades),
    comissaoPadrao:number(item.comissaoPadrao),percentualFisico:number(item.percentualFisico),documentos:list(item.documentos),
    imagens:list(item.imagens),videos:list(item.videos),historico:list(item.historico),createdAt:item.createdAt||"",updatedAt:item.updatedAt||"",
  })),
  unidadesImobiliarias:list(commercial.unidadesImobiliarias).map(item=>({
    ...item,id:text(item.id),codigo:text(item.codigo),empreendimentoId:text(item.empreendimentoId),status:item.status||"disponivel",
    valorTabela:number(item.valorTabela),valorMinimo:number(item.valorMinimo),areaPrivativa:number(item.areaPrivativa),
    areaTotal:number(item.areaTotal),comissaoPct:number(item.comissaoPct),documentos:list(item.documentos),imagens:list(item.imagens),
    historicoPrecos:list(item.historicoPrecos),historicoStatus:list(item.historicoStatus),createdAt:item.createdAt||"",updatedAt:item.updatedAt||"",
  })),
  imoveisAvulsos:list(commercial.imoveisAvulsos).map(item=>({
    ...item,id:text(item.id),codigo:text(item.codigo),titulo:text(item.titulo),tipo:item.tipo||"casa",natureza:item.natureza||"proprio",
    status:item.status||"disponivel",valorVenda:number(item.valorVenda),valorMinimo:number(item.valorMinimo),comissaoPct:number(item.comissaoPct),
    areaConstruida:number(item.areaConstruida),areaTerreno:number(item.areaTerreno),documentos:list(item.documentos),imagens:list(item.imagens),
    videos:list(item.videos),historicoPrecos:list(item.historicoPrecos),historicoStatus:list(item.historicoStatus),createdAt:item.createdAt||"",updatedAt:item.updatedAt||"",
  })),
  reservasImobiliarias:list(commercial.reservasImobiliarias).map(item=>({
    ...item,id:text(item.id),unidadeId:text(item.unidadeId),imovelId:text(item.imovelId),leadId:text(item.leadId),clienteId:text(item.clienteId),
    corretorId:text(item.corretorId),valor:number(item.valor),status:item.status||"ativa",documentos:list(item.documentos),historico:list(item.historico),
  })),
  vendasImobiliarias:list(commercial.vendasImobiliarias).map(item=>({
    ...item,id:text(item.id),unidadeId:text(item.unidadeId),imovelId:text(item.imovelId),reservaId:text(item.reservaId),
    leadId:text(item.leadId),clienteId:text(item.clienteId),corretorId:text(item.corretorId),contratoId:text(item.contratoId),
    valor:number(item.valor),valorRecebido:number(item.valorRecebido),comissaoPrevista:number(item.comissaoPrevista),
    comissaoPaga:number(item.comissaoPaga),status:item.status||"ativa",recebimentos:list(item.recebimentos),documentos:list(item.documentos),
  })),
  visitasImobiliarias:list(commercial.visitasImobiliarias).map(item=>({
    ...item,id:text(item.id),leadId:text(item.leadId),unidadeId:text(item.unidadeId),imovelId:text(item.imovelId),
    corretorId:text(item.corretorId),status:item.status||"agendada",documentos:list(item.documentos),
  })),
  corretores:list(commercial.corretores).map(item=>({
    ...item,id:text(item.id),nome:text(item.nome),creci:text(item.creci),tipo:item.tipo||"interno",comissaoPadrao:number(item.comissaoPadrao),ativo:item.ativo!==false,
  })),
  funilImobiliario:Array.isArray(commercial.funilImobiliario)&&commercial.funilImobiliario.length
    ? commercial.funilImobiliario : [...REAL_ESTATE_LEAD_STAGES],
});

export const releaseExpiredReservations=(commercial,nowDate=new Date().toISOString().slice(0,10))=>{
  const normalized=normalizeRealEstateCommercial(commercial);
  const expiredIds=new Set();
  const reservations=normalized.reservasImobiliarias.map(reservation=>{
    if(reservation.status==="ativa"&&reservation.validade&&reservation.validade<nowDate){
      expiredIds.add(reservation.id);
      return {...reservation,status:"expirada",expiradaEm:`${nowDate}T00:00:00.000Z`,historico:[...reservation.historico,{status:"expirada",em:`${nowDate}T00:00:00.000Z`,motivo:"Validade encerrada automaticamente"}]};
    }
    return reservation;
  });
  const activeReservedUnits=new Set(reservations.filter(item=>item.status==="ativa").map(item=>item.unidadeId).filter(Boolean));
  const units=normalized.unidadesImobiliarias.map(unit=>unit.status==="reservada"&&!activeReservedUnits.has(unit.id)
    ? {...unit,status:"disponivel",historicoStatus:[...unit.historicoStatus,{de:"reservada",para:"disponivel",em:`${nowDate}T00:00:00.000Z`,motivo:"Reserva vencida"}]}
    : unit);
  return {...normalized,reservasImobiliarias:reservations,unidadesImobiliarias:units,expiredCount:expiredIds.size};
};

export const updateUnitWithAudit=({unit,previous,actor={},now=new Date().toISOString()})=>{
  const next={...previous,...unit,updatedAt:now,updatedById:actor.id||"",updatedBy:actor.nome||""};
  if(!previous)return {...next,createdAt:now,historicoPrecos:[{valor:number(next.valorTabela),em:now,autorId:actor.id||"",motivo:"Cadastro inicial"}],historicoStatus:[{de:"",para:next.status||"disponivel",em:now,autorId:actor.id||"",motivo:"Cadastro inicial"}]};
  if(number(previous.valorTabela)!==number(next.valorTabela))next.historicoPrecos=[...list(previous.historicoPrecos),{valorAnterior:number(previous.valorTabela),valor:number(next.valorTabela),em:now,autorId:actor.id||"",motivo:text(unit.motivoAlteracaoPreco)||"Atualização comercial"}];
  if(previous.status!==next.status)next.historicoStatus=[...list(previous.historicoStatus),{de:previous.status,para:next.status,em:now,autorId:actor.id||"",motivo:text(unit.motivoStatus)||"Atualização comercial"}];
  return next;
};

export const createReservation=({commercial,reservation,id,actor={},now=new Date().toISOString()})=>{
  const data=releaseExpiredReservations(commercial,now.slice(0,10));
  const unit=data.unidadesImobiliarias.find(item=>item.id===reservation.unidadeId);
  const property=data.imoveisAvulsos.find(item=>item.id===reservation.imovelId);
  if(!unit&&!property)throw new Error("Selecione uma unidade ou imóvel para reservar.");
  if(unit&&["vendida","bloqueada","permutada","indisponivel"].includes(unit.status))throw new Error("Esta unidade não está disponível para reserva.");
  if(unit&&data.reservasImobiliarias.some(item=>item.unidadeId===unit.id&&item.status==="ativa"))throw new Error("Esta unidade já possui uma reserva ativa.");
  if(property&&["vendido","bloqueado","indisponivel"].includes(property.status))throw new Error("Este imóvel não está disponível para reserva.");
  if(!(number(reservation.valor)>0))throw new Error("Informe o valor da reserva.");
  if(!reservation.validade)throw new Error("Informe a validade da reserva.");
  const record={...reservation,id,status:"ativa",createdAt:now,createdById:actor.id||"",historico:[{status:"ativa",em:now,autorId:actor.id||"",motivo:"Reserva criada"}]};
  return {...data,reservasImobiliarias:[...data.reservasImobiliarias,record],unidadesImobiliarias:data.unidadesImobiliarias.map(item=>item.id===unit?.id?updateUnitWithAudit({unit:{...item,status:"reservada",motivoStatus:"Reserva ativa"},previous:item,actor,now}):item),imoveisAvulsos:data.imoveisAvulsos.map(item=>item.id===property?.id?{...item,status:"reservado",historicoStatus:[...list(item.historicoStatus),{de:item.status,para:"reservado",em:now,autorId:actor.id||"",motivo:"Reserva ativa"}]}:item)};
};

export const createPropertySale=({commercial,sale,id,actor={},now=new Date().toISOString()})=>{
  const data=releaseExpiredReservations(commercial,now.slice(0,10));
  const unit=data.unidadesImobiliarias.find(item=>item.id===sale.unidadeId);
  const property=data.imoveisAvulsos.find(item=>item.id===sale.imovelId);
  if(!unit&&!property)throw new Error("Selecione a unidade ou imóvel vendido.");
  if(unit?.status==="vendida"||property?.status==="vendido")throw new Error("O imóvel selecionado já foi vendido.");
  const price=number(sale.valor);
  if(!(price>0))throw new Error("Informe o valor da venda.");
  const minimum=number(unit?.valorMinimo||property?.valorMinimo);
  if(minimum&&price<minimum&&!sale.aprovadoAbaixoMinimo)throw new Error("Venda abaixo do mínimo exige aprovação administrativa.");
  if(minimum&&price<minimum&&sale.aprovadoAbaixoMinimo&&actor.role!=="admin")throw new Error("Somente um administrador pode aprovar venda abaixo do mínimo.");
  const commissionPct=number(sale.comissaoPct||unit?.comissaoPct||property?.comissaoPct);
  const record={...sale,id,valor:price,comissaoPct:commissionPct,comissaoPrevista:price*commissionPct/100,status:"ativa",fechadaEm:sale.fechadaEm||now.slice(0,10),createdAt:now,createdById:actor.id||""};
  return {...data,vendasImobiliarias:[...data.vendasImobiliarias,record],unidadesImobiliarias:data.unidadesImobiliarias.map(item=>item.id===unit?.id?updateUnitWithAudit({unit:{...item,status:"vendida",motivoStatus:"Venda concluída"},previous:item,actor,now}):item),imoveisAvulsos:data.imoveisAvulsos.map(item=>item.id===property?.id?{...item,status:"vendido",historicoStatus:[...list(item.historicoStatus),{de:item.status,para:"vendido",em:now,autorId:actor.id||"",motivo:"Venda concluída"}]}:item),reservasImobiliarias:data.reservasImobiliarias.map(item=>item.id===sale.reservaId?{...item,status:"convertida",convertidaEm:now}:item)};
};

export const selectRealEstateDashboard=(commercial,filters={})=>{
  const data=releaseExpiredReservations(commercial,filters.today);
  const developments=data.empreendimentos.filter(item=>!filters.empreendimentoId||item.id===filters.empreendimentoId);
  const developmentIds=new Set(developments.map(item=>item.id));
  const units=data.unidadesImobiliarias.filter(item=>(!filters.empreendimentoId||developmentIds.has(item.empreendimentoId))&&(!filters.status||item.status===filters.status)&&(!filters.tipo||item.tipologia===filters.tipo));
  const unitIds=new Set(units.map(item=>item.id));
  const sales=data.vendasImobiliarias.filter(item=>(!item.unidadeId||unitIds.has(item.unidadeId))&&(!filters.corretorId||item.corretorId===filters.corretorId));
  const reservations=data.reservasImobiliarias.filter(item=>item.status==="ativa"&&(!item.unidadeId||unitIds.has(item.unidadeId)));
  const proposals=list(data.propostas).filter(item=>!["aceita","rejeitada","cancelada"].includes(item.status));
  const available=units.filter(item=>item.status==="disponivel");
  const sold=units.filter(item=>item.status==="vendida");
  const negotiated=units.filter(item=>["em_atendimento","em_negociacao","proposta"].includes(item.status));
  const sum=(rows,key)=>rows.reduce((total,item)=>total+number(item[key]),0);
  const vgvAvailable=sum(available,"valorTabela");const vgvSold=sum(sales,"valor");const received=sum(sales,"valorRecebido");
  return {data,units,sales,reservations,developments,metrics:{
    vgvAvailable,vgvSold,vgvReserved:reservations.reduce((total,item)=>total+number(item.valor),0),
    vgvNegotiation:sum(negotiated,"valorTabela"),received,receivable:Math.max(0,vgvSold-received),
    availableUnits:available.length,reservedUnits:units.filter(item=>item.status==="reservada").length,soldUnits:sold.length,
    activeLeads:list(data.leads).filter(item=>!["perdido","arquivado"].includes(item.etapa)&&item.status!=="arquivado").length,
    openProposals:proposals.length,salesCount:sales.length,averageTicket:sales.length?vgvSold/sales.length:0,
    conversionRate:list(data.leads).length?sales.length/list(data.leads).length*100:0,
    commissionExpected:sum(sales,"comissaoPrevista"),commissionPaid:sum(sales,"comissaoPaga"),
  }};
};
