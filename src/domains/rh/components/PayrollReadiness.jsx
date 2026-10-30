import {useMemo,useState} from 'react';
import {Inp,Sel} from '../../../LegacyApp';
import {Button} from '../../../components/ui/button';
import {Alert,AlertDescription} from '../../../components/ui/alert';
import {payrollReadiness} from '../payroll-readiness.js';
import './payroll-readiness.css';

export function PayrollReadiness({data,year,month,onOpen}){
  const [competence,setCompetence]=useState(`${year}-${String(month+1).padStart(2,'0')}`);
  const [employeeId,setEmployeeId]=useState(String(data.employees.find(e=>e.active!==false&&e.remunerationMode==='clt')?.id||data.employees.find(e=>e.active!==false)?.id||''));
  const employee=data.employees.find(e=>String(e.id)===employeeId);
  const report=useMemo(()=>payrollReadiness(data,employee,competence),[data,employee,competence]);
  return <section className="rh-readiness" aria-labelledby="rh-readiness-title">
    <header><h3 id="rh-readiness-title">Próximos passos do RH</h3><p>Resolva cada etapa com o mesmo funcionário e a mesma competência. Os atalhos não salvam, aprovam ou realizam pagamentos.</p></header>
    <div className="rh-readiness__filters"><Sel label="Funcionário das pendências" value={employeeId} onChange={setEmployeeId} options={[{v:'',l:'Selecione'},...data.employees.map(e=>({v:String(e.id),l:e.name}))]}/><Inp label="Competência das pendências" type="month" value={competence} onChange={v=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(v))setCompetence(v);}}/></div>
    {!report?<p>Selecione um funcionário para consultar as pendências.</p>:<>
      <Alert><AlertDescription>Recorte mensal: {competence}. A quinzena de 21 a 05 atravessa dois meses; confira também o ciclo ao abrir a folha.</AlertDescription></Alert>
      <ol className="rh-readiness__steps">{report.steps.map((step,index)=><li key={step.id}>
        <div className="rh-readiness__step-head"><h4>{index+1}. {step.title}</h4><span data-tone={/pendente|pendência|não salva/i.test(step.status)?'warning':'neutral'}>{step.status}</span></div>
        {step.issues.length>0?<ul>{step.issues.slice(0,3).map(item=><li key={item}>{item}</li>)}</ul>:<p>Os dados necessários estão preenchidos; confira a documentação.</p>}
        {step.issues.length>3&&<details><summary>Ver mais {step.issues.length-3} pendência(s)</summary><ul>{step.issues.slice(3).map(item=><li key={item}>{item}</li>)}</ul></details>}
        <div className="rh-readiness__actions"><Button type="button" variant="outline" size="sm" onClick={()=>onOpen({step:step.id,employee,competence,report})}>{step.action}</Button>{step.id==='point'&&report.mode==='clt'&&<Button type="button" variant="ghost" size="sm" onClick={()=>onOpen({step:'point-close',employee,competence,report})}>Abrir fechamento por obra</Button>}</div>
      </li>)}</ol>
    </>}
  </section>;
}
