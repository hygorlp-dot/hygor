import {active} from '../../domains/financeiro/facts.js';
import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {useRef,useState} from 'react';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {FormSection} from '../../design-system/patterns/FormSection.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Inp,Sel} from '../../legacy/ui.jsx';
import CategoryCombobox from './CategoryCombobox.jsx';
import {reconciliationCategories} from '../../domains/conciliacao/categories.js';
import {reconciliationEditableEntries,reconciliationClassificationFingerprint} from '../../domains/conciliacao/classification-edit.js';

export default function ReconciliationEditDialog({data,transaction={},fmt,onSave,onClose}){
  useHelpTopic('conc','conc_editar_classificacao',1);
  const [entries,setEntries]=useState(()=>reconciliationEditableEntries(data,transaction));
  const [expectedFingerprint]=useState(()=>reconciliationClassificationFingerprint(data,transaction));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
  const guard=useUnsavedChanges(entries,onClose,{busy,identity:transaction.id});
  const patch=(index,change)=>setEntries(rows=>rows.map((row,i)=>i===index?{...row,...change}:row));
  const save=async()=>{if(lock.current||!entries.length)return;lock.current=true;setBusy(true);setError('');
    try{if(await onSave({transactionId:transaction.id,expectedFingerprint,entries}))onClose();else setError('A edição não foi confirmada. Confira o aviso e mantenha este formulário aberto para corrigir.');}
    catch{setError('Não foi possível salvar a edição. Confira a conexão e tente novamente.');}finally{lock.current=false;setBusy(false);}};
  return <><Dialog open onOpenChange={open=>{if(!open)guard.requestClose();}} title="Editar classificação da conciliação"
    footer={<><Button variant="outline" disabled={busy} onClick={guard.requestClose}>Cancelar</Button><Button disabled={busy||!entries.length||entries.some(entry=>!entry.category||!entry.description.trim()||!entry.competence||(entry.destination==='obra'&&!entry.obraId))} onClick={save}>{busy?'Salvando…':'Salvar classificação'}</Button></>}>
    <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
      <p>Movimento original: {fmt(Math.abs(Number(transaction.valor)))} · {financialDateLabel(transaction.data)}. O valor e a data do banco permanecem iguais.</p>
      <p>A edição atualiza o mesmo lançamento usado no DRE, sem criar outro pagamento ou recebimento. Nas despesas, o destino empresa/obra segue o cadastro de origem.</p>
      {entries.map((entry,index)=><FormSection key={`${entry.sourceType}:${entry.sourceId}`} title={`Lançamento ${index+1} · ${fmt(entry.amount)}`}>
        <div className="flex min-w-0 flex-col gap-3">
          {entry.sourceType==='payments'?<Sel label="Destino no DRE" value={entry.destination} onChange={destination=>patch(index,{destination,obraId:'',category:''})} options={[{v:'empresa',l:'Empresa'},{v:'obra',l:'Obra'}]}/>:<p>Destino: {entry.destination==='empresa'?'Empresa':'Obra'}</p>}
          {entry.destination==='obra'&&<Sel label="Obra do lançamento" value={entry.obraId} onChange={obraId=>patch(index,{obraId})} options={[{v:'',l:'Selecione a obra'},...(data.obras||[]).filter(active).map(work=>({v:work.id,l:work.name}))]}/>}
          <CategoryCombobox label="Categoria do DRE" value={entry.category} disabled={busy} onChange={category=>patch(index,{category})}
            options={reconciliationCategories(data,{direction:entry.sourceType==='payments'?'entrada':'saida',destination:entry.destination})}/>
          <Inp label="Descrição do lançamento" value={entry.description} onChange={description=>patch(index,{description})}/>
          <Inp label="Competência do DRE" type="month" value={entry.competence} onChange={competence=>patch(index,{competence})}/>
        </div>
      </FormSection>)}
      {error&&<p role="alert">{error}</p>}
    </fieldset>
  </Dialog><UnsavedChangesPrompt guard={guard}/></>;
}
