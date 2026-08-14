import { createDreCalculations } from "../src/domains/dre/calculations.js";
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_EXPENSE_GROUPS,
  emptyCompanyExpenseGroupTotals,
} from "../src/domains/dre/expense-taxonomy.js";
import { calcEquipMes, diasLocacaoNoPeriodo } from "../src/domains/equipamentos/calculations.js";
import { active } from "../src/domains/financeiro/ledger.js";
import { createLaborCostEngine } from "../src/domains/financeiro/labor-cost-engine.js";
import {
  getAtt,
  getPayrollHolidays,
  getHolidayPayRule,
  isEmployeeEmployedOnDate,
  prIsWeekdayIso,
} from "../src/domains/ponto/attendance-engine.js";

const round = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const localIso = date => {
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
};
const getDays = (year, month) => {
  const result=[],date=new Date(year,month,1,12);
  while(date.getMonth()===month){result.push(localIso(date));date.setDate(date.getDate()+1);}
  return result;
};
const getQ = (year, month) => {
  const atual=getDays(year,month),next=new Date(year,month+1,1,12),proximo=getDays(next.getFullYear(),next.getMonth());
  return {
    q1:atual.filter(date=>Number(date.slice(8))>=6&&Number(date.slice(8))<=20),
    q2:[...atual.filter(date=>Number(date.slice(8))>=21),...proximo.filter(date=>Number(date.slice(8))<=5)],
  };
};

// Mesmo motor de custo de mão de obra usado no cliente (LegacyApp.jsx), para
// que servidor e cliente nunca divirjam sobre a obra de um funcionário que
// mudou de lotação no meio do período — ver resolveEmployeeAttendanceObraId
// em src/domains/ponto/permissions.js, que este motor consulta internamente.
const { calculateWorkLaborCost: laborCost } = createLaborCostEngine({
  getPayrollHolidays,
  isWeekdayIso: prIsWeekdayIso,
  isEmployeeEmployedOnDate,
  getAttendance: getAtt,
  getHolidayPayRule,
});

const totalPurchase = purchase => (purchase?.itens||[])
  .reduce((sum,item)=>sum+Number(item.qtd??item.quantidade??0)*Number(item.precoUnit??item.preco??item.valorUnitario??0),0);
const thirdWork = (data,obraId,start,end) => (data?.pagsTerceiros||[])
  .filter(item=>active(item)&&item.obraId===obraId&&item.pagador!=="empresa"&&item.date>=start&&item.date<=end)
  .reduce((sum,item)=>sum+Number(item.amount||0),0);
const thirdCompany = (data,start,end) => (data?.pagsTerceiros||[])
  .filter(item=>active(item)&&item.pagador==="empresa"&&item.date>=start&&item.date<=end)
  .reduce((sum,item)=>sum+Number(item.amount||0),0);
const thirdCompanyWork = (data,obraId,start,end) => (data?.pagsTerceiros||[])
  .filter(item=>active(item)&&item.obraId===obraId&&item.pagador==="empresa"&&item.date>=start&&item.date<=end)
  .reduce((sum,item)=>sum+Number(item.amount||0),0);
const purchases = (data,obraId,start,end) => (data?.pedidos||[])
  .filter(item=>active(item)&&item.obraId===obraId&&item.status!=="rascunho"&&item.data>=start&&item.data<=end)
  .reduce((sum,item)=>sum+totalPurchase(item),0);
const equipmentWork = (data,obraId,ym,start,end) => (data?.locacoesEquip||[])
  .filter(item=>active(item)&&item.obraId===obraId)
  .reduce((sum,item)=>{
    const days=diasLocacaoNoPeriodo(item,start,end);
    if(!days)return sum;
    const gross=days*Number(item.valorDiaria||0);
    return sum+Math.max(0,gross-Number(item.descontoValor||0)-gross*Number(item.descontoPct||0)/100);
  },0);
const equipmentCompany = (data,ym) => {
  const equipmentIds=new Set([
    ...(data?.equipamentos||[]).map(equipment=>equipment.id),
    ...(data?.locacoesEquip||[]).map(rental=>rental.equipamentoId),
  ].filter(Boolean));
  const rows=[...equipmentIds].map(equipmentId=>({
    equipment:(data?.equipamentos||[]).find(item=>item.id===equipmentId),
    financial:calcEquipMes(data,equipmentId,ym),
  }));
  const total=rows.reduce((acc,{equipment,financial})=>({
    receita:acc.receita+financial.receita,
    // Tarifa de custo só é repasse quando existe proprietário terceiro. Em
    // equipamento próprio ela é referência interna e não gera obrigação.
    custoDono:acc.custoDono+(equipment?.proprietarioId?financial.custoDono:0),
    manut:acc.manut+financial.manut,
    descontos:acc.descontos+financial.descontos,
  }),{receita:0,custoDono:0,manut:0,descontos:0});
  return {...total,lucro:total.receita-total.custoDono-total.manut,
    receitaBruta:total.receita+total.descontos,receitaProprios:0,receitaTerceiros:0};
};

const calculations=createDreCalculations({
  getDays,getQ,monthName:month=>String(month+1),
  calcObraLaborCost:laborCost,calcObraTercCost:thirdWork,
  calcTercEmpresaCost:thirdCompany,calcObraTercEmpresaCost:thirdCompanyWork,
  calcObraComprasCost:purchases,calcEquipCustoObra:equipmentWork,
  calcEquipFaturamentoEmpresa:equipmentCompany,
});

const expenseCategories=COMPANY_EXPENSE_CATEGORIES.map(category=>[
  category.id,category.group,
]);
const companyDre = (data,year,month) => {
  const ym=`${year}-${String(month+1).padStart(2,"0")}`,cfg=data?.config||{};
  // A DRE da empresa não pode reconstruir valores a partir das coleções
  // operacionais. A fonte é a mesma projeção de razão usada no DRE por obra.
  const base=calculations.calcDREConsolidado(data,year,month,"mes");
  const workRows=base.obras||[];
  const workRevenue=workRows.reduce((sum,row)=>sum+Number(row.faturamento||0),0);
  const workCosts=workRows.reduce((sum,row)=>sum+Number(row.totalCustos||0),0);
  const corporateCosts=(base.ledger?.events||[]).filter(event=>
    !event.obraId&&event.competence===ym&&["cost","cost_reversal"].includes(event.effect));
  const signedAmount=event=>(event.effect==="cost_reversal"?-1:1)*Number(event.amountCents||0)/100;
  const faturamentoObras=workRevenue;
  const receitaLocacoes=Number(base.equipReceitaBruta??base.equipReceita??0);
  const descontoLocacoes=Number(base.equipDescontos||0);
  const faturamentoTotal=faturamentoObras+receitaLocacoes;
  const recebidoObras=base.entradasCaixa;
  const baseTributavel=Math.max(0,faturamentoTotal-descontoLocacoes);
  const deducaoISS=baseTributavel*Number(cfg.aliquotaISS||0)/100;
  const deducaoPIS=baseTributavel*Number(cfg.aliquotaPIS||0)/100;
  const deducaoCOFINS=baseTributavel*Number(cfg.aliquotaCOFINS||0)/100;
  const deducoesTributarias=deducaoISS+deducaoPIS+deducaoCOFINS;
  const totalDeducoes=descontoLocacoes+deducoesTributarias,receitaLiquida=faturamentoTotal-totalDeducoes;
  const laborTotal=base.laborCost,benefTotal=base.benefitCost,tercTotal=base.tercCost;
  const rescTotal=base.rescTotal;
  const outrasDiretas=base.outrasTotal+base.comprasCost+base.equipCostObras;
  const repasseEquipamentosTerceiros=Number(base.equipRepasseTerceiros||0);
  const manutencaoLocacoes=Number(base.equipManutencao||0);
  const custoLocacoes=repasseEquipamentosTerceiros+manutencaoLocacoes;
  const totalCSP=workCosts+custoLocacoes;
  const lucroBruto=receitaLiquida-totalCSP,margemBruta=receitaLiquida?lucroBruto/receitaLiquida*100:0;
  const despPorCat=Object.fromEntries(expenseCategories.map(([category])=>[
    category,round(corporateCosts.filter(event=>event.sourceType==="despesa_empresa"&&event.category===category)
      .reduce((sum,event)=>sum+signedAmount(event),0)),
  ]));
  const sumGroup=group=>expenseCategories.filter(([,itemGroup])=>itemGroup===group)
    .reduce((sum,[category])=>sum+Number(despPorCat[category]||0),0);
  const despPorGrupo=COMPANY_EXPENSE_GROUPS.reduce((totals,group)=>({
    ...totals,[group.id]:sumGroup(group.id),
  }),emptyCompanyExpenseGroupTotals());
  const totalDespPessoal=despPorGrupo.pessoal,totalDespOcupacao=despPorGrupo.ocupacao;
  const totalDespAdministrativo=despPorGrupo.administrativo,totalDespComercial=despPorGrupo.comercial;
  const totalDespFinanceiro=despPorGrupo.financeiro,totalDespFiscal=despPorGrupo.fiscal;
  const totalDespOutros=despPorGrupo.outros;
  const totalDespAdmin=totalDespPessoal+totalDespOcupacao+totalDespAdministrativo+totalDespComercial;
  const totalDespOp=Object.values(despPorGrupo).reduce((sum,value)=>sum+Number(value||0),0);
  const ebitda=lucroBruto-totalDespOp,margemEbitda=receitaLiquida?ebitda/receitaLiquida*100:0;
  const resultFinanceiro=0,lair=ebitda;
  const provisaoIR=lair>0?lair*Number(cfg.aliquotaIR||0)/100:0;
  const provisaoCSLL=lair>0?lair*Number(cfg.aliquotaCSLL||0)/100:0;
  const totalImpostoLucro=provisaoIR+provisaoCSLL,lucroLiquido=lair-totalImpostoLucro;
  const margemLiquida=receitaLiquida?lucroLiquido/receitaLiquida*100:0;
  const despEmp=corporateCosts.filter(event=>event.sourceType==="despesa_empresa").map(event=>({
    id:event.sourceId,categoria:event.category,descricao:event.description,competencia:event.competence,
    data:event.date,valor:signedAmount(event),status:event.effect==="cost_reversal"?"estornado":"ativo",
    ...(event.metadata?.expenseDetails||{}),
  }));
  const porObra=workRows.map(row=>{
    const receita=Number(row.faturamento||0),despesa=Number(row.totalCustos||0),resultado=Number(row.lucroBruto||0);
    return {id:row.obra?.id,name:row.obra?.name,status:row.obra?.status,receita:round(receita),receitaMed:round(receita),
      receitaLivre:0,recebido:round(row.recebido||0),laborCost:row.moData?.laborCost||0,benefitCost:row.moData?.benefitCost||0,
      terc:round(row.tercCost||0),outras:round((row.outrasTotal||0)+(row.comprasCost||0)+(row.equipCost||0)),
      despesa:round(despesa),resultado:round(resultado),margemPct:receita?round(resultado/receita*100):null};
  }).filter(item=>item.receita||item.despesa).sort((a,b)=>b.resultado-a.resultado);
  return Object.fromEntries(Object.entries({
    ym,faturamentoObras,receitaLocacoes,faturamentoTotal,recebidoObras,descontoLocacoes,deducoesTributarias,
    deducaoISS,deducaoPIS,deducaoCOFINS,totalDeducoes,receitaLiquida,
    laborTotal,benefTotal,tercTotal,rescTotal,outrasDiretas,repasseEquipamentosTerceiros,manutencaoLocacoes,custoLocacoes,totalCSP,lucroBruto,margemBruta,
    despPorCat,despPorGrupo,totalDespPessoal,totalDespOcupacao,totalDespAdministrativo,totalDespComercial,
    totalDespFinanceiro,totalDespAdmin,totalDespFiscal,totalDespOutros,totalDespOp,ebitda,margemEbitda,
    resultFinanceiro,lair,provisaoIR,provisaoCSLL,totalImpostoLucro,lucroLiquido,margemLiquida,despEmp,porObra,
    entradasCaixa:base.entradasCaixa,saidasCaixa:base.saidasCaixa,saldoCaixa:base.saldoCaixa,
    contasReceber:base.contasReceber,contasPagar:base.contasPagar,comprometido:base.comprometido,
    recebimentosNaoAlocados:base.recebimentosNaoAlocados,pagamentosNaoAlocados:base.pagamentosNaoAlocados,
  }).map(([key,value])=>[key,typeof value==="number"?round(value):value]));
};

const numericProjection = value => Object.fromEntries(Object.entries(value)
  .filter(([key,item])=>typeof item==="number"||["ym","periodo","per0","perF","moData"].includes(key))
  .map(([key,item])=>[
    key,
    key==="moData"
      ? {laborCost:round(item?.laborCost),benefitCost:round(item?.benefitCost),totalCost:round(item?.totalCost)}
      : (typeof item==="number"?round(item):item),
  ]));

const yearsInData = data => {
  const found=new Set([new Date().getFullYear()]);
  const scan=value=>{
    if(typeof value==="string"){
      const match=value.match(/^(20\\d{2})-\\d{2}/);if(match)found.add(Number(match[1]));
    }else if(Array.isArray(value))value.forEach(scan);
    else if(value&&typeof value==="object")Object.values(value).forEach(scan);
  };
  scan({
    medicoes:data?.medicoes,payments:data?.payments,pagsTerceiros:data?.pagsTerceiros,
    outrasDesp:data?.outrasDesp,pedidos:data?.pedidos,rescisoes:data?.rescisoes,
    attendance:Object.keys(data?.attendance||{}),archives:data?.archivedLaborCosts,
    locacoes:data?.locacoesEquip,
  });
  const sorted=[...found].sort((a,b)=>a-b);
  const max=Math.max(...sorted),min=Math.max(max-9,Math.min(...sorted));
  return Array.from({length:max-min+1},(_,index)=>min+index);
};

const buildProjectionRow = (data,{year,month,period="mes",scope="empresa"}) => {
  const sourceId=`${year}-${String(month+1).padStart(2,"0")}:${period}:${scope}`;
  if(scope==="company_dre"){
    if(period!=="mes")throw new Error("O DRE empresarial aceita apenas a competência mensal.");
    return {sourceId,obraId:"",year,month,period,payload:companyDre(data,year,month)};
  }
  if(scope==="empresa"){
    const result=calculations.calcDREConsolidado(data,year,month,period);
    return {sourceId,obraId:"",year,month,period,payload:numericProjection(result)};
  }
  const result=calculations.calcDREObra(data,scope,year,month,period);
  return {sourceId,obraId:String(scope),year,month,period,payload:numericProjection(result)};
};

// Materialização seletiva usada pelas consultas do DRE. Ela executa o mesmo
// motor da carga integral, mas calcula somente as competências pedidas pela
// tela. Assim uma projeção ausente ou desatualizada é reparada no servidor sem
// obrigar o operador a executar a homologação completa da sombra.
export const buildRequestedDreProjectionRows = (data,requests=[]) => {
  const unique=new Map();
  for(const request of requests){
    const year=Number(request?.year),month=Number(request?.month);
    const period=["mes","q1","q2"].includes(request?.period)?request.period:"mes";
    const scope=String(request?.scope||"empresa");
    if(!Number.isInteger(year)||!Number.isInteger(month)||month<0||month>11||!scope)continue;
    const key=`${year}-${month}:${period}:${scope}`;
    if(!unique.has(key))unique.set(key,{year,month,period,scope});
  }
  return [...unique.values()].map(request=>buildProjectionRow(data,request));
};

export const buildDreProjectionRows = data => {
  const requests=[];
  for(const year of yearsInData(data))for(let month=0;month<12;month++)for(const period of ["mes","q1","q2"]){
    for(const work of data?.obras||[])requests.push({year,month,period,scope:String(work.id)});
    requests.push({year,month,period,scope:"empresa"});
    if(period==="mes")requests.push({year,month,period,scope:"company_dre"});
  }
  return buildRequestedDreProjectionRows(data,requests);
};
