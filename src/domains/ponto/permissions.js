const validSelectedObra = value => value && value !== "all";

export const resolveHistoricalEmployeeObraId = ({
  employee,
  date,
  transferEvents=[],
  obras=[],
} = {}) => {
  if(!employee||!date)return "";
  const byName=new Map((obras||[]).map(obra=>[String(obra?.name||""),String(obra?.id||"")]));
  const storedHistory=(employee.obraHistory||[]).map(event=>({
    type:"transfer",empId:employee.id,date:event.date,
    fromId:event.fromObraId||event.fromId,toId:event.toObraId||event.toId,
  }));
  const transfers=[...(transferEvents||[]),...storedHistory]
    .filter(event=>event?.type==="transfer"&&String(event.empId||"")===String(employee.id||"")&&event.date)
    .sort((left,right)=>String(right.date).localeCompare(String(left.date)));
  let obraId=String(employee.obra||employee.obraId||employee.lastObra||"");
  for(const transfer of transfers){
    if(String(transfer.date)>String(date)){
      obraId=String(transfer.fromId||byName.get(String(transfer.from||""))||obraId);
      continue;
    }
    break;
  }
  return obraId;
};

// Uma única prioridade atende tela, servidor, folha e relatórios. A seleção
// explícita representa a decisão do operador para aquele lançamento; depois
// vêm o fato já persistido, a lotação histórica e, por último, a lotação atual.
export const resolveAttendanceObraId = ({
  selectedObraId,
  record,
  historicalObraId,
  employeeObraId,
} = {}) => {
  if(validSelectedObra(selectedObraId))return String(selectedObraId);
  if(record?.obraId||record?.obra)return String(record.obraId||record.obra);
  if(historicalObraId)return String(historicalObraId);
  return String(employeeObraId||"");
};

export const resolveEmployeeAttendanceObraId=({
  data={},employee,date,selectedObraId,record,
}={})=>resolveAttendanceObraId({
  selectedObraId,
  record:record??data?.attendance?.[employee?.id]?.[date],
  historicalObraId:resolveHistoricalEmployeeObraId({
    employee,date,transferEvents:data?.changeLog||[],obras:data?.obras||[],
  }),
  employeeObraId:employee?.obra||employee?.obraId||employee?.lastObra||"",
});

export const canManageAttendanceWorkforce = role =>
  ["admin", "rh"].includes(String(role || ""));
