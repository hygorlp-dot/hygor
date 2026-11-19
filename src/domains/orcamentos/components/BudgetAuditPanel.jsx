import { contar } from "../../../design-system/copy.js";
import {Input as StandardInput} from '../../../components/ui/input.jsx';
import {SelectControl} from '../../../design-system/primitives/Select.jsx';
import {Button as StandardButton} from '../../../components/ui/button.jsx';
import {Dialog} from '../../../design-system/primitives/Dialog.jsx';
import {Textarea} from '../../../design-system/primitives/Textarea.jsx';
import {useRef,useState} from 'react';
export default function BudgetAuditPanel({issues,stages=[],onNavigate,onRemoveLink,onChangeScope,readOnly}){
  const [search,setSearch]=useState(''),[kind,setKind]=useState(''),[limit,setLimit]=useState(50);
  const [stage,setStage]=useState(''),[decision,setDecision]=useState(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const savingRef=useRef(false);
  const triggerRef=useRef(null);
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const stageMap=new Map(stages.map(item=>[item.id,item]));
  const inStage=id=>{
    const visited=new Set();
    while(id&&!visited.has(id)){
      if(id===stage)return true;
      visited.add(id);
      id=stageMap.get(id)?.parentId;
    }
    return false;
  };
  const filtered=issues.filter(i=>(!kind||i.kind===kind||i.destination===kind)&&(!stage||inStage(i.stageId))&&norm(`${i.label} ${i.message}`).includes(norm(search)));
  const openDecision=(event,issue,exclude)=>{
    triggerRef.current=event.currentTarget;
    setDecision({issue,exclude});setReason('');setError('');
  };
  const confirm=async event=>{
    event.preventDefault();
    if(!decision||savingRef.current)return;
    savingRef.current=true;setSaving(true);setError('');
    try{
      await onChangeScope(decision.issue.itemId,decision.exclude,reason);
      setDecision(null);
    }catch(err){setError(err.message);}
    finally{savingRef.current=false;setSaving(false);}
  };
  return <details className="memory-disclosure">
    <summary>Conferência do orçamento inteiro · {contar(issues.length,"ocorrência","ocorrências")}</summary>
    <div className="budget-workflow-bar">
      <StandardInput aria-label="Buscar ocorrência" placeholder="Item, pavimento ou problema" value={search} onChange={e=>{setSearch(e.target.value);setLimit(50);}}/>
      <SelectControl aria-label="Tipo de ocorrência" value={kind} onChange={e=>{setKind(e.target.value);setLimit(50);}}><option value="">Todas</option><option value="measure">A medir</option><option value="quote">A cotar</option><option value="excluded">Fora do escopo</option><option value="budget">Itens da planilha</option><option value="memory">Vínculos do memorial</option><option value="item-memory">Memorial item a item</option></SelectControl>
      <SelectControl aria-label="Etapa da ocorrência" value={stage} onChange={e=>{setStage(e.target.value);setLimit(50);}}>
        <option value="">Todas as etapas</option>
        {stages.map(item=><option key={item.id} value={item.id}>{item.codigo} {item.nome}</option>)}
      </SelectControl>
      <span>{contar(filtered.length,"ocorrência","ocorrências")}</span>
    </div>
    {!issues.length&&<p>Nenhuma inconsistência encontrada nas verificações automáticas.</p>}
    {!!issues.length&&!filtered.length&&<p>Nenhuma ocorrência para os filtros selecionados.</p>}
    {filtered.slice(0,limit).map(issue=><div key={issue.id}>
      <StandardButton variant="secondary" type="button" className="memory-audit-link" onClick={()=>onNavigate(issue)}>{issue.label} — {issue.message}</StandardButton>
      {!readOnly && issue.canRemove && <StandardButton variant="secondary" type="button" onClick={()=>onRemoveLink(issue.source)}>Desvincular este quantitativo</StandardButton>}
      {issue.exclusion&&<p>{issue.exclusion.autor} · {new Date(issue.exclusion.data).toLocaleDateString('pt-BR',{timeZone:'America/Bahia'})}</p>}
      {!readOnly&&issue.canExclude&&<StandardButton variant="secondary" type="button" onClick={event=>openDecision(event,issue,true)}>Excluir do escopo</StandardButton>}
      {!readOnly&&issue.exclusion&&<StandardButton variant="secondary" type="button" onClick={event=>openDecision(event,issue,false)}>Reincluir no escopo</StandardButton>}
    </div>)}
    {filtered.length>limit&&<StandardButton variant="secondary" type="button" onClick={()=>setLimit(limit+50)}>Mostrar mais 50</StandardButton>}
    <Dialog open={!!decision} triggerRef={triggerRef} onOpenChange={open=>{if(!open&&!savingRef.current)setDecision(null);}} title={decision?.exclude?'Excluir do escopo':'Reincluir no escopo'}>
      {decision&&<form className="flex flex-col gap-3" onSubmit={confirm}>
        <p>{decision.issue.label}</p>
        <p>{decision.exclude?'O item ficará no orçamento como fora do escopo.':'O item voltará às pendências do orçamento.'}</p>
        {decision.exclude&&<Textarea label="Motivo da exclusão" required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/>}
        {error&&<p role="alert">{error}</p>}
        <div className="arcd-page-header__actions">
          <StandardButton variant="secondary" type="button" disabled={saving} onClick={()=>setDecision(null)}>Cancelar</StandardButton>
          <StandardButton type="submit" disabled={saving||decision.exclude&&!reason.trim()}>{saving?'Salvando…':decision.exclude?'Confirmar exclusão':'Confirmar reinclusão'}</StandardButton>
        </div>
      </form>}
    </Dialog>
  </details>;
}
