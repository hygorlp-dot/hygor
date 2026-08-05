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

export const unionDueGroupForEmployee=(employee,configInput)=>{
  const config=normalizeUnionDuesConfig(configInput);
  return config.roleGroups[normalizeRoleKey(employee?.role)]||UNION_DUE_GROUP.EXEMPT;
};

export const shouldApplyUnionDue=(configInput,payrollCycle,periodEnd="")=>{
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

export const summarizeUnionDues=rows=>(rows||[]).reduce((summary,row)=>{
  const amount=Math.max(0,Number(row?.unionDue||0));
  summary.total+=amount;
  if(row?.unionDueGroup===UNION_DUE_GROUP.PROFESSIONAL){summary.professionals+=1;summary.professionalTotal+=amount;}
  if(row?.unionDueGroup===UNION_DUE_GROUP.HELPER){summary.helpers+=1;summary.helperTotal+=amount;}
  return summary;
},{total:0,professionals:0,helpers:0,professionalTotal:0,helperTotal:0});
