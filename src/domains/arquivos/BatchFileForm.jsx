import {useEffect,useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {FilePicker} from '../../design-system/patterns/FilePicker.jsx';
import {FILE_ACCEPT,FILE_BATCH_MAX,fileSize} from './model.js';
import {validateBatch} from './file-drop.js';

const entries=files=>files.map(file=>({id:crypto.randomUUID(),revisionId:crypto.randomUUID(),file,name:file.name,label:'R01',kind:'file',note:''}));
export default function BatchFileForm({files=[],folderName,busy,progress,onSave,onCancel}){
  const [items,setItems]=useState(()=>entries(files)),[error,setError]=useState('');
  const heading=useRef(null);
  useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView?.({block:'center',behavior:'instant'});},[]);
  return <form className="work-files-form" onSubmit={event=>{event.preventDefault();const invalid=validateBatch(items.map(item=>item.file));if(invalid){setError(invalid);return;}onSave(items);}}>
    <h2 ref={heading} tabIndex={-1}>Adicionar arquivos em lote</h2>
    <p>Destino: {folderName}. Cada arquivo será um novo documento com seu nome como título e revisão R01. Documentos existentes serão preservados.</p>
    {!items.length&&<FilePicker multiple accept={FILE_ACCEPT} disabled={busy} buttonLabel="Selecionar arquivos" inputProps={{'aria-label':'Arquivos do lote'}} onChange={event=>{const selected=Array.from(event.target.files||[]);event.target.value='';const invalid=validateBatch(selected);setError(invalid);if(!invalid)setItems(entries(selected));}} />}
    <p>Até {FILE_BATCH_MAX} arquivos por lote, com no máximo 3 MB por arquivo. Confira a lista e envie uma única vez.</p>
    <ul className="work-files-revisions" aria-label="Lista de arquivos do lote" aria-live="polite">{items.map(item=><li key={item.id}><strong className="break-words">{item.name}</strong><p>{fileSize(item.file.size)} · {progress[item.revisionId]||'Aguardando envio'}</p></li>)}</ul>
    {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <p>Os documentos aparecem na pasta quando o lote inteiro for concluído. Se houver falha, tente novamente: os envios confirmados serão reaproveitados. Cancelar não apaga arquivos já enviados ao OneDrive.</p>
    <div className="work-files-actions"><Button type="submit" disabled={busy||!items.length}>{busy?'Enviando lote…':'Enviar arquivos'}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
  </form>;
}
