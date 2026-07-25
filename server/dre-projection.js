import { createDreCalculations } from "../src/domains/dre/calculations.js";
import { calcEquipMes, diasLocacaoNoPeriodo } from "../src/domains/equipamentos/calculations.js";

const inactive = new Set([
  "cancelado", "cancelada", "cancelled", "canceled",
  "estornado", "estornada", "reversed", "arquivado", "arquivada",
]);
const active = item => !inactive.has(String(item?.status || "").toLowerCase());
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

const parseIso = iso => {
  const [y,m,d]=String(iso).split("-").map(Number);
  return new Date(y,m-1,d,12);
};
const addDays = (date,days) => {
  const next=new Date(date);next.setDate(next.getDate()+days);
  return new Date(next.getFullYear(),next.getMonth(),next.getDate(),12);
};
const easter = year => {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  return new Date(year,Math.floor((h+l-7*m+114)/31)-1,((h+l-7*m+114)%31)+1,12);
};
const holidays = (data,year) => {
  const pascoa=easter(year);
  return [...new Set([
    `${year}-01-01`,`${year}-04-21`,`${year}-05-01`,`${year}-09-07`,`${year}-10-12`,
    `${year}-11-02`,`${year}-11-15`,`${year}-11-20`,`${year}-12-25`,`${year}-03-06`,
    localIso(addDays(pascoa,-2)),`${year}-05-18`,localIso(addDays(pascoa,60)),
    `${year}-06-24`,`${year}-09-15`,
    ...(data?.config?.paymentHolidays||[]).map(item=>typeof item==="string"?item:item?.date||""),
  ].filter(Boolean))].sort();
};
const getAtt = (data,employeeId,date) => {
  const item=data?.attendance?.[employeeId]?.[date];
  return typeof item==="string"?{status:item}:item||{};
};
const employed = (employee,date) =>
  !(employee?.startDate&&date<employee.startDate)&&!(employee?.endDate&&date>employee.endDate);
const previousWorkday = (iso,all) => {
  let date=addDays(parseIso(iso),-1);
  while([0,6].includes(date.getDay())||all.includes(localIso(date)))date=addDays(date,-1);
  return localIso(date);
};
const nextWorkday = (iso,all) => {
  let date=addDays(parseIso(iso),1);
  while([0,6].includes(date.getDay())||all.includes(localIso(date)))date=addDays(date,1);
  return localIso(date);
};

const laborCost = (data,obraId,days) => {
  const all=holidays(data,Number(days[0]?.slice(0,4)||new Date().getFullYear()));
  const inPeriod=days.filter(date=>all.includes(date)&&![0,6].includes(parseIso(date).getDay()));
  let labor=0,benefits=0;
  for(const employee of data?.employees||[]){
    const obraOn=date=>getAtt(data,employee.id,date)?.obraId||employee.obra||"";
    for(const date of days){
      if(obraOn(date)!==obraId||!employed(employee,date)||inPeriod.includes(date))continue;
      const status=getAtt(data,employee.id,date)?.status;
      const factor=status==="P"?1:(status==="M"?0.5:0);
      if(factor){labor+=Number(employee.dailyRate||0)*factor;benefits+=(Number(employee.vtDaily||0)+Number(employee.vrDaily||0))*factor;}
    }
    for(const date of inPeriod){
      if(!employed(employee,date)||obraOn(date)!==obraId)continue;
      const absentBefore=getAtt(data,employee.id,previousWorkday(date,all))?.status==="F";
      const absentAfter=getAtt(data,employee.id,nextWorkday(date,all))?.status==="F";
      if(!absentBefore&&!absentAfter)labor+=Number(employee.dailyRate||0);
    }
  }
  const selected=new Set(days);
  for(const archive of Object.values(data?.archivedLaborCosts||{})){
    for(const [date,works] of Object.entries(archive?.byDate||{})){
      if(!selected.has(date))continue;
      labor+=Number(works?.[obraId]?.laborCost||0);
      benefits+=Number(works?.[obraId]?.benefitCost||0);
    }
  }
  return {laborCost:round(labor),benefitCost:round(benefits),totalCost:round(labor+benefits)};
};

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
  const rows=(data?.equipamentos||[]).map(equipment=>calcEquipMes(data,equipment.id,ym));
  const total=rows.reduce((acc,row)=>({
    receita:acc.receita+row.receita,custoDono:acc.custoDono+row.custoDono,
    manut:acc.manut+row.manut,lucro:acc.lucro+row.lucro,
  }),{receita:0,custoDono:0,manut:0,lucro:0});
  return {...total,receitaProprios:0,receitaTerceiros:0};
};

const calculations=createDreCalculations({
  getDays,getQ,monthName:month=>String(month+1),
  calcObraLaborCost:laborCost,calcObraTercCost:thirdWork,
  calcTercEmpresaCost:thirdCompany,calcObraTercEmpresaCost:thirdCompanyWork,
  calcObraComprasCost:purchases,calcEquipCustoObra:equipmentWork,
  calcEquipFaturamentoEmpresa:equipmentCompany,
});

const expenseCategories=[
  ["aluguel","admin"],["pessoal_admin","admin"],["terceiros","admin"],["contabilidade","admin"],
  ["energia","admin"],["comunicacao","admin"],["material_adm","admin"],["software","admin"],
  ["veiculo","admin"],["imposto_simples","fiscal"],["imposto_ir","fiscal"],["taxa_cartorio","fiscal"],
  ["crea","fiscal"],["seg_fianca","outros"],["outros","outros"],
];
const companyDre = (data,year,month) => {
  const ym=`${year}-${String(month+1).padStart(2,"0")}`,days=getDays(year,month),cfg=data?.config||{};
  const measurements=(data?.medicoes||[]).filter(item=>active(item)&&item.competencia===ym);
  const faturamentoObras=measurements.reduce((sum,item)=>sum+Number(item.valorPrevisto||0),0);
  const recebidoObras=measurements.filter(item=>item.recebido)
    .reduce((sum,item)=>sum+Number(item.valorRecebido||0),0)
    +(data?.payments||[]).filter(item=>active(item)&&item.date?.startsWith(ym))
      .reduce((sum,item)=>sum+Number(item.amount||0),0);
  const deducaoISS=faturamentoObras*Number(cfg.aliquotaISS||0)/100;
  const deducaoPIS=faturamentoObras*Number(cfg.aliquotaPIS||0)/100;
  const deducaoCOFINS=faturamentoObras*Number(cfg.aliquotaCOFINS||0)/100;
  const totalDeducoes=deducaoISS+deducaoPIS+deducaoCOFINS,receitaLiquida=faturamentoObras-totalDeducoes;
  const laborTotal=(data?.obras||[]).reduce((sum,work)=>sum+laborCost(data,work.id,days).laborCost,0);
  const benefTotal=(data?.obras||[]).reduce((sum,work)=>sum+laborCost(data,work.id,days).benefitCost,0);
  const tercTotal=(data?.pagsTerceiros||[]).filter(item=>active(item)&&item.date?.startsWith(ym))
    .reduce((sum,item)=>sum+Number(item.amount||0),0);
  const rescTotal=(data?.rescisoes||[]).filter(item=>active(item)&&item.demissao?.startsWith(ym))
    .reduce((sum,item)=>sum+Number(item.totalLiquido||0),0);
  const outrasDiretas=(data?.outrasDesp||[]).filter(item=>active(item)&&item.competencia===ym)
    .reduce((sum,item)=>sum+Number(item.valor||0),0);
  const totalCSP=laborTotal+benefTotal+tercTotal+rescTotal+outrasDiretas;
  const lucroBruto=receitaLiquida-totalCSP,margemBruta=receitaLiquida?lucroBruto/receitaLiquida*100:0;
  const despEmp=(data?.despesasEmpresa||[]).filter(item=>active(item)&&item.competencia===ym);
  const despPorCat=Object.fromEntries(expenseCategories.map(([category])=>[
    category,round(despEmp.filter(item=>item.categoria===category).reduce((sum,item)=>sum+Number(item.valor||0),0)),
  ]));
  const sumGroup=group=>expenseCategories.filter(([,itemGroup])=>itemGroup===group)
    .reduce((sum,[category])=>sum+Number(despPorCat[category]||0),0);
  const totalDespAdmin=sumGroup("admin"),totalDespFiscal=sumGroup("fiscal"),totalDespOutros=sumGroup("outros");
  const totalDespOp=totalDespAdmin+totalDespFiscal+totalDespOutros;
  const ebitda=lucroBruto-totalDespOp,margemEbitda=receitaLiquida?ebitda/receitaLiquida*100:0;
  const resultFinanceiro=0,lair=ebitda;
  const provisaoIR=lair>0?lair*Number(cfg.aliquotaIR||0)/100:0;
  const provisaoCSLL=lair>0?lair*Number(cfg.aliquotaCSLL||0)/100:0;
  const totalImpostoLucro=provisaoIR+provisaoCSLL,lucroLiquido=lair-totalImpostoLucro;
  const margemLiquida=receitaLiquida?lucroLiquido/receitaLiquida*100:0;
  const porObra=(data?.obras||[]).map(work=>{
    const labor=laborCost(data,work.id,days);
    const receitaMed=measurements.filter(item=>item.obraId===work.id).reduce((sum,item)=>sum+Number(item.valorPrevisto||0),0);
    const receitaLivre=(data?.payments||[]).filter(item=>active(item)&&item.obraId===work.id&&item.date?.startsWith(ym))
      .reduce((sum,item)=>sum+Number(item.amount||0),0);
    const receita=receitaMed+receitaLivre;
    const terc=(data?.pagsTerceiros||[]).filter(item=>active(item)&&item.obraId===work.id&&item.date?.startsWith(ym))
      .reduce((sum,item)=>sum+Number(item.amount||0),0);
    const outras=(data?.outrasDesp||[]).filter(item=>active(item)&&item.obraId===work.id&&item.competencia===ym)
      .reduce((sum,item)=>sum+Number(item.valor||0),0);
    const despesa=labor.laborCost+labor.benefitCost+terc+outras,resultado=receita-despesa;
    return {id:work.id,name:work.name,status:work.status,receita:round(receita),receitaMed:round(receitaMed),
      receitaLivre:round(receitaLivre),laborCost:labor.laborCost,benefitCost:labor.benefitCost,terc:round(terc),
      outras:round(outras),despesa:round(despesa),resultado:round(resultado),
      margemPct:receita?round(resultado/receita*100):null};
  }).filter(item=>item.receita||item.despesa).sort((a,b)=>b.resultado-a.resultado);
  return Object.fromEntries(Object.entries({
    ym,faturamentoObras,recebidoObras,deducaoISS,deducaoPIS,deducaoCOFINS,totalDeducoes,receitaLiquida,
    laborTotal,benefTotal,tercTotal,rescTotal,outrasDiretas,totalCSP,lucroBruto,margemBruta,
    despPorCat,totalDespAdmin,totalDespFiscal,totalDespOutros,totalDespOp,ebitda,margemEbitda,
    resultFinanceiro,lair,provisaoIR,provisaoCSLL,totalImpostoLucro,lucroLiquido,margemLiquida,despEmp,porObra,
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

export const buildDreProjectionRows = data => {
  const rows=[];
  for(const year of yearsInData(data))for(let month=0;month<12;month++)for(const period of ["mes","q1","q2"]){
    for(const work of data?.obras||[]){
      const result=calculations.calcDREObra(data,work.id,year,month,period);
      rows.push({
        sourceId:`${year}-${String(month+1).padStart(2,"0")}:${period}:${work.id}`,
        obraId:String(work.id),year,month,period,payload:numericProjection(result),
      });
    }
    const result=calculations.calcDREConsolidado(data,year,month,period);
    rows.push({
      sourceId:`${year}-${String(month+1).padStart(2,"0")}:${period}:empresa`,
      obraId:"",year,month,period,payload:numericProjection(result),
    });
    if(period==="mes")rows.push({
      sourceId:`${year}-${String(month+1).padStart(2,"0")}:mes:company_dre`,
      obraId:"",year,month,period,payload:companyDre(data,year,month),
    });
  }
  return rows;
};
