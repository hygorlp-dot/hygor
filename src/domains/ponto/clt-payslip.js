// Ordinary monthly payroll. Does not settle a payment or write to the DRE.
// Tax tables are deliberately versioned: never extrapolate these to a new year.
export const CLT_SOURCES = Object.freeze({
  cct:"PE000665/2026 · CCT Caruaru 2026/2028 · cláusulas 3, 7, 14, 18, 19, 37, 39 e 72",
  inss:"https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal",
  irrf:"https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026",
});
export const CARUARU_PROFILE = Object.freeze({
  name:"Caruaru · Construção civil", effectiveFrom:"2026-05-01", effectiveTo:"2027-04-30",
  helperFloor:1810.60, professionalFloor:2406.80, divisor:220,
  overtimePercent:70, extraordinaryPercent:100, fgtsPercent:8,
  trainingPercent:5, transportPercent:6, unionPercent:2, unionCap:48.14,
});
export const money = value => Math.round(((Number(value)||0)+1e-8)*100)/100;
const n = value => Number(value)||0;
export function progressiveInss2026(base) {
  let previous=0,total=0;
  for(const [limit,rate] of [[1621,.075],[2902.84,.09],[4354.27,.12],[8475.55,.14]]) {
    total+=Math.max(0,Math.min(n(base),limit)-previous)*rate;
    previous=limit;
  }
  return money(total);
}
export function monthlyIrrf2026(taxable,legalDeductions=0) {
  const deduction=Math.max(607.20,n(legalDeductions));
  const base=money(Math.max(0,n(taxable)-deduction));
  const [rate,offset]=base<=2428.80?[0,0]:base<=2826.65?[.075,182.16]:base<=3751.05?[.15,394.16]:base<=4664.68?[.225,675.49]:[.275,908.73];
  const before=money(Math.max(0,base*rate-offset));
  const reduction=n(taxable)<=5000?before:n(taxable)<=7350?Math.min(before,Math.max(0,978.62-.133145*n(taxable))):0;
  return {base,deduction,amount:money(Math.max(0,before-reduction))};
}
export function newCltDraft(competence,profile={}) {
  const [year,month]=competence.split("-").map(Number);
  return {competence,paymentDate:new Date(Date.UTC(year,month,5)).toISOString().slice(0,10),
    salary:profile.salary||"",category:profile.category||"professional",days:30,workedDays:"",absenceDays:0,dsrLostDays:0,
    overtimeHours:0,extraordinaryHours:0,dsrWorkingDays:0,dsrRestDays:0,dependents:0,alimony:0,
    transportCost:0,transportDays:0,trainingEligible:false,basketEligible:false,unionAuthorized:false,
    advanceIds:[],otherTaxable:0,otherDeductions:0,previousIrrf:0,custom:[],notes:"",cbo:profile.cbo||"",registration:profile.registration||"",
    fiscalMode:"automatic",manualInss:"",manualIrrf:"",manualIrrfBase:"",manualReason:"",confirmed:false,
    rules:{...CARUARU_PROFILE,...profile.rules}};
}
export function calculateCltPayslip(draft) {
  const d=draft,r=d.rules,errors=[];
  const numeric=["salary","days","workedDays","absenceDays","dsrLostDays","overtimeHours","extraordinaryHours","dsrWorkingDays","dsrRestDays","dependents","alimony","transportCost","transportDays","otherTaxable","otherDeductions","previousIrrf"];
  for(const key of numeric) if(d[key]===""||!Number.isFinite(Number(d[key]))||n(d[key])<0) errors.push("Preencha os campos numéricos com valores válidos, sem deixar vazios ou negativos.");
  if(!(n(d.salary)>0))errors.push("Informe o salário contratual mensal; a diária não é convertida automaticamente.");
  if(n(d.days)>30||n(d.days)<=0||n(d.absenceDays)+n(d.dsrLostDays)>n(d.days))errors.push("Confira os dias de salário, faltas e DSR perdido (base mensal de 30 dias).");
  if(!Number.isInteger(n(d.dependents)))errors.push("Dependentes deve ser um número inteiro.");
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.competence)||!/^\d{4}-\d{2}-\d{2}$/.test(d.paymentDate))errors.push("Informe competência e data de pagamento válidas.");
  if(d.competence<r.effectiveFrom?.slice(0,7)||d.competence>r.effectiveTo?.slice(0,7))errors.push("A competência está fora da vigência econômica deste perfil. Atualize a CCT e suas regras.");
  if(!r.name?.trim()||!(n(r.divisor)>0)||!r.effectiveFrom||!r.effectiveTo||r.effectiveTo<r.effectiveFrom)errors.push("Complete o nome, a vigência e o divisor do perfil.");
  for(const key of ["helperFloor","professionalFloor","overtimePercent","extraordinaryPercent","fgtsPercent","trainingPercent","transportPercent","unionPercent","unionCap"])if(!Number.isFinite(Number(r[key]))||n(r[key])<0)errors.push(`Regra inválida: ${key}.`);
  if(n(r.overtimePercent)<50||n(r.extraordinaryPercent)<100||n(r.transportPercent)>6)errors.push("Adicionais e desconto de transporte não podem reduzir os limites legais.");
  const floor=n(d.category==="helper"?r.helperFloor:r.professionalFloor);
  if(n(d.salary)<floor)errors.push("Salário contratual abaixo do piso selecionado. Confira a categoria e o contrato.");
  if(d.fiscalMode==="automatic"&&(d.competence.slice(0,4)!=="2026"||d.paymentDate.slice(0,4)!=="2026"))errors.push("Cálculo automático disponível para competência e pagamento em 2026. Informe tributos apurados pela contabilidade para outro período.");
  if(d.fiscalMode==="manual"&&(!d.manualReason?.trim()||[d.manualInss,d.manualIrrf,d.manualIrrfBase].some(v=>v===""||v==null||!Number.isFinite(Number(v))||n(v)<0)))errors.push("Informe INSS, IRRF, a base do IRRF e a origem da apuração contábil.");
  if(!d.confirmed)errors.push("Confirme os dados contratuais, os eventos e a tributação do mês antes de exportar.");
  if(n(d.workedDays)>31||n(d.transportDays)>30)errors.push("Confira os dias trabalhados e de concessão de transporte.");
  if(d.basketEligible&&(n(d.salary)>4500||n(d.workedDays)<15||n(d.absenceDays)>0))errors.push("Os dados informados não atendem aos critérios da cesta básica da CCT.");
  if(d.fiscalMode==="automatic"&&(d.advances||[]).some(a=>String(a.date).slice(0,7)!==d.paymentDate.slice(0,7)))errors.push("Há adiantamentos pagos em mês diferente do saldo. Informe o INSS e o IRRF apurados pela contabilidade por regime de caixa.");
  const rows=[];
  const add=(code,label,value,kind="earning",tax=true,reference="")=>{const amount=money(value);if(amount!==0)rows.push({code,label,amount,kind,inss:tax,irrf:tax,fgts:tax,reference});};
  add("001","Salário mensal",n(d.salary)/30*n(d.days),"earning",true,`${d.days}/30 dias`);
  const hourly=n(d.salary)/Math.max(1,n(r.divisor));
  const he=money(hourly*(1+n(r.overtimePercent)/100)*n(d.overtimeHours));
  const extra=money(hourly*(1+n(r.extraordinaryPercent)/100)*n(d.extraordinaryHours));
  add("010",`Horas extras ${r.overtimePercent}%`,he,"earning",true,`${d.overtimeHours} h`);
  add("011",`Horas extras ${r.extraordinaryPercent}%`,extra,"earning",true,`${d.extraordinaryHours} h`);
  if(he+extra>0&&!(n(d.dsrWorkingDays)>0))errors.push("Informe os dias úteis para calcular o DSR das horas extras.");
  add("012","DSR sobre horas extras",(he+extra)/Math.max(1,n(d.dsrWorkingDays))*n(d.dsrRestDays),"earning",true,`${d.dsrRestDays} repousos / ${d.dsrWorkingDays} dias úteis`);
  if(d.trainingEligible)add("020","Incentivo à formação (CCT, cl. 14)",n(r.professionalFloor)*n(r.trainingPercent)/100);
  if(d.basketEligible)add("030","Cesta básica (CCT, cl. 18)",d.competence>="2027-05"?90:65,"earning",false,"Elegibilidade confirmada");
  add("100","Faltas não justificadas",n(d.salary)/30*n(d.absenceDays),"deduction",true,`${d.absenceDays} dias`);
  add("101","DSR perdido",n(d.salary)/30*n(d.dsrLostDays),"deduction",true,`${d.dsrLostDays} dias`);
  add("110","Vale-transporte",Math.min(n(d.transportCost),n(d.salary)*n(r.transportPercent)/100*n(d.transportDays)/30),"deduction",false,`${d.transportDays} dias · custo ${money(d.transportCost)}`);
  if(d.unionAuthorized)add("120","Taxa assistencial Caruaru (cl. 72)",Math.min(n(d.salary)*n(r.unionPercent)/100,n(r.unionCap)),"deduction",false,"Aplicabilidade e oposição verificadas");
  for(const item of d.custom||[]) {
    if(!item.label?.trim()||!Number.isFinite(Number(item.amount))||n(item.amount)<0||!["earning","deduction","info"].includes(item.kind))errors.push("Complete a descrição, o tipo e o valor de cada rubrica adicional.");
    rows.push({...item,amount:money(item.amount),code:"MAN",reference:item.reference||"Informado",inss:!!item.inss,irrf:!!item.irrf,fgts:!!item.fgts});
  }
  const base=flag=>money(Math.max(0,rows.reduce((s,row)=>s+(row.kind==="info"||!row[flag]?0:row.amount*(row.kind==="deduction"?-1:1)),0)));
  const inssBase=base("inss"),taxable=base("irrf"),fgtsBase=base("fgts");
  const inss=d.fiscalMode==="manual"?money(d.manualInss):progressiveInss2026(inssBase);
  const irrfCalculation=monthlyIrrf2026(taxable+n(d.otherTaxable),inss+n(d.dependents)*189.59+n(d.alimony)+n(d.otherDeductions));
  const irrf=d.fiscalMode==="manual"?money(d.manualIrrf):money(Math.max(0,irrfCalculation.amount-n(d.previousIrrf)));
  add("200","INSS do empregado",inss,"deduction",false);
  add("201","IRRF",irrf,"deduction",false);
  add("202","Pensão alimentícia judicial",n(d.alimony),"deduction",false);
  add("210","Adiantamentos compensados",(d.advances||[]).reduce((s,a)=>s+n(a.amount),0),"deduction",false,(d.advances||[]).map(a=>a.id).join(", "));
  const gross=money(rows.filter(v=>v.kind==="earning").reduce((s,v)=>s+v.amount,0));
  const deductions=money(rows.filter(v=>v.kind==="deduction").reduce((s,v)=>s+v.amount,0));
  const net=money(gross-deductions);
  if(net<0)errors.push("Os descontos excedem os proventos. Resolva a diferença antes de exportar.");
  return {rows,gross,deductions,net,inss,inssBase,irrf,irrfBase:d.fiscalMode==="manual"?money(d.manualIrrfBase):irrfCalculation.base,fgtsBase,fgts:money(fgtsBase*n(r.fgtsPercent)/100),errors:[...new Set(errors)]};
}
