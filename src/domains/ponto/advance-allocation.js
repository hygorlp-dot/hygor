// Mantém o rateio por dias e redistribui a parcela que excede o saldo de
// uma obra para as demais, na ordem recebida (dias trabalhados decrescentes).
export const allocateAdvancesByWork=(allocations=[],advances=0)=>{
  const positive=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const rows=allocations.map(row=>({...row,advancesObra:0}));
  const capacities=rows.map(row=>positive(Number(row.bruto||0)+Number(row.vt||0)+Number(row.vr||0)));
  const totalCapacity=capacities.reduce((sum,value)=>sum+value,0);
  const target=Math.min(positive(advances),totalCapacity);
  const totalDays=rows.reduce((sum,row)=>sum+positive(row.diasTrabalhados),0);
  let remaining=target;
  rows.forEach((row,index)=>{
    const share=totalDays?target*positive(row.diasTrabalhados)/totalDays:0;
    row.advancesObra=Math.min(capacities[index],share,remaining);
    remaining-=row.advancesObra;
  });
  // Sem dias, usa primeiro a primeira obra com saldo. Também absorve os
  // resíduos de ponto flutuante, sem ajustar apenas o líquido da obra.
  rows.forEach((row,index)=>{
    const extra=Math.min(capacities[index]-row.advancesObra,Math.max(0,remaining));
    row.advancesObra+=extra;
    remaining-=extra;
    row.netObra=capacities[index]-row.advancesObra;
  });
  return rows;
};
