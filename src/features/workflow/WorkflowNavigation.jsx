import { Select } from "../../design-system/primitives/Select.jsx";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { consultarDreCanonico, consultarDreEmpresaCanonico } from "../../api.js";
import { podeAcessarAba } from "../../domains/administracao/abas-acesso.js";
import { dreImpactMetrics, normalizeWorkflowScope, visibleModuleFlow } from "./workflow-model.js";
import "./workflow.css";

export const WorkflowContext=createContext({navigate:null,intent:null,scopes:{},rememberScope:null,views:null,returnTo:null,goBack:null});
export const useWorkflow=()=>useContext(WorkflowContext);
export function useRememberWorkflowScope(screen,scope){
  const {rememberScope}=useWorkflow();
  const serialized=JSON.stringify(scope);
  useEffect(()=>{rememberScope?.(screen,scope);},[screen,serialized,rememberScope]);
}

export function FlowTabs({label,steps,tools=[],active,onChange,toolsLabel="Consultas e configurações"}){
  const selected=[...steps,...tools].find(item=>item.id===active);
  return <section className="workflow-tabs" aria-label={label}>
    <div className="workflow-tabs__mobile"><Select label={label} value={active} onChange={event=>onChange(event.target.value)}><optgroup label="Áreas de trabalho">{steps.map(item=><option key={item.id} value={item.id}>{item.label}{item.count!=null?` · ${item.count}`:""}</option>)}</optgroup>{tools.length>0&&<optgroup label={toolsLabel}>{tools.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>}</Select></div>
    <nav aria-label={label}>{steps.map(item=><button key={item.id} type="button" aria-current={active===item.id?"page":undefined} onClick={()=>onChange(item.id)} aria-label={item.label}>
      <span>{item.label}</span>{item.count!=null&&<small aria-hidden="true">{item.count}</small>}
    </button>)}</nav>
    {tools.length>0&&<details className="workflow-tools" key={active} open={tools.some(item=>item.id===active)}><summary>{toolsLabel}{tools.some(item=>item.id===active)?` · ${selected.label}`:""}</summary><div>{tools.map(item=><button key={item.id} type="button" aria-current={active===item.id?"page":undefined} onClick={()=>onChange(item.id)}>{item.label}{item.count!=null?` · ${item.count}`:""}</button>)}</div></details>}
    {selected?.description&&<p className="workflow-description">{selected.description}</p>}
  </section>;
}

export function ModuleWorkflow({moduleId,allowedTabs,active,meta,onNavigate}){
  const flow=visibleModuleFlow(moduleId,allowedTabs);
  if(!flow)return null;
  const steps=flow.steps.map(([id,label,description])=>({id,label,description}));
  const tools=flow.tools.map(id=>({id,label:meta[id]?.label||id}));
  // A permissão personalizada pode apontar apenas para uma tela antiga.
  if(!steps.some(item=>item.id===active)&&!tools.some(item=>item.id===active)&&meta[active])tools.push({id:active,label:meta[active].label});
  return <div className="module-workflow no-print"><div className="module-workflow__heading"><span>Fluxo do módulo</span><strong>{flow.title}</strong></div>
    <FlowTabs label="Etapas do módulo" steps={steps} tools={tools} active={active} onChange={onNavigate} toolsLabel="Outras áreas do módulo"/>
  </div>;
}

const notes={
  purchases:"Pedido representa compromisso. O custo segue os documentos reconhecidos no razão; pagar ou receber material não cria esse custo novamente.",
  payroll:"O custo da mão de obra segue a competência dos apontamentos. O pagamento é uma saída de caixa e não deve duplicar o custo reconhecido.",
  rentals:"Receita, repasses e manutenção seguem o razão por competência. Cobrança e recebimento são acompanhados separadamente.",
};

export function DreIntegration({kind,currentUser,obraId="",year,month,period="mes",children}){
  const {navigate}=useWorkflow(),id=useId();
  const [open,setOpen]=useState(false),[state,setState]=useState({loading:false,current:null,error:""});
  const request=useRef(0);
  const scope=normalizeWorkflowScope({obraId,year,month,period},currentUser);
  const canReadWork=podeAcessarAba(currentUser,"dre");
  const allowed=canReadWork||(!scope.obraId&&scope.period==="mes"&&podeAcessarAba(currentUser,"dre_emp"));
  const validPeriod=scope.year!=null&&scope.month!=null;
  const key=JSON.stringify(scope);
  useEffect(()=>{
    const token=++request.current;
    setState({loading:open&&validPeriod,current:null,error:""});
    if(!open||!allowed||!validPeriod)return;
    const query=canReadWork?consultarDreCanonico:consultarDreEmpresaCanonico;
    query(scope).then(result=>{
      if(token!==request.current)return;
      setState(result?.status===200&&result.source==="canonical_ledger"?{loading:false,current:result.current,error:result.current?"":"Projeção ainda indisponível para este recorte."}:{loading:false,current:null,error:result?.error||"Não foi possível consultar o DRE."});
    }).catch(()=>{if(token===request.current)setState({loading:false,current:null,error:"Não foi possível consultar o DRE."});});
    return()=>{request.current+=1;};
  },[open,allowed,canReadWork,validPeriod,key]);
  const metrics=dreImpactMetrics(kind,state.current,!!scope.obraId);
  const target=podeAcessarAba(currentUser,"dre")?"dre":"dre_emp";
  // A DRE empresarial é mensal e não está disponível para perfil de obra.
  const canNavigate=navigate&&allowed&&(target==="dre"||(!scope.obraId&&period==="mes"));
  return <section className="dre-integration" aria-label="Integração com o DRE">
    <details className="dre-integration__disclosure"><summary>Resultado no DRE{validPeriod?` · ${String(scope.month+1).padStart(2,"0")}/${scope.year}`:""}</summary>
    <div className="dre-integration__intro"><div><strong>Como este fluxo aparece no DRE</strong><p>{notes[kind]}</p></div>{children}</div>
    {allowed&&validPeriod&&<div className="dre-integration__actions"><button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls={id}>{open?"Ocultar valores do DRE":"Consultar valores no DRE"}</button>
      {canNavigate&&<button type="button" onClick={()=>navigate(target,scope)}>Abrir DRE neste recorte</button>}
    </div>}
    {open&&allowed&&validPeriod&&<div id={id} className="dre-integration__values" aria-live="polite">
      {state.loading?<p>Consultando o razão…</p>:state.error?<p role="alert">{state.error}</p>:metrics?.map(metric=><div key={metric.label}><span>{metric.label}</span><strong>{metric.value==null?"Não disponível neste recorte":metric.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div>)}
      {!!scope.obraId&&kind==="rentals"&&<p>Receita externa e manutenção da frota são consultadas no DRE consolidado da empresa.</p>}
    </div>}
    </details>
  </section>;
}
