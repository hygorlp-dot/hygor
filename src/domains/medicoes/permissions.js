const MEASUREMENT_OPERATOR_ROLES=new Set(["admin","engenheiro","engenheiro_auditor"]);

export const canOperateTechnicalMeasurement=(user={},obraId="")=>{
  if(!MEASUREMENT_OPERATOR_ROLES.has(String(user?.role||"")))return false;
  return user?.role==="admin"||!user?.obraId||String(user.obraId)===String(obraId);
};
