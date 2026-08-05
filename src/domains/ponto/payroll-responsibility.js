export const PAYROLL_PAYER = Object.freeze({
  ADMIN_WORK:"obra_administracao",
  BUILDER:"construtora",
});

const ADMINISTRATION_ONLY_TYPES=new Set(["admin_only","administracao","admin","management"]);

export const payrollPayerForWork = work =>
  ADMINISTRATION_ONLY_TYPES.has(String(work?.contractType || "").trim().toLowerCase())
    ? PAYROLL_PAYER.ADMIN_WORK
    : PAYROLL_PAYER.BUILDER;

export const splitPayrollResponsibility = ({ allocations = [], works = [] } = {}) => {
  const worksById=new Map(works.map(work=>[String(work.id),work]));
  const rows=allocations.map(allocation=>{
    const work=worksById.get(String(allocation.obraId||""));
    const payer=payrollPayerForWork(work);
    return {...allocation,payer,contractType:String(work?.contractType||""),
      payerLabel:payer===PAYROLL_PAYER.ADMIN_WORK
        ? `Obra por administração · ${allocation.obraName||work?.name||"Obra"}`
        : "Construtora"};
  });
  const sum=(payer,field)=>rows.filter(row=>row.payer===payer)
    .reduce((total,row)=>total+Number(row[field]||0),0);
  return {
    rows,
    administrationWorks:rows.filter(row=>row.payer===PAYROLL_PAYER.ADMIN_WORK),
    builder:rows.filter(row=>row.payer===PAYROLL_PAYER.BUILDER),
    totals:{
      administrationWorks:sum(PAYROLL_PAYER.ADMIN_WORK,"netObra"),
      builder:sum(PAYROLL_PAYER.BUILDER,"netObra"),
      total:rows.reduce((total,row)=>total+Number(row.netObra||0),0),
    },
  };
};
