import {useUnsavedChanges} from "../workflow/useUnsavedChanges.js";
import UnsavedChangesPrompt from "../workflow/UnsavedChangesPrompt.jsx";
import {useEffect,useRef,useState} from 'react';
import { Modal } from "../../legacy/ui.jsx";
import { uid } from "../../legacy/format.js";
import {Button} from '../../design-system/primitives/Button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {closingSources,CLOSING_CORRECTION_COMMAND} from '../../domains/financeiro/closing-correction.js';
import {financialDocumentUrl} from '../../domains/financeiro/document-links.js';
import {workExpenseCategories} from '../../domains/dre/work-expense-categories.js';
import {companyExpenseCategoryOptions} from '../../domains/dre/expense-taxonomy.js';
import {useRecordRecovery} from './useRecordRecovery.js';
import RecordRecoveryPanel from './RecordRecoveryPanel.jsx';
const correctionFields=['categoria','documentos'];
export default function ClosingOriginEditor({row,data,user,dispatch,onClose,onAdopt}){
 const [draft,setDraft]=useState(()=>({...row.record,documentos:row.record.documentos||[]})),[reason,setReason]=useState(''),[url,setUrl]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const lock=useRef(false),spec=closingSources[row.type];
 const recovery=useRecordRecovery({collection:spec.collection,fields:correctionFields,format:record=>({...record,documentos:record.documentos||[]})});
 useEffect(()=>{recovery.reset(draft);},[recovery.reset]);
 const exit=useUnsavedChanges({draft,reason,url,name},onClose,{identity:row.record.id,busy:pending});
 const categories=(row.type==='despesa_empresa'?companyExpenseCategoryOptions():workExpenseCategories(data)).map(c=>({value:c.v,label:c.l}));
 if(draft.categoria&&!categories.some(c=>c.value===draft.categoria))categories.push({value:draft.categoria,label:draft.categoria});
 const save=async()=>{
  if(lock.current)return;if(!reason.trim()){setError('Informe o motivo da correção.');return;}
  if(url.trim()||name.trim()){setError('Adicione a referência preenchida antes de confirmar.');return;}
  const command=recovery.prepare({type:CLOSING_CORRECTION_COMMAND.CLOSING_SOURCE_CORRECTED,idempotencyKey:`closing-source-${row.record.id}-${uid()}`,expectedVersion:Number(recovery.base.current?.version||0),actorId:user.id,actorName:user.nome,payload:{sourceType:row.type,sourceId:row.record.id,reason,changes:{documentos:draft.documentos,...(['despesa_empresa','outra_despesa'].includes(row.type)?{categoria:draft.categoria}:{} )}}});
  if(!command)return;lock.current=true;setPending(true);setError('');
  try{const result=await dispatch(command);if(!result?.ok){recovery.fail(result);return;}onClose();}catch(err){recovery.fail(err);}finally{lock.current=false;setPending(false);}
 };
 return <><Modal title="Corrigir origem do fechamento" wide onClose={exit.requestClose}><div className="closing-origin-editor">
  <p><strong>{row.label} · {row.record.numero||row.record.descricao||row.record.id}</strong></p><p>Obra: {row.entry.obra} · Competência: {row.period||'não informada'}. Esta correção mantém valores, pagamentos e identidade do registro.</p>
  <fieldset disabled={pending} className="closing-origin-editor__fields"><legend>Dados da conferência</legend>
  {['despesa_empresa','outra_despesa'].includes(row.type)&&<Select label="Categoria da origem" value={draft.categoria||''} onChange={e=>setDraft(d=>({...d,categoria:e.target.value}))} options={[{value:'',label:'Selecione a categoria'},...categories]}/>}
  <fieldset><legend>Referências documentais</legend>{draft.documentos.map((doc,index)=><div className="closing-origin-editor__document" key={doc.id||index}><span>{doc.legenda||doc.nome||doc.url||'Referência cadastrada'}</span><Button variant="quiet" onClick={()=>setDraft(d=>({...d,documentos:d.documentos.filter((_,i)=>i!==index)}))}>Remover referência</Button></div>)}
  <div className="closing-origin-editor__ref-fields"><Input label="Nome da referência" value={name} onChange={e=>setName(e.target.value)}/><Input label="Endereço do documento" type="url" value={url} onChange={e=>setUrl(e.target.value)} description="Referência de um arquivo existente. Remover o vínculo não exclui o arquivo."/></div>
  <Button variant="secondary" onClick={()=>{const address=financialDocumentUrl(url);if(!address||!name.trim()){setError('Informe o nome e um endereço válido para o documento.');return;}setDraft(d=>({...d,documentos:[...d.documentos,{id:uid(),nome:name.trim(),legenda:name.trim(),url:address}]}));setUrl('');setName('');setError('');}}>Adicionar referência</Button></fieldset>
  <Input label="Motivo da correção" required value={reason} onChange={e=>setReason(e.target.value)}/>
  </fieldset>{error&&<p role="alert">{error}</p>}
  <RecordRecoveryPanel data={data} recovery={recovery} draft={draft} fields={correctionFields} user={user} onRebase={setDraft} onConfirmed={async result=>{await onAdopt({__adotarServidorPatch:true,updatedAt:result.updatedAt,sections:{[spec.collection]:result.data[spec.collection],operationalCommandReceipts:result.data.operationalCommandReceipts}});onClose();}}/>
  <div className="financial-record-flow__actions"><Button variant="secondary" disabled={pending} onClick={exit.requestClose}>Voltar à conferência</Button><Button loading={pending} loadingLabel="Confirmando…" onClick={save}>Salvar correção da origem</Button></div>
 </div></Modal><UnsavedChangesPrompt guard={exit}/></>;
}
