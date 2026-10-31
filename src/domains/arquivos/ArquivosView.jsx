import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, FolderPlus, FileText, Link as LinkIcon, Upload, RefreshCw, ArrowLeft, Eye, History } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { Alert, AlertDescription } from '../../components/ui/alert.jsx';
import { Input } from '../../design-system/primitives/Input.jsx';
import { Select } from '../../design-system/primitives/Select.jsx';
import { PageHeader } from '../../design-system/patterns/PageHeader.jsx';
import { EmptyState } from '../../design-system/patterns/FeedbackState.jsx';
import { enviarArquivoOneDrive } from '../../api.js';
import { FILE_COMMAND as CMD, FILE_ROLES } from './commands.js';
import { fileSize, fileValidation, folderPath } from './model.js';
import { sourceDocuments } from './source-documents.js';
import { DocumentForm, FolderForm } from './FileForms.jsx';
import FilePreview from './FilePreview.jsx';
import { LICENSING_AREAS } from './licensing-documents.js';
import './arquivos.css';

const dateLabel=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('pt-BR'):'Data não informada';
const readDataUrl=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});

export default function ArquivosView({data,currentUser,dispatchCommand,onRefresh}) {
  const works=(data.obras||[]).filter(work=>currentUser.role==='admin'||!currentUser.obraId||work.id===currentUser.obraId);
  const [workId,setWorkId]=useState(currentUser.obraId||works[0]?.id||'');
  const [pending,setPending]=useState(false);
  const obraId=works.some(item=>item.id===workId)?workId:works[0]?.id||'';
  const work=works.find(item=>item.id===obraId);
  return <div className="work-files"><PageHeader title="Arquivos" description="Toda a documentação da obra, organizada por pasta e revisão." />
    <Select label="Obra dos arquivos" value={obraId} disabled={pending} onChange={event=>setWorkId(event.target.value)}>{works.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    {work?<FileExplorer key={work.id} {...{data,currentUser,dispatchCommand,onRefresh,work}} onBusyChange={setPending} />:<EmptyState title="Nenhuma obra disponível" description="Cadastre uma obra ou solicite acesso para organizar seus documentos." />}
  </div>;
}
function FileExplorer({data,currentUser,dispatchCommand,onRefresh,work,onBusyChange}) {
  const cabinet=(data.workFileCabinets||[]).find(item=>item.obraId===work.id)||{version:0,folders:[],documents:[],history:[]};
  const [folderId,setFolderId]=useState('*'),[selectedId,setSelectedId]=useState(''),[form,setForm]=useState(null),[search,setSearch]=useState(''),[source,setSource]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [preview,setPreview]=useState(null);
  const pending=useRef(false),uploadCache=useRef(new Map()),retry=useRef(null),detailHeading=useRef(null),documentTrigger=useRef(null),searchInput=useRef(null),previewTrigger=useRef(null);
  const writable=FILE_ROLES.includes(currentUser.role);
  const inherited=useMemo(()=>sourceDocuments(data,work.id),[data,work.id]);
  const all=[...cabinet.documents.map(item=>({...item,source:'Arquivos'})),...inherited];
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
  const destination=virtual?'':folderId;
  async function run(type,build) {
    if(pending.current)return false;
    pending.current=true;setBusy(true);onBusyChange(true);setError('');setNotice('');
    try {
      const payload=typeof build==='function'?await build():build;
      const signature=JSON.stringify({type,version:cabinet.version,payload});
      if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
      const result=await dispatchCommand({type,expectedVersion:cabinet.version,idempotencyKey:retry.current.key,payload:{...payload,obraId:work.id},actorId:currentUser.id,actorRole:currentUser.role,actorName:currentUser.nome});
      if(!result?.ok)throw new Error(result?.reason||'A alteração não foi confirmada. Atualize os dados ou tente novamente.');
      retry.current=null;setForm(null);setNotice('Alteração salva.');return true;
    } catch(cause) {setError(cause.message||'Não foi possível salvar. Tente novamente.');return false;}
    finally{pending.current=false;setBusy(false);onBusyChange(false);}
  }
  async function refresh(){if(pending.current)return;pending.current=true;setBusy(true);onBusyChange(true);setError('');try{await onRefresh();setNotice('Dados atualizados.');}catch{setError('Não foi possível atualizar. Tente novamente.');}finally{pending.current=false;setBusy(false);onBusyChange(false);}}
  async function saveDocument(payload,file){
    await run(form?.type==='revision'?CMD.REVISION_ADDED:CMD.DOCUMENT_ADDED,async()=>{
      if(payload.kind!=='file')return payload;
      const validation=fileValidation(file);if(validation)throw new Error(validation);
      const cached=uploadCache.current.get(payload.revisionId);
      let uploaded=cached?.file===file?cached.result:null;
      if(!uploaded){
        uploaded=await enviarArquivoOneDrive({obraName:work.name,obraId:work.id,category:'arquivos',subfolder:'Central de arquivos',fileName:`${crypto.randomUUID()}-${file.name}`,dataUrl:await readDataUrl(file)});
        if(!uploaded.ok)throw new Error(uploaded.error||'Upload não confirmado. Confira a conexão com o OneDrive.');
        uploadCache.current.set(payload.revisionId,{file,result:uploaded});
      }
      return {...payload,url:uploaded.url,size:file.size,fileName:file.name,mime:file.type,driveId:uploaded.workspace?.driveId||'',itemId:uploaded.item?.id||uploaded.path};
    });
  }
  function openRevision(revision,event){previewTrigger.current=event.currentTarget;setPreview({documentId:selected.id,revisionId:revision.id});}
  function navigate(id){setFolderId(id);setSelectedId('');setForm(null);setSearch('');}
  function closeDetails(){setSelectedId('');if(documentTrigger.current?.isConnected)documentTrigger.current.focus();else searchInput.current?.focus();}
  function folderButtons(parent='',depth=0){if(depth>8)return null;return cabinet.folders.filter(item=>item.parentId===parent).map(item=><div key={item.id} className="work-files-folder-branch"><Button variant={folderId===item.id?'secondary':'ghost'} disabled={busy} aria-current={folderId===item.id?'page':undefined} onClick={()=>navigate(item.id)}><Folder data-icon="inline-start" />{item.name}</Button>{folderButtons(item.id,depth+1)}</div>);}
  return <>
    {previewDocument&&<FilePreview key={preview.documentId} document={previewDocument} initialRevisionId={preview.revisionId} onClose={()=>setPreview(null)} />}
    <div className="work-files-explorer" hidden={Boolean(previewDocument)}>
    <div className="work-files-toolbar"><div className="work-files-actions">{writable&&<><Button disabled={busy} onClick={()=>{setForm({type:'document'});setSelectedId('');}}><Upload data-icon="inline-start" />Adicionar documento</Button><Button variant="outline" disabled={busy} onClick={()=>{setForm({type:'folder'});setSelectedId('');}}><FolderPlus data-icon="inline-start" />Nova pasta</Button></>}<Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw data-icon="inline-start" />Atualizar</Button></div><p>{cabinet.documents.length} documento(s) nesta central · {inherited.length} vínculo(s) dos módulos</p></div>
    {error&&<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<p className="work-files-status" role="status">{busy?'Salvando…':notice}</p>
    <div className="work-files-mobile-folder"><Select label="Pasta atual" value={folderId} disabled={busy} onChange={event=>navigate(event.target.value)}><option value="*">Todos os documentos</option><option value="">Raiz da obra</option>{cabinet.folders.map(item=><option key={item.id} value={item.id}>{folderPath(cabinet.folders,item.id).map(part=>part.name).join(' / ')}</option>)}<option value="sources">Documentos dos módulos</option>{Object.entries(LICENSING_AREAS).map(([id,label])=><option key={id} value={`source:${id}`}>{label} · Licenciamento</option>)}</Select>{writable&&!cabinet.folders.length&&<Button variant="outline" disabled={busy} onClick={()=>run(CMD.TEMPLATE_APPLIED,{})}>Criar pastas padrão</Button>}</div>
    <div className="work-files-layout"><aside className="work-files-sidebar" aria-label="Pastas da obra"><h2>Documentação</h2><Button variant={folderId==='*'?'secondary':'ghost'} disabled={busy} onClick={()=>navigate('*')}>Todos os documentos</Button><Button variant={folderId===''?'secondary':'ghost'} disabled={busy} onClick={()=>navigate('')}>Raiz da obra</Button>{folderButtons()}<h3>Anexos do licenciamento</h3>{Object.entries(LICENSING_AREAS).map(([id,label])=><Button key={id} variant={folderId===`source:${id}`?'secondary':'ghost'} disabled={busy} onClick={()=>navigate(`source:${id}`)}>{label} · {inherited.filter(item=>item.area===id).length}</Button>)}<Button variant={folderId==='sources'?'secondary':'ghost'} disabled={busy} onClick={()=>navigate('sources')}>Documentos dos módulos</Button>{writable&&!cabinet.folders.length&&<Button variant="outline" disabled={busy} onClick={()=>run(CMD.TEMPLATE_APPLIED,{})}>Criar pastas padrão</Button>}</aside>
    <section className="work-files-content" aria-label="Documentos da obra"><nav aria-label="Caminho da pasta" className="work-files-breadcrumb"><Button variant="link" disabled={busy} onClick={()=>navigate('')}>{work.name}</Button>{path.map(item=><Button key={item.id} variant="link" disabled={busy} onClick={()=>navigate(item.id)}>{item.name}</Button>)}</nav>
      {folderId.startsWith('source:')&&<h2>{LICENSING_AREAS[folderId.slice(7)]} · Licenciamento</h2>}
      {form?.type==='folder'?<FolderForm key={form.folder?.id||'new'} folders={cabinet.folders} folder={form.folder} parentId={destination} busy={busy} onCancel={()=>setForm(null)} onSave={payload=>run(CMD.FOLDER_SAVED,payload)} />:form?.type==='document'||form?.type==='revision'?<DocumentForm key={form.document?.id||'new'} document={form.document} folders={cabinet.folders} folderId={destination} busy={busy} onCancel={()=>setForm(null)} onSave={saveDocument} />:<>
      <div className="work-files-filters"><Input ref={searchInput} label="Buscar documentos em toda a obra" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Título, revisão ou descrição" /><Select label="Origem do documento" value={source} onChange={event=>setSource(event.target.value)}><option value="">Todas as origens</option>{[...new Set(all.map(item=>item.source))].sort().map(item=><option key={item}>{item}</option>)}</Select></div>
      <div className="work-files-list" aria-label="Conteúdo da pasta">
        {!query&&!virtual&&folders.map(folder=><div key={folder.id} className="work-files-folder-row"><Button variant="ghost" disabled={busy} onClick={()=>navigate(folder.id)}><Folder data-icon="inline-start" />{folder.name}</Button>{writable&&<Button variant="link" disabled={busy} aria-label={`Editar pasta ${folder.name}`} onClick={()=>setForm({type:'folder',folder})}>Editar pasta</Button>}</div>)}
        <p>{visible.length} documento(s){query?' encontrados em toda a obra':''}</p>
        {visible.map(item=>{const revision=item.revisions.at(-1);return <article className="work-files-row" data-selected={selectedId===item.id} key={item.id}><div className="work-files-row-name">{revision?.kind==='file'?<FileText aria-hidden="true" />:<LinkIcon aria-hidden="true" />}<div><Button variant="link" aria-pressed={selectedId===item.id} onClick={event=>{documentTrigger.current=event.currentTarget;setSelectedId(item.id);}}>{item.name}</Button><p>{item.source} · {item.readOnly?'Vínculo do módulo':folderPath(cabinet.folders,item.folderId).map(part=>part.name).join(' / ')||'Raiz da obra'}</p></div></div><div className="work-files-row-meta"><strong>{revision?.label}</strong><span>{fileSize(revision?.size)}</span><span>{item.revisions.length} revisão(ões)</span></div></article>;})}
        {!visible.length&&<EmptyState title={query?'Nenhum documento encontrado':'Esta pasta está pronta para receber documentos'} description={query?'Tente outro título, revisão ou origem.':'Adicione arquivos ou links, ou escolha Documentos dos módulos para consultar os vínculos existentes.'} />}
      </div></>}
    </section>
    {selected&&!form&&<aside className="work-files-detail" aria-label="Detalhes e revisões"><Button variant="ghost" onClick={closeDetails}><ArrowLeft data-icon="inline-start" />Fechar detalhes</Button><h2 ref={detailHeading} tabIndex={-1}>{selected.name}</h2><p>{selected.source}{selected.readOnly?' · Consulte o módulo de origem para alterar este documento.':''}</p>{writable&&!selected.readOnly&&<><Button disabled={busy} onClick={()=>setForm({type:'revision',document:selected})}><History data-icon="inline-start" />Nova revisão</Button><Select label="Mover documento para pasta" disabled={busy} value={selected.folderId} onChange={event=>run(CMD.DOCUMENT_MOVED,{id:selected.id,folderId:event.target.value})}><option value="">Raiz da obra</option>{cabinet.folders.map(item=><option key={item.id} value={item.id}>{folderPath(cabinet.folders,item.id).map(part=>part.name).join(' / ')}</option>)}</Select></>}
      {selected.stage&&<p>Origem: {selected.areaLabel} · {selected.stage} · {selected.stageStatus}</p>}
      <h3>Histórico de revisões</h3><ol className="work-files-revisions">{[...selected.revisions].reverse().map((revision,index)=><li key={revision.id}><h4>{revision.label}{index===0?' · Atual':''}</h4><p>{revision.note||'Sem descrição adicional.'}</p><p>{dateLabel(revision.createdAt)}{revision.createdByName?` · ${revision.createdByName}`:''}</p>{revision.fileName&&<p>{revision.fileName} · {fileSize(revision.size)}</p>}<Button variant="outline" onClick={event=>openRevision(revision,event)}><Eye data-icon="inline-start" />Visualizar {revision.label}</Button></li>)}</ol>
    </aside>}
    </div>
    <details className="work-files-audit"><summary>Histórico de organização da obra</summary>{[...cabinet.history].reverse().slice(0,100).map(event=><p key={event.id}>{dateLabel(event.at)} · {event.actorName} · {event.detail}</p>)}{!cabinet.history.length&&<p>Nenhuma alteração registrada nesta central.</p>}</details>
    </div>
  </>;
}
