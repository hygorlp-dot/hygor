export const UNION_DUE_GROUP=Object.freeze({PROFESSIONAL:"professional",HELPER:"helper",EXEMPT:"exempt"});

export const normalizeUnionDuesConfig=input=>{
  const config=input&&typeof input==="object"?input:{};
  return {
    enabled:config.enabled===true,
    frequency:config.frequency==="every_payroll"?"every_payroll":"monthly",
    monthlyCycle:String(config.monthlyCycle)==="1"?"1":"2",
    professionalValue:Math.max(0,Number(config.professionalValue||0)),
    helperValue:Math.max(0,Number(config.helperValue||0)),
    roleGroups:config.roleGroups&&typeof config.roleGroups==="object"?{...config.roleGroups}:{},
    effectiveFrom:/^\d{4}-\d{2}-\d{2}$/.test(String(config.effectiveFrom||""))?String(config.effectiveFrom):"",
    updatedAt:String(config.updatedAt||""),
    updatedBy:String(config.updatedBy||""),
  };
};

export const normalizeRoleKey=value=>String(value||"").trim().toLocaleLowerCase("pt-BR");

const unionDueGroupForEmployee=(employee,configInput)=>{
  const config=normalizeUnionDuesConfig(configInput);
  return config.roleGroups[normalizeRoleKey(employee?.role)]||UNION_DUE_GROUP.EXEMPT;
};

const shouldApplyUnionDue=(configInput,payrollCycle,periodEnd="")=>{
  const config=normalizeUnionDuesConfig(configInput);
  if(!config.enabled)return false;
  if(config.effectiveFrom&&periodEnd&&periodEnd<config.effectiveFrom)return false;
  return config.frequency==="every_payroll"||config.monthlyCycle===String(payrollCycle);
};

export const calculateUnionDue=({employee,config:configInput,payrollCycle,periodEnd="",hasPayrollMovement=true}={})=>{
  const config=normalizeUnionDuesConfig(configInput);
  const group=unionDueGroupForEmployee(employee,config);
  if(!hasPayrollMovement||!shouldApplyUnionDue(config,payrollCycle,periodEnd))return {amount:0,group,applied:false};
  const amount=group===UNION_DUE_GROUP.PROFESSIONAL?config.professionalValue
    :group===UNION_DUE_GROUP.HELPER?config.helperValue:0;
  return {amount,group,applied:amount>0};
};

// Liquidação canônica da remuneração. O desconto sindical reduz o valor que
// sai para o funcionário, mas nunca cria pagamento negativo. O valor aplicado
// é devolvido separadamente para o recolhimento ao sindicato permanecer
// auditável nos relatórios e na conciliação.
export const calculatePayrollSettlement=({gross=0,benefits=0,advances=0,unionDue=0}={})=>{
  const value=valueInput=>Number.isFinite(Number(valueInput))?Number(valueInput):0;
  const netBeforeUnion=Math.max(0,value(gross)+value(benefits)-Math.max(0,value(advances)));
  const requestedUnionDue=Math.max(0,value(unionDue));
  const appliedUnionDue=Math.min(netBeforeUnion,requestedUnionDue);
  return {
    netBeforeUnion,
    requestedUnionDue,
    appliedUnionDue,
    netPayable:netBeforeUnion-appliedUnionDue,
  };
};

export const allocateUnionDueByWork=(allocations=[],unionDue=0)=>{
  const rows=(allocations||[]).map(row=>({...row}));
  const totalBase=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.netObra||0)),0);
  const due=Math.min(Math.max(0,Number(unionDue||0)),totalBase);
  let allocated=0;
  rows.forEach((row,index)=>{
    const base=Math.max(0,Number(row.netObra||0));
    const share=index===rows.length-1?due-allocated:(totalBase?due*(base/totalBase):0);
    const safeShare=Math.min(base,Math.max(0,share));
    allocated+=safeShare;
    row.unionDueObra=safeShare;
    row.netBeforeUnionObra=base;
    row.netObra=base-safeShare;
  });
  return rows;
};

export const summarizeUnionDues=rows=>(rows||[]).reduce((summary,row)=>{
  const amount=Math.max(0,Number(row?.unionDue||0));
  summary.total+=amount;
  if(row?.unionDueGroup===UNION_DUE_GROUP.PROFESSIONAL){summary.professionals+=1;summary.professionalTotal+=amount;}
  if(row?.unionDueGroup===UNION_DUE_GROUP.HELPER){summary.helpers+=1;summary.helperTotal+=amount;}
  return summary;
},{total:0,professionals:0,helpers:0,professionalTotal:0,helperTotal:0});
