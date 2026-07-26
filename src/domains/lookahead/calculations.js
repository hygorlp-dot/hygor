import { CONSTRAINT_STATUS, LOOKAHEAD_PACKAGE_STATUS } from "./constants.js";

const dateOnly=value=>String(value||"").slice(0,10);
const compareDate=(left,right)=>dateOnly(left).localeCompare(dateOnly(right));
export const isBlockingConstraintOpen=(constraint={},asOf="")=>{
  if(!constraint.bloqueante)return false;
  const status=constraint.status;
  if([CONSTRAINT_STATUS.RELEASED,CONSTRAINT_STATUS.CANCELLED].includes(status))return false;
  return true;
};

export const deriveConstraintStatus=(constraint={},asOf="")=>{
  if([CONSTRAINT_STATUS.RELEASED,CONSTRAINT_STATUS.CANCELLED].includes(constraint.status))return constraint.status;
  if(constraint.dataPrometida&&asOf&&compareDate(constraint.dataPrometida,asOf)<0)return CONSTRAINT_STATUS.OVERDUE;
  return constraint.status||CONSTRAINT_STATUS.OPEN;
};

export const derivePackageReadiness=(workPackage={},constraints=[],asOf="")=>{
  if(workPackage.status===LOOKAHEAD_PACKAGE_STATUS.CANCELLED)return {ready:false,status:LOOKAHEAD_PACKAGE_STATUS.CANCELLED,blockingConstraintIds:[]};
  const linked=constraints.filter(item=>(workPackage.restricaoIds||[]).includes(item.id));
  const blocking=linked.filter(item=>isBlockingConstraintOpen({...item,status:deriveConstraintStatus(item,asOf)},asOf));
  if(blocking.length)return {ready:false,status:LOOKAHEAD_PACKAGE_STATUS.RESTRICTED,blockingConstraintIds:blocking.map(item=>item.id)};
  const status=[LOOKAHEAD_PACKAGE_STATUS.COMMITTED,LOOKAHEAD_PACKAGE_STATUS.IN_PROGRESS,LOOKAHEAD_PACKAGE_STATUS.DONE,LOOKAHEAD_PACKAGE_STATUS.NOT_DONE].includes(workPackage.status)
    ?workPackage.status:LOOKAHEAD_PACKAGE_STATUS.READY;
  return {ready:true,status,blockingConstraintIds:[]};
};

export const projectLookaheadReadiness=(lookahead={},constraints=[],asOf="")=>({
  ...lookahead,
  pacotes:(lookahead.pacotes||[]).map(workPackage=>{
    const readiness=derivePackageReadiness(workPackage,constraints,asOf);
    return {...workPackage,...readiness,readyDate:readiness.ready?(workPackage.readyDate||asOf||""):""};
  }),
});
