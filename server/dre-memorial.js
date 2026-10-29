import { cobrancaLocacao, diasLocacaoNoPeriodo } from "../src/domains/equipamentos/calculations.js";

const collections = {medicao:"medicoes",nota_fiscal:"notasFiscais",medicao_terceiro:"medicoesTerc",pagamento_terceiro_legado:"pagsTerceiros",outra_despesa:"outrasDesp",despesa_empresa:"despesasEmpresa",rescisao:"rescisoes",recebimento_avulso:"payments",caixa_obra:"caixaObra"};
const cents=value=>Math.round(Number(value||0)*100);

// Store the evidence with the projection, so future closed periods retain it.
// Only operational source records are copied; never users or configuration.
export function buildDreMemorial(data,base,ym){
  const result={};
  const add=(source,item)=>{(result[source]??=[]).push(item);};
  const workName=id=>(data.obras||[]).find(work=>work.id===id)?.name||id||"Empresa (sem obra)";
  const fromEvent=event=>{
    const record=(data[collections[event.sourceType]]||[]).find(item=>String(item.id)===event.sourceId)||event.metadata?.titleDetails;
    const invoices=(data.notasFiscais||[]).filter(invoice=>
      (record?.notaFiscalId&&invoice.id===record.notaFiscalId)||
      (event.sourceType==="medicao_terceiro"&&invoice.medicaoTercId===event.sourceId));
    return {id:event.id,description:event.description,amountCents:event.amountCents*(event.effect.endsWith("_reversal")?-1:1),
      obraId:event.obraId,obra:workName(event.obraId),date:event.date,competence:event.competence,
      counterparty:event.counterparty,documentNumber:event.documentNumber,sourceType:event.sourceType,sourceId:event.sourceId,
      status:event.status,effect:event.effect,record:record||null,
      metadata:Object.fromEntries(Object.entries(event.metadata||{}).filter(([key])=>key!=="titleDetails")),
      documents:(data.documentosMovimentacoes||[]).filter(item=>item.movimentoId===event.id).flatMap(item=>item.documentos||[]),
      ...(invoices.length?{invoices}:{}),
      ...(event.sourceType==="ponto"?{note:"Custo calculado pelos apontamentos do período, consolidado por obra. Não é uma nota fiscal."}:{}),
    };
  };
  for(const row of base.obras||[]){
    for(const event of row.dreEvents||[]){
      if(["revenue","revenue_reversal"].includes(event.effect))add("faturamentoObras",fromEvent(event));
      if(event.effect==="cost_reversal"){add("costResidual",fromEvent(event));continue;}
      if(event.effect!=="cost")continue;
      let classified=0;
      const classify=source=>{add(source,fromEvent(event));classified++;};
      if(event.sourceType==="ponto")classify(event.category==="beneficios"?"benefTotal":"laborTotal");
      if(event.category==="terceirizado")classify("tercTotal");
      if(event.category==="rescisao")classify("rescTotal");
      if(["outra_despesa","nota_fiscal","equipamento"].includes(event.sourceType)||
        (event.sourceType==="canonical_title"&&!["terceirizado","rescisao"].includes(event.category)))classify("outrasDiretas");
      if(classified!==1)add("costResidual",{...fromEvent(event),amountCents:event.amountCents*(1-classified),note:classified>1?"Ajuste das categorias sobrepostas do demonstrativo; não é um novo lançamento.":"Custo reconhecido sem categoria individual no demonstrativo."});
    }
  }
  for(const event of base.ledger?.events||[]){
    if(event.obraId||event.competence!==ym)continue;
    if(event.effect==="revenue")add("receitaCorporativa",fromEvent(event));
    if(["cost","cost_reversal"].includes(event.effect)&&["despesa_empresa","canonical_title"].includes(event.sourceType))add(`category:${event.category}`,fromEvent(event));
  }
  const [year,month]=ym.split("-").map(Number),start=`${ym}-01`,end=`${ym}-${new Date(year,month,0).getDate()}`;
  for(const rental of data.locacoesEquip||[]){
    if(rental.status==="cancelada")continue;
    const days=diasLocacaoNoPeriodo(rental,start,end);
    if(!days)continue;
    const equipment=(data.equipamentos||[]).find(item=>item.id===rental.equipamentoId);
    const charge=cobrancaLocacao(rental,equipment,days);
    const item={id:`rental:${rental.id}`,description:equipment?.nome||equipment?.name||"Locação de equipamento",obraId:rental.obraId,obra:workName(rental.obraId),date:rental.inicio,competence:ym,sourceType:"locacao",sourceId:rental.id,record:rental,calculation:{dias:days,...charge}};
    const workEquipment=result.outrasDiretas?.find(entry=>entry.sourceType==="equipamento"&&entry.obraId===rental.obraId);
    if(workEquipment){
      workEquipment.record??={locacoes:[]};
      workEquipment.record.locacoes.push({...rental,memoriaCalculo:{dias:days,...charge}});
    }
    add("receitaLocacoes",{...item,amountCents:cents(charge.bruto)});
    if(charge.desconto)add("descontoLocacoes",{...item,amountCents:cents(charge.desconto)});
    if(equipment?.proprietarioId)add("repasseEquipamentosTerceiros",{...item,amountCents:cents(charge.liquido)});
  }
  const equipmentIds=new Set([...(data.equipamentos||[]).map(item=>item.id),...(data.locacoesEquip||[]).map(item=>item.equipamentoId)].filter(Boolean));
  for(const record of data.manutencoesEquip||[]){
    if(!equipmentIds.has(record.equipamentoId)||String(record.data||"").slice(0,7)!==ym||record.pagoPor==="proprietario")continue;
    add("manutencaoLocacoes",{id:`maintenance:${record.id}`,description:record.descricao||"Manutenção de equipamento",amountCents:cents(record.custo),obraId:record.obraId,obra:workName(record.obraId),date:record.data,competence:ym,sourceType:"manutencao",sourceId:record.id,record});
  }
  return result;
}
