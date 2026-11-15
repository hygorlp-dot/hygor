import {useSyncedWorkObra,workContextObraId} from '../../features/workflow/work-context.js';
import {useHelpTopic} from '../../features/help/HelpContext.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, FolderPlus, FileText, Link as LinkIcon, Upload, RefreshCw, ArrowLeft, Eye, History } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { Alert, AlertDescription } from '../../components/ui/alert.jsx';
import { Input } from '../../design-system/primitives/Input.jsx';
import { Select } from '../../design-system/primitives/Select.jsx';
import {FilterBar} from '../../design-system/patterns/FilterBar.jsx';
import { PageHeader } from '../../design-system/patterns/PageHeader.jsx';
import { EmptyState } from '../../design-system/patterns/FeedbackState.jsx';
import { enviarArquivoOneDrive, excluirDocumentoOneDrive } from '../../api.js';
import { FILE_COMMAND as CMD, FILE_ROLES } from './commands.js';
import {Checkbox} from '../../design-system/primitives/Checkbox.jsx';
import BatchDeleteDialog from './BatchDeleteDialog.jsx';
import {deletionBlock,trashDocumentBatch} from './batch-trash.js';
import DeleteDocumentDialog from './DeleteDocumentDialog.jsx';
import BatchFileForm from './BatchFileForm.jsx';
import {isFileDrag,droppedFiles} from './file-drop.js';
import { fileSize, fileValidation, folderPath, defaultFoldersMissing } from './model.js';
import { sourceDocuments } from './source-documents.js';
import { DocumentForm, FolderForm } from './FileForms.jsx';
import FilePreview from './FilePreview.jsx';
import { LICENSING_AREAS } from './licensing-documents.js';
import './arquivos.css';
import FolderAccessForm from './FolderAccessForm.jsx';
import {folderAccess} from './access.js';
import DossierView from '../licenciamento/DossierView.jsx';
import {podeAcessarAba} from '../administracao/abas-acesso.js';

const dateLabel=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('pt-BR'):'Data não informada';
const readDataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});

export default function ArquivosView({data,currentUser,dispatchCommand,onRefresh,initialWorkId=''}) {
  const works=(data.obras||[]).filter(work=>currentUser.role==='admin'||!currentUser.obraId||work.id===currentUser.obraId);
  const [workId,setWorkId]=useState(currentUser.obraId||(works.some(w=>w.id===initialWorkId)?initialWorkId:(works.some(w=>w.id===workContextObraId())?workContextObraId():works[0]?.id))||'');
  const [pending,setPending]=useState(false),[section,setSection]=useState('files');
  useSyncedWorkObra(workId,setWorkId,{allowedIds:works.map(work=>work.id),fixed:pending?workId:currentUser.role!=='admin'?currentUser.obraId:''});
  const obraId=works.some(item=>item.id===workId)?workId:works[0]?.id||'';
  const work=works.find(item=>item.id===obraId);
  return <div className="work-files"><PageHeader title="Arquivos" description="Central de documentos com revisões, permissões e vínculos dos módulos. As pastas físicas do OneDrive ficam em Obras → Recursos." />
    <FilterBar layout="grid" label="Contexto dos arquivos">
    <Select label="Obra dos arquivos" value={obraId} disabled={pending} onChange={event=>setWorkId(event.target.value)}>{works.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    <Select label="Área da documentação" disabled={pending} value={section} onChange={event=>setSection(event.target.value)} options={[{value:'files',label:'Arquivos e pastas'},...(podeAcessarAba(currentUser,'licenca')?[{value:'dossier',label:'Dossiê de licenciamento'}]:[])]} />
        </FilterBar>
    {work&&section==='dossier'?<DossierView key={work.id} {...{data,currentUser,dispatchCommand,work}} onBusyChange={setPending} />:work?<FileExplorer key={work.id} {...{data,currentUser,dispatchCommand,onRefresh,work}} onBusyChange={setPending} />:<EmptyState title="Nenhuma obra disponível" description="Cadastre uma obra ou solicite acesso para organizar seus documentos." />}
  </div>;
}
function FileExplorer({data,currentUser,dispatchCommand,onRefresh,work,onBusyChange}) {
  const cabinet=(data.workFileCabinets||[]).find(item=>item.obraId===work.id)||{version:0,folders:[],documents:[],history:[]};
  const [folderId,setFolderId]=useState('*'),[selectedId,setSelectedId]=useState(''),[form,setForm]=useState(null),[search,setSearch]=useState(''),[source,setSource]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [deletion,setDeletion]=useState(null),[checkedIds,setCheckedIds]=useState([]),[batchDeletion,setBatchDeletion]=useState(null),[deleteResults,setDeleteResults]=useState({});
  const deletionTrigger=useRef(null),deletionAttempts=useRef(new Map());
  const [preview,setPreview]=useState(null),[dragging,setDragging]=useState(false),[batchProgress,setBatchProgress]=useState({});
  useEffect(()=>{const prevent=event=>{if(isFileDrag(event.dataTransfer))event.preventDefault();};window.addEventListener('dragover',prevent);window.addEventListener('drop',prevent);return()=>{window.removeEventListener('dragover',prevent);window.removeEventListener('drop',prevent);};},[]);
  useHelpTopic('arquivos',deletion||batchDeletion?'arquivos_exclusao':preview?'arquivos_revisoes':'arquivos');
  const pending=useRef(false),uploadCache=useRef(new Map()),retry=useRef(null),detailHeading=useRef(null),documentTrigger=useRef(null),searchInput=useRef(null),previewTrigger=useRef(null);
  const writable=FILE_ROLES.includes(currentUser.role)&&folderAccess(cabinet,folderId==='*'||folderId==='sources'||folderId.startsWith('source:')?'':folderId,currentUser,'write');
  const inherited=useMemo(()=>sourceDocuments(data,work.id),[data,work.id]);
  const all=[...cabinet.documents.filter(item=>!item.deletedAt).map(item=>({...item,source:'Arquivos'})),...inherited];
  const selected=all.find(item=>item.id===selectedId);
  const previewDocument=preview&&all.find(item=>item.id===preview.documentId);
  useEffect(()=>{if(!preview&&previewTrigger.current){previewTrigger.current.focus();previewTrigger.current=null;}},[preview]);
  useEffect(()=>{if(selectedId&&!form)detailHeading.current?.focus();},[selectedId,form]);
  const path=folderPath(cabinet.folders,folderId);
  const virtual=folderId==='*'||folderId==='sources'||folderId.startsWith('source:');
  const licensingFolder=cabinet.folders.find(item=>item.id===folderId)?.name==='Licenciamento';
  const folders=cabinet.folders.filter(item=>item.parentId===(virtual?'':folderId));
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const visible=all.filter(item=>(!source||item.source===source)&&(query||folderId==='*'||(licensingFolder&&item.source==='Licenciamento')||(folderId.startsWith('source:')?item.area===folderId.slice(7):folderId==='sources'?item.readOnly:!item.readOnly&&item.folderId===folderId))).filter(item=>!query||`${item.name} ${item.source} ${item.areaLabel||''} ${item.stage||''} ${item.revisions.map(revision=>`${revision.label} ${revision.note}`).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query));
  const selectable=visible.filter(item=>!deletionBlock(data,cabinet,item,currentUser));
  const checked=selectable.filter(item=>checkedIds.includes(item.id));
  function clearSelection(){setCheckedIds([]);}
  function openBatchDeletion(event){deletionTrigger.current=event.currentTarget;setDeleteResults({});setBatchDeletion(checked);setError('');}
  async function deleteChecked(documents){
    if(pending.current)return;
    pending.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');
    try {
      const results=await trashDocumentBatch({data,obraId:work.id,documents,user:currentUser,dispatchCommand,recycle:excluirDocumentoOneDrive,attempts:deletionAttempts.current,onProgress:result=>setDeleteResults(previous=>({...previous,[result.id]:result}))});
      const done=new Set(results.filter(item=>item.ok).map(item=>item.id));
      setCheckedIds(previous=>previous.filter(id=>!done.has(id)));
      if(done.has(selectedId))setSelectedId('');
    } finally{pending.current=false;setBusy(false);onBusyChange(false);}
  }
  const destination=virtual?'':folderId;
  function dropDocument(event){
    if(!isFileDrag(event.dataTransfer))return;
    event.preventDefault();setDragging(false);setNotice('');
    if(pending.current||form){setError('Conclua ou cancele a edição atual antes de adicionar outro documento.');return;}
    if(!writable){setError('Você não tem permissão para adicionar documentos nesta pasta.');return;}
    if(folderId==='sources'||folderId.startsWith('source:')){setError('Escolha uma pasta da obra para adicionar o arquivo. Os vínculos dos módulos são somente leitura.');return;}
    const result=droppedFiles(event.dataTransfer);if(result.error){setError(result.error);return;}
    setError('');setSelectedId('');setBatchProgress({});setForm(result.files.length===1?{type:'document',file:result.files[0]}:{type:'batch',files:result.files});
  }
  async function run(type,build,idempotencyKey) {
    if(pending.current)return false;
    pending.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');
    try {
      const payload=typeof build==='function'?await build():build;
      const signature=JSON.stringify({type,version:cabinet.version,payload});
      if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
      const result=await dispatchCommand({type,expectedVersion:cabinet.version,idempotencyKey:idempotencyKey||retry.current.key,payload:{...payload,obraId:work.id},actorId:currentUser.id,actorRole:currentUser.role,actorName:currentUser.nome});
      if(!result?.ok)throw new Error(result?.reason||'A alteração não foi confirmada. Atualize os dados ou tente novamente.');
      retry.current=null;setForm(null);setNotice('Alteração salva.');return true;
    } catch(cause) {setError(cause.message||'Não foi possível salvar. Tente novamente.');return false;}
    finally{pending.current=false;setBusy(false);onBusyChange(false);}
  }
  async function refresh(){if(pending.current)return;pending.current=true;setBusy(true);onBusyChange(true);setError('');try{await onRefresh();setNotice('Dados atualizados.');}catch{setError('Não foi possível atualizar. Tente novamente.');}finally{pending.current=false;setBusy(false);onBusyChange(false);}}
  async function uploadDocument(payload,file){
    const validation=fileValidation(file);if(validation)throw new Error(validation);
    const cached=uploadCache.current.get(payload.revisionId);
    let uploaded=cached?.file===file?cached.result:null;
    if(!uploaded){
      const uploadName=cached?.uploadName||`${crypto.randomUUID()}-${file.name}`;
      uploadCache.current.set(payload.revisionId,{file,uploadName});
      uploaded=await enviarArquivoOneDrive({obraName:work.name,obraId:work.id,category:'arquivos',subfolder:'Central de arquivos',fileName:uploadName,dataUrl:await readDataUrl(file)});
      if(!uploaded.ok)throw new Error(uploaded.error||'Upload não confirmado. Confira a conexão com o OneDrive.');
      uploadCache.current.set(payload.revisionId,{file,uploadName,result:uploaded});
    }
    return {...payload,url:uploaded.url,size:file.size,fileName:file.name,mime:file.type,driveId:uploaded.workspace?.driveId||'',itemId:uploaded.item?.id||uploaded.path};
  }
  async function saveDocument(payload,file){
    await run(form?.type==='revision'?CMD.REVISION_ADDED:CMD.DOCUMENT_ADDED,()=>payload.kind==='file'?uploadDocument(payload,file):payload);
  }
  async function saveBatch(items){
    if(!writable){setError('Você não tem permissão para adicionar documentos nesta pasta.');return;}
    await run(CMD.DOCUMENTS_ADDED,async()=>{
      const documents=[];
      for(const {file,...payload} of items){
        setBatchProgress(previous=>({...previous,[payload.revisionId]:'Enviando ao OneDrive'}));
        try{documents.push(await uploadDocument(payload,file));setBatchProgress(previous=>({...previous,[payload.revisionId]:'Enviado ao OneDrive; aguardando conclusão do lote'}));}
        catch(cause){setBatchProgress(previous=>({...previous,[payload.revisionId]:'Falha no envio; tente novamente'}));throw cause;}
      }
      return {folderId:destination,documents};
    },`files-batch-${items[0].id}`);
  }
  async function deleteDocument() {
    if(pending.current||!deletion)return;
    pending.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');
    const document=deletion.document;
    const operationId=document.trash?.operationId||deletionAttempts.current.get(document.id)||crypto.randomUUID();
    deletionAttempts.current.set(document.id,operationId);
    const actor={actorId:currentUser.id,actorRole:currentUser.role,actorName:currentUser.nome};
    try {
      const started=await dispatchCommand({...actor,type:CMD.DOCUMENT_TRASH_REQUESTED,expectedVersion:deletion.version,idempotencyKey:`${operationId}-request`,payload:{obraId:work.id,id:document.id,operationId}});
      if(!started?.ok)throw new Error(started?.reason||'A exclusão não foi iniciada. Atualize os dados e tente novamente.');
      const confirmed=started.data?.workFileCabinets?.find(item=>item.obraId===work.id);
      if(confirmed?.documents?.find(item=>item.id===document.id)?.trash?.operationId!==operationId)throw new Error('A exclusão não foi confirmada pelo servidor. Atualize os dados antes de continuar.');
      const recycled=await excluirDocumentoOneDrive({obraId:work.id,id:document.id,operationId});
      if(!recycled.ok||!recycled.receipt)throw new Error(recycled.error||'O OneDrive não confirmou o envio à lixeira. Tente concluir a exclusão novamente.');
      const completed=await dispatchCommand({...actor,type:CMD.DOCUMENT_TRASH_COMPLETED,expectedVersion:confirmed.version,idempotencyKey:`${operationId}-complete`,payload:{obraId:work.id,id:document.id,operationId,receipt:recycled.receipt}});
      if(!completed?.ok)throw new Error(completed?.reason||'Os arquivos foram enviados à lixeira, mas a central ainda não confirmou. Tente concluir a exclusão novamente.');
      setDeletion(null);setSelectedId('');setNotice('Documento excluído. Histórico preservado.');searchInput.current?.focus();
    } catch(cause){setError(cause.message||'Não foi possível concluir. Atualize os dados e tente novamente.');}
    finally{pending.current=false;setBusy(false);onBusyChange(false);}
  }
  function openRevision(revision,event){previewTrigger.current=event.currentTarget;setPreview({documentId:selected.id,revisionId:revision.id});}
  function navigate(id){clearSelection();setFolderId(id);setSelectedId('');setForm(null);setSearch('');}
  function closeDetails(){setSelectedId('');if(documentTrigger.current?.isConnected)documentTrigger.current.focus();else searchInput.current?.focus();}
  function folderButtons(parent='',depth=0){if(depth>8)return null;return cabinet.folders.filter(item=>item.parentId===parent).map(item=><div key={item.id} className="work-files-folder-branch"><Button variant={folderId===item.id?'secondary':'ghost'} disabled={busy} aria-current={folderId===item.id?'page':undefined} onClick={()=>navigate(item.id)}><Folder data-icon="inline-start" />{item.name}</Button>{folderButtons(item.id,depth+1)}</div>);}
  return <>
    {batchDeletion&&<BatchDeleteDialog documents={batchDeletion} folders={cabinet.folders} workName={work.name} busy={busy} results={deleteResults} triggerRef={deletionTrigger} onConfirm={deleteChecked} onClose={()=>{setBatchDeletion(null);searchInput.current?.focus();}} />}
    {deletion&&<DeleteDocumentDialog document={selected?.id===deletion.document.id?selected:deletion.document} workName={work.name} folderName={folderPath(cabinet.folders,deletion.document.folderId).map(item=>item.name).join(' / ')||'Raiz da obra'} busy={busy} error={error} triggerRef={deletionTrigger} onClose={()=>{setDeletion(null);setError('');}} onConfirm={deleteDocument} />}
    {previewDocument&&<FilePreview key={preview.documentId} document={previewDocument} initialRevisionId={preview.revisionId} onClose={()=>setPreview(null)} />}
    <div className="work-files-explorer" hidden={Boolean(previewDocument)}>
    <div className="work-files-toolbar"><div className="work-files-actions">{writable&&<><Button variant="outline" disabled={busy} onClick={()=>{clearSelection();setForm({type:'document'});setSelectedId('');}}><Upload data-icon="inline-start" />Adicionar documento</Button><Button disabled={busy} onClick={()=>{clearSelection();setBatchProgress({});setForm({type:'batch',files:[]});setSelectedId('');}}>Adicionar arquivos</Button><Button variant="outline" disabled={busy} onClick={()=>{setForm({type:'folder'});setSelectedId('');}}><FolderPlus data-icon="inline-start" />Nova pasta</Button></>}{writable&&defaultFoldersMissing(cabinet.folders)&&<Button variant="outline" disabled={busy} onClick={()=>run(CMD.TEMPLATE_APPLIED,{})}>Criar pastas padrão</Button>}<Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw data-icon="inline-start" />Atualizar</Button></div><p>{cabinet.documents.filter(item=>!item.deletedAt).length} documento(s) nesta central · {inherited.length} vínculo(s) dos módulos</p></div>
    {error&&!deletion&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<p className="work-files-status" role="status">{busy?'Salvando…':notice}</p>
    <div className="work-files-mobile-folder"><Select label="Pasta atual" value={folderId} disabled={busy} onChange={event=>navigate(event.target.value)}><option value="*">Todos os documentos</option><option value="">Raiz da obra</option>{cabinet.folders.map(item=><option key={item.id} value={item.id}>{folderPath(cabinet.folders,item.id).map(part=>part.name).join(' / ')}</option>)}<option value="sources">Documentos dos módulos</option>{Object.entries(LICENSING_AREAS).map(([id,label])=><option key={id} value={`source:${id}`}>{label} · Licenciamento</option>)}</Select></div>
    <div className="work-files-layout"><aside className="work-files-sidebar" aria-label="Pastas da obra"><h2>Documentação</h2><Button variant={folderId==='*'?'secondary':'ghost'} disabled={busy} onClick={()=>navigate('*')}>Todos os documentos</Button><Button variant={folderId===''?'secondary':'ghost'} disabled={busy} onClick={()=>navigate('')}>Raiz da obra</Button>{folderButtons()}<h3>Anexos do licenciamento</h3>{Object.entries(LICENSING_AREAS).map(([id,label])=><Button key={id} variant={folderId===`source:${id}`?'secondary':'ghost'} disabled={busy} onClick={()=>navigate(`source:${id}`)}>{label} · {inherited.filter(item=>item.area===id).length}</Button>)}<Button variant={folderId==='sources'?'secondary':'ghost'} disabled={busy} onClick={()=>navigate('sources')}>Documentos dos módulos</Button></aside>
    <section className="work-files-content" aria-label="Documentos da obra" data-dragging={dragging||undefined} onDragOver={event=>{if(isFileDrag(event.dataTransfer)){event.preventDefault();event.dataTransfer.dropEffect=writable&&!busy?'copy':'none';if(!form&&!busy&&writable)setDragging(true);}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDragging(false);}} onDrop={dropDocument}><nav aria-label="Caminho da pasta" className="work-files-breadcrumb"><Button variant="link" disabled={busy} onClick={()=>navigate('')}>{work.name}</Button>{path.map(item=><Button key={item.id} variant="link" disabled={busy} onClick={()=>navigate(item.id)}>{item.name}</Button>)}</nav>
      {currentUser.role==='admin'&&cabinet.folders.some(item=>item.id===folderId)&&<Button variant="outline" disabled={busy} onClick={()=>setForm({type:'access',folder:cabinet.folders.find(item=>item.id===folderId)})}>Permissões desta pasta</Button>}
      {folderId.startsWith('source:')&&<h2>{LICENSING_AREAS[folderId.slice(7)]} · Licenciamento</h2>}
      {writable&&!form&&<p>Arraste até 20 arquivos para esta área ou use Adicionar arquivos. Até 3 MB por arquivo. Confira o lote antes de enviar.</p>}
      {form?.type==='batch'?<BatchFileForm files={form.files} folderName={path.map(item=>item.name).join(' / ')||'Raiz da obra'} busy={busy} progress={batchProgress} onSave={saveBatch} onCancel={()=>setForm(null)} />:form?.type==='access'?<FolderAccessForm folder={form.folder} users={(data.usuarios||[]).filter(user=>!user.obraId||user.obraId===work.id)} busy={busy} onCancel={()=>setForm(null)} onSave={payload=>run(CMD.FOLDER_ACCESS_CHANGED,payload)} />:form?.type==='folder'?<FolderForm key={form.folder?.id||'new'} folders={cabinet.folders} folder={form.folder} parentId={destination} busy={busy} onCancel={()=>setForm(null)} onSave={payload=>run(CMD.FOLDER_SAVED,payload)} />:form?.type==='document'||form?.type==='revision'?<DocumentForm key={form.document?.id||'new'} document={form.document} initialFile={form.file} folders={cabinet.folders} folderId={destination} busy={busy} onCancel={()=>setForm(null)} onSave={saveDocument} />:<>
      <div className="work-files-filters"><Input ref={searchInput} label="Buscar documentos em toda a obra" type="search" value={search} disabled={busy} onChange={event=>{clearSelection();setSearch(event.target.value);}} placeholder="Título, revisão ou descrição" /><Select label="Origem do documento" value={source} disabled={busy} onChange={event=>{clearSelection();setSource(event.target.value);}}><option value="">Todas as origens</option>{[...new Set(all.map(item=>item.source))].sort().map(item=><option key={item}>{item}</option>)}</Select></div>
      <div className="work-files-list" aria-label="Conteúdo da pasta">
        {!query&&!virtual&&folders.map(folder=><div key={folder.id} className="work-files-folder-row"><Button variant="ghost" disabled={busy} onClick={()=>navigate(folder.id)}><Folder data-icon="inline-start" />{folder.name}</Button>{writable&&<Button variant="link" disabled={busy} aria-label={`Editar pasta ${folder.name}`} onClick={()=>setForm({type:'folder',folder})}>Editar pasta</Button>}</div>)}
        {FILE_ROLES.includes(currentUser.role)&&visible.length>0&&<div className="work-files-selection" aria-label="Seleção de documentos">
          <div className="work-files-actions"><Checkbox label="Selecionar disponíveis" disabled={busy||!selectable.length} checked={selectable.length>0&&checked.length===selectable.length} onChange={event=>setCheckedIds(event.target.checked?selectable.map(item=>item.id):[])} /><span role="status">{checked.length===1?'1 selecionado':`${checked.length} selecionados`}</span></div>
          {checked.length>0&&<div className="work-files-actions"><Button variant="ghost" disabled={busy} onClick={clearSelection}>Limpar seleção</Button><Button variant="destructive" disabled={busy} onClick={openBatchDeletion}>Excluir selecionados ({checked.length})</Button></div>}
        </div>}
        <p>Marque as caixas para excluir vários documentos. O nome abre os detalhes.</p><p>{visible.length} documento(s){query?' encontrados em toda a obra':''}</p>
        {visible.map(item=>{const revision=item.revisions.at(-1);return <article className="work-files-row" data-selected={checkedIds.includes(item.id)||selectedId===item.id} key={item.id}><div className="work-files-row-name">{FILE_ROLES.includes(currentUser.role)&&!item.readOnly&&<Checkbox aria-label={`Selecionar ${item.name}`} title={deletionBlock(data,cabinet,item,currentUser)||'Selecionar para excluir'} disabled={busy||Boolean(deletionBlock(data,cabinet,item,currentUser))} checked={checkedIds.includes(item.id)&&!deletionBlock(data,cabinet,item,currentUser)} onChange={event=>setCheckedIds(previous=>event.target.checked?[...previous,item.id]:previous.filter(id=>id!==item.id))} />}{revision?.kind==='file'?<FileText aria-hidden="true" />:<LinkIcon aria-hidden="true" />}<div><Button variant="link" aria-expanded={selectedId===item.id} disabled={busy} onClick={event=>{documentTrigger.current=event.currentTarget;setSelectedId(item.id);}}>{item.name}</Button><p>{item.source} · {item.readOnly?'Somente consulta · exclua no módulo de origem':folderPath(cabinet.folders,item.folderId).map(part=>part.name).join(' / ')||'Raiz da obra'}</p>{!item.readOnly&&deletionBlock(data,cabinet,item,currentUser)&&<p>{deletionBlock(data,cabinet,item,currentUser)}</p>}</div></div><div className="work-files-row-meta">{item.trash&&<span>Exclusão pendente</span>}<strong>{revision?.label}</strong><span>{fileSize(revision?.size)}</span><span>{item.revisions.length} revisão(ões)</span></div></article>;})}
        {!visible.length&&<EmptyState title={query?'Nenhum documento encontrado':'Esta pasta está pronta para receber documentos'} description={query?'Tente outro título, revisão ou origem.':'Adicione arquivos ou links, ou escolha Documentos dos módulos para consultar os vínculos existentes.'} />}
      </div></>}
    </section>
    {selected&&!form&&<aside className="work-files-detail" aria-label="Detalhes e revisões"><Button variant="ghost" onClick={closeDetails}><ArrowLeft data-icon="inline-start" />Fechar detalhes</Button><h2 ref={detailHeading} tabIndex={-1}>{selected.name}</h2><p>{selected.source}{selected.readOnly?' · Consulte o módulo de origem para alterar este documento.':''}</p>{writable&&!selected.readOnly&&folderAccess(cabinet,selected.folderId,currentUser,'write')&&<><Button variant="destructive" disabled={busy} onClick={event=>{deletionTrigger.current=event.currentTarget;setError('');setDeletion({document:selected,version:cabinet.version});}}>{selected.trash?'Concluir exclusão':'Excluir documento'}</Button><Button disabled={busy||Boolean(selected.trash)} onClick={()=>setForm({type:'revision',document:selected})}><History data-icon="inline-start" />Nova revisão</Button><Select label="Mover documento para pasta" disabled={busy||Boolean(selected.trash)} value={selected.folderId} onChange={event=>run(CMD.DOCUMENT_MOVED,{id:selected.id,folderId:event.target.value})}><option value="">Raiz da obra</option>{cabinet.folders.map(item=><option key={item.id} value={item.id}>{folderPath(cabinet.folders,item.id).map(part=>part.name).join(' / ')}</option>)}</Select></>}
      {selected.stage&&<p>Origem: {selected.areaLabel} · {selected.stage} · {selected.stageStatus}</p>}
      {selected.trash&&<Alert><AlertDescription>Exclusão pendente. Algumas revisões podem já estar na lixeira. Use Concluir exclusão para finalizar; o histórico será preservado.</AlertDescription></Alert>}<h3>Histórico de revisões</h3><ol className="work-files-revisions">{[...selected.revisions].reverse().map((revision,index)=><li key={revision.id}><h4>{revision.label}{index===0?' · Atual':''}</h4><p>{revision.note||'Sem descrição adicional.'}</p><p>{dateLabel(revision.createdAt)}{revision.createdByName?` · ${revision.createdByName}`:''}</p>{revision.fileName&&<p>{revision.fileName} · {fileSize(revision.size)}</p>}<Button variant="outline" disabled={Boolean(selected.trash)} onClick={event=>openRevision(revision,event)}><Eye data-icon="inline-start" />Visualizar {revision.label}</Button></li>)}</ol>
    </aside>}
    </div>
    <details className="work-files-audit"><summary>Histórico de organização da obra</summary>{[...cabinet.history].reverse().slice(0,100).map(event=><p key={event.id}>{dateLabel(event.at)} · {event.actorName} · {event.detail}</p>)}{!cabinet.history.length&&<p>Nenhuma alteração registrada nesta central.</p>}</details>
    </div>
  </>;
}
