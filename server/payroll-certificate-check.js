import {getQ} from "../src/domains/ponto/attendance-engine.js";
import {isPayrollPeriodKey} from "../src/domains/ponto/payroll-closing.js";
import {normalizeAttendanceRecord} from "../src/domains/ponto/records.js";
import {resolveEmployeeAttendanceObraId} from "../src/domains/ponto/permissions.js";
import {decodeAppData} from "./data-codec.js";
import {mergeAttendanceObjects} from "./attendance-obra-routing.js";

export function payrollCertificateDays(periodKey){
  if(!isPayrollPeriodKey(periodKey))return [];
  const [year,month,cycle]=periodKey.split("-");
  return getQ(Number(year),Number(month)-1)[cycle.toLowerCase()];
}

const attendanceKey=(employeeId,date,obraId)=>JSON.stringify([String(employeeId),date,String(obraId||"")]);

export function missingPayrollCertificates(data,days,documents){
  const employees=new Map((data.employees||[]).map(employee=>[String(employee.id),employee]));
  const provided=new Set(documents.filter(doc=>doc.category==="leave"&&!doc.archivedAt&&
    ["image/jpeg","image/png"].includes(doc.mime)&&doc.path)
    .map(doc=>attendanceKey(doc.employeeId,doc.attendanceDate,doc.attendanceWorkId)));
  const missing=[];
  for(const [employeeId,attendance] of Object.entries(data.attendance||{})){
    const employee=employees.get(employeeId);
    for(const date of days){
      const record=normalizeAttendanceRecord(attendance?.[date]);
      if(record?.status!=="AT")continue;
      const obraId=resolveEmployeeAttendanceObraId({data,employee,date,record});
      if(!provided.has(attendanceKey(employeeId,date,obraId))){
        missing.push({employeeId,name:employee?.name||"Funcionário sem cadastro",date});
      }
    }
  }
  return missing.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,"pt-BR"));
}

export async function checkPayrollCertificates({data,periodKey,archiveDates=[],company,db,transaction}){
  const days=payrollCertificateDays(periodKey);
  if(!days.length)return {ok:false,status:400,error:"Quinzena inválida."};
  try{
    let source=data;
    if(data.quinzenasArquivadas?.[periodKey]){
      const key=`arced_ponto_v1__arq__${periodKey}`;
      let row;
      if(transaction){
        [row]=await transaction`select value from public.company_app_data where company_id=${company} and key=${key}`;
      }else{
        const {data:archived,error}=await db.from("company_app_data").select("value").eq("company_id",company).eq("key",key).maybeSingle();
        if(error)throw error;
        row=archived;
      }
      const archived=decodeAppData(row?.value);
      if(!archived?.attendance){
        return {ok:false,status:409,error:"O arquivo de ponto desta quinzena está indisponível para conferir os atestados."};
      }
      source={...data,attendance:mergeAttendanceObjects(data.attendance,archived.attendance)};
    }
    const checkedDays=[...new Set([...days,...archiveDates.filter(date=>typeof date==="string")])];
    const missing=missingPayrollCertificates(source,checkedDays,[]);
    if(!missing.length)return {ok:true,missing};
    const dates=[...new Set(missing.map(item=>item.date))];
    const documents=[];
    if(transaction){
      const rows=await transaction`
        select value from public.company_app_data
        where company_id = ${company}
          and starts_with(key, 'rh_doc_')
          and value->>'attendanceDate' in ${transaction(dates)}
        for share
      `;
      documents.push(...rows.map(row=>row.value));
    }else{
      const pageSize=500;
      for(let offset=0;;offset+=pageSize){
        const {data:rows,error}=await db.from("company_app_data").select("value")
          .eq("company_id",company).like("key","rh\\_doc\\_%")
          .in("value->>attendanceDate",dates).order("key").range(offset,offset+pageSize-1);
        if(error)throw error;
        documents.push(...rows.map(row=>row.value));
        if(rows.length<pageSize)break;
      }
    }
    return {ok:true,missing:missingPayrollCertificates(source,checkedDays,documents)};
  }catch{
    return {ok:false,status:503,error:"Não foi possível conferir os anexos dos atestados. Tente novamente."};
  }
}

export const payrollCertificateBlocker=check=>!check.ok?check:check.missing.length
  ?{ok:false,status:409,error:"Anexe os atestados pendentes antes de finalizar a quinzena."}
  :null;
