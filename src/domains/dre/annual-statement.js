import { COMPANY_EXPENSE_CATEGORIES } from "./expense-taxonomy.js";

export const ANNUAL_GROUPS = [
  { id:"revenue", label:"Receita bruta", sign:1 },
  { id:"deductions", label:"Deduções da receita", sign:-1 },
  { id:"costs", label:"Custos das obras e locações", sign:-1 },
  { id:"operating", label:"Despesas operacionais da empresa", sign:-1 },
  { id:"financial", label:"Despesas financeiras", sign:-1 },
  { id:"tax", label:"Provisões de tributos sobre o lucro", sign:-1 },
];
const source = (id,label,group) => ({ id,label,group });
export const ANNUAL_SOURCES = [
  source("faturamentoObras","Receitas de obras","revenue"),
  source("receitaLocacoes","Receitas das locações","revenue"),
  source("receitaCorporativa","Outras receitas da empresa","revenue"),
  source("revenueResidual","Arredondamento das receitas","revenue"),
  source("descontoLocacoes","Descontos nas locações","deductions"),
  source("deducaoISS","ISS sobre a receita","deductions"),
  source("deducaoPIS","PIS sobre a receita","deductions"),
  source("deducaoCOFINS","COFINS sobre a receita","deductions"),
  source("deductionResidual","Arredondamento das deduções","deductions"),
  source("laborTotal","Mão de obra das obras","costs"),
  source("benefTotal","Benefícios da mão de obra","costs"),
  source("tercTotal","Terceirizados das obras","costs"),
  source("rescTotal","Rescisões das obras","costs"),
  source("outrasDiretas","Compras, equipamentos e outras despesas das obras","costs"),
  source("repasseEquipamentosTerceiros","Repasses de equipamentos de terceiros","costs"),
  source("manutencaoLocacoes","Manutenção das locações","costs"),
  // Residual explícito garante que uma diferença de arredondamento ou novo
  // componente de custo no motor nunca desapareça do resultado apresentado.
  source("costResidual","Outros custos reconhecidos / ajuste de arredondamento","costs"),
  ...COMPANY_EXPENSE_CATEGORIES.map(item=>source(`category:${item.id}`,item.label,item.group==="financeiro"?"financial":"operating")),
  source("operatingResidual","Outras despesas reconhecidas / ajuste de arredondamento","operating"),
  source("provisaoIR","Provisão de IR sobre o lucro","tax"),
  source("provisaoCSLL","Provisão de CSLL sobre o lucro","tax"),
  source("taxResidual","Arredondamento do resultado","tax"),
];
const sourceById = new Map(ANNUAL_SOURCES.map(item=>[item.id,item]));
const cents = value => Math.round(Number(value || 0)*100);
const sum = values => values.reduce((total,value)=>total+value,0);

export const defaultAnnualLayout = () => ({ version:0, rows:ANNUAL_SOURCES.map((item,index)=>({
  id:`default_${index}`, label:item.label, group:item.group, sources:[item.id],
})) });

export function validateAnnualRows(rows) {
  if(!Array.isArray(rows)||!rows.length||rows.length>150)throw new Error("Use entre 1 e 150 linhas no DRE.");
  const ids=new Set(), used=new Set();
  const clean=rows.map(row=>{
    const id=String(row?.id||""),label=String(row?.label||"").trim(),group=String(row?.group||"");
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id))throw new Error("Identificação de linha inválida ou repetida.");
    if(!label||label.length>120)throw new Error("Informe um nome de até 120 caracteres para cada linha.");
    if(!ANNUAL_GROUPS.some(item=>item.id===group))throw new Error("Grupo contábil inválido.");
    if(!Array.isArray(row.sources))throw new Error("Selecione as fontes da linha.");
    ids.add(id);
    const sources=row.sources.map(value=>{
      const metric=sourceById.get(value);
      if(!metric||metric.group!==group)throw new Error("Fonte incompatível com o grupo da linha.");
      if(used.has(value))throw new Error("Cada fonte deve alimentar uma única linha do DRE.");
      used.add(value);return value;
    });
    return {id,label,group,sources};
  });
  if(used.size!==ANNUAL_SOURCES.length)throw new Error("Todas as fontes devem permanecer vinculadas. Transfira as fontes antes de excluir uma linha.");
  return clean;
}

export function readAnnualLayout(config={}) {
  if(!config.dreAnnualLayout)return defaultAnnualLayout();
  const layout=config.dreAnnualLayout;
  return {...layout,rows:validateAnnualRows(layout.rows)};
}

export function saveAnnualLayout(data,rows,expectedVersion,actor,now=new Date().toISOString()) {
  const clean=validateAnnualRows(rows),current=readAnnualLayout(data.config);
  // Resposta perdida pode ser repetida sem incrementar a versão novamente.
  if(current.version!==Number(expectedVersion)){
    if(current.version===Number(expectedVersion)+1&&JSON.stringify(current.rows)===JSON.stringify(clean))return {data,layout:current,unchanged:true};
    throw new Error("O DRE foi ajustado por outra pessoa. Atualize a página antes de salvar.");
  }
  const layout={version:current.version+1,rows:clean,updatedAt:now,updatedBy:String(actor.id)};
  return {data:{...data,config:{...data.config,version:Number(data.config?.version||0)+1,dreAnnualLayout:layout}},layout};
}

export function annualSourceValues(month={}) {
  const values=Object.fromEntries(ANNUAL_SOURCES.map(item=>[item.id,cents(item.id.startsWith("category:")?month.despPorCat?.[item.id.slice(9)]:month[item.id])]));
  const subtotal=group=>sum(ANNUAL_SOURCES.filter(item=>item.group===group).map(item=>values[item.id]));
  values.revenueResidual=month.faturamentoTotal==null?0:cents(month.faturamentoTotal)-subtotal("revenue");
  values.deductionResidual=month.totalDeducoes==null?0:cents(month.totalDeducoes)-subtotal("deductions");
  values.costResidual=cents(month.totalCSP)-sum(ANNUAL_SOURCES.filter(item=>item.group==="costs"&&item.id!=="costResidual").map(item=>values[item.id]));
  values.operatingResidual=cents(month.totalDespOp)-sum(COMPANY_EXPENSE_CATEGORIES.map(item=>values[`category:${item.id}`]));
  values.taxResidual=month.lucroLiquido==null?0:subtotal("revenue")-subtotal("deductions")-subtotal("costs")-subtotal("operating")-subtotal("financial")-subtotal("tax")-cents(month.lucroLiquido);
  return values;
}

export function buildAnnualStatement(months,layout=defaultAnnualLayout()) {
  const clean=validateAnnualRows(layout.rows);
  const sourceMonths=Array.from({length:12},(_,index)=>annualSourceValues(months[index]));
  const rows=clean.map(row=>({...row,values:sourceMonths.map(values=>sum(row.sources.map(id=>values[id])))}));
  const result=[];
  let running=Array(12).fill(0);
  const pushTotal=(id,label,values,margin=false)=>result.push({id,label,values,total:sum(values),kind:margin?"margin":"subtotal"});
  let netRevenue=Array(12).fill(0);
  for(const group of ANNUAL_GROUPS){
    const children=rows.filter(row=>row.group===group.id);
    result.push({id:group.id,label:group.label,kind:"group"});
    children.forEach(row=>result.push({...row,kind:"line",total:sum(row.values)}));
    const totals=sourceMonths.map((_,index)=>sum(children.map(row=>row.values[index])));
    running=running.map((value,index)=>value+totals[index]*group.sign);
    if(group.id==="revenue")pushTotal("grossRevenue","Receita bruta total",running.slice());
    if(group.id==="deductions"){netRevenue=running.slice();pushTotal("netRevenue","Receita líquida",running.slice());}
    if(group.id==="costs")pushTotal("grossProfit","Lucro bruto",running.slice());
    if(group.id==="operating")pushTotal("operatingResult","Resultado antes das despesas financeiras",running.slice());
    if(group.id==="financial")pushTotal("pretaxProfit","Resultado antes das provisões de IR / CSLL",running.slice());
    if(group.id==="tax"){
      pushTotal("netProfit","Lucro líquido",running.slice());
      const margins=running.map((value,index)=>netRevenue[index]?value/netRevenue[index]*100:null);
      result.push({id:"netMargin",label:"Margem líquida",kind:"margin",values:margins,total:sum(netRevenue)?sum(running)/sum(netRevenue)*100:null});
    }
  }
  return result;
}
