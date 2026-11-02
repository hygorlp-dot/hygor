import { useState } from 'react';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../design-system/primitives/Input.jsx';
import { Select } from '../../design-system/primitives/Select.jsx';
import { FILE_ACCEPT, folderPath } from './model.js';

export function FolderForm({folder,folders,parentId,busy,onSave,onCancel}) {
  const [name,setName]=useState(folder?.name||'');
  const [parent,setParent]=useState(folder?.parentId||parentId||'');
  return <form className="work-files-form" onSubmit={event=>{event.preventDefault();onSave({id:folder?.id||crypto.randomUUID(),name,parentId:parent});}}>
    <h2>{folder?'Editar pasta':'Nova pasta'}</h2>
    <Input label="Nome da pasta" required maxLength={200} value={name} onChange={event=>setName(event.target.value)} />
    <Select label="Pasta superior" value={parent} onChange={event=>setParent(event.target.value)}><option value="">Raiz da obra</option>{folders.filter(item=>!folderPath(folders,item.id).some(ancestor=>ancestor.id===folder?.id)).map(item=><option key={item.id} value={item.id}>{folderPath(folders,item.id).map(part=>part.name).join(' / ')}</option>)}</Select>
    <div className="work-files-actions"><Button disabled={busy} type="submit">Salvar pasta</Button><Button disabled={busy} type="button" variant="outline" onClick={onCancel}>Cancelar</Button></div>
  </form>;
}
export function DocumentForm({document,folders,folderId,busy,onSave,onCancel}) {
  const [id]=useState(document?.id||crypto.randomUUID());
  const [revisionId]=useState(crypto.randomUUID());
  const [kind,setKind]=useState('link'),[name,setName]=useState(''),[url,setUrl]=useState(''),[label,setLabel]=useState(`R${String((document?.revisions.length||0)+1).padStart(2,'0')}`),[note,setNote]=useState(''),[folder,setFolder]=useState(document?.folderId||folderId||''),[file,setFile]=useState(null);
  return <form className="work-files-form" onSubmit={event=>{event.preventDefault();onSave({id,revisionId,kind,name:name||file?.name||'',url,label,note,folderId:folder},file);}}>
    <h2>{document?`Nova revisão · ${document.name}`:'Adicionar documento'}</h2>
    {!document&&<Input label="Título do documento" required maxLength={200} value={name} onChange={event=>setName(event.target.value)} />}
    <Select label="Tipo de documento" value={kind} onChange={event=>setKind(event.target.value)} options={[{value:'link',label:'Link da internet ou da nuvem'},{value:'file',label:'Enviar arquivo'}]} />
    {kind==='link'?<Input label="Endereço do link" required type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://" />:<Input label="Arquivo para upload" type="file" required accept={FILE_ACCEPT} onChange={event=>setFile(event.target.files?.[0]||null)} description="Até 3 MB por arquivo. Para modelos BIM e outros arquivos maiores, use um link da nuvem." />}
    <div className="work-files-form-grid"><Input label="Identificação da revisão" required maxLength={60} value={label} onChange={event=>setLabel(event.target.value)} />{!document&&<Select label="Pasta do documento" value={folder} onChange={event=>setFolder(event.target.value)}><option value="">Raiz da obra</option>{folders.map(item=><option key={item.id} value={item.id}>{folderPath(folders,item.id).map(part=>part.name).join(' / ')}</option>)}</Select>}</div>
    <Input label="Descrição da revisão" maxLength={2000} value={note} onChange={event=>setNote(event.target.value)} placeholder="O que foi incluído ou alterado?" />
    <p>As revisões anteriores permanecem disponíveis no histórico.</p>
    <div className="work-files-actions"><Button type="submit" disabled={busy}>{busy?'Salvando…':document?'Salvar revisão':'Salvar documento'}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div>
  </form>;
}
