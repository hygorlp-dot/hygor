const isRecord = value => value && typeof value === "object" && !Array.isArray(value);

const recordBelongsToObra = (record, obraId, employeeBelongsToObra) => {
  if (!isRecord(record)) return employeeBelongsToObra;
  const recordObraId=String(record.obraId || record.obra || "");
  return recordObraId ? recordObraId === obraId : employeeBelongsToObra;
};

// A projeção de leitura entrega ao engenheiro apenas a própria obra. Ao salvar
// esse recorte, os dias das demais obras precisam continuar no estado
// autoritativo; substituir o objeto inteiro apagaria apontamentos legítimos.
export const mergeScopedAttendance = ({current = {}, incoming = {}, user = {}, employees = []} = {}) => {
  const obraId=String(user.obraId || "");
  if (!obraId) return incoming;

  const employeeIds=new Set((employees || [])
    .filter(employee => String(employee?.obra || employee?.obraId || "") === obraId)
    .map(employee => String(employee.id)));
  const merged=Object.fromEntries(Object.entries(current || {}).map(([employeeId,days])=>[
    employeeId,{...(days || {})},
  ]));

  for (const employeeId of employeeIds) {
    const currentDays=current?.[employeeId] || {};
    const incomingDays=incoming?.[employeeId] || {};
    const foreignDays=Object.fromEntries(Object.entries(currentDays).filter(([,record])=>
      !recordBelongsToObra(record,obraId,true)
    ));
    const scopedIncoming=Object.fromEntries(Object.entries(incomingDays).filter(([,record])=>
      recordBelongsToObra(record,obraId,true)
    ));
    const nextDays={...foreignDays,...scopedIncoming};
    if(Object.keys(nextDays).length)merged[employeeId]=nextDays;
    else delete merged[employeeId];
  }

  return merged;
};

export const mergeScopedAttendanceLocks = ({current = {}, incoming = {}, user = {}} = {}) => {
  const obraId=String(user.obraId || "");
  if(!obraId)return incoming;
  const foreign=Object.fromEntries(Object.entries(current || {}).filter(([,lock])=>
    String(lock?.obraId || lock?.obra || "") !== obraId
  ));
  const scoped=Object.fromEntries(Object.entries(incoming || {}).filter(([,lock])=>
    String(lock?.obraId || lock?.obra || "") === obraId
  ));
  return {...foreign,...scoped};
};
