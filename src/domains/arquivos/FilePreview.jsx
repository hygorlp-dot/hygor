import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button.jsx';
import { Alert, AlertDescription } from '../../components/ui/alert.jsx';
import { Select } from '../../design-system/primitives/Select.jsx';
import { obterLinkArquivoOneDrive } from '../../api.js';
import { loadPreviewResource } from './preview-resource.js';
import { fileUrl } from './model.js';
const PdfPreview=lazy(()=>import('../../features/financeiro/PdfDocumentPreview.jsx'));

export default function FilePreview({document,initialRevisionId,onClose}) {
  const [revisionId,setRevisionId]=useState(initialRevisionId),[resource,setResource]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const heading=useRef(null);
  const pdfError=useCallback(cause=>setError(cause?.message||'Não foi possível ler este PDF.'),[]);
  const revision=document.revisions.find(item=>item.id===revisionId)||document.revisions.at(-1);
  const externalReference=revision.kind==='link'&&/^https?:\/\//i.test(fileUrl(revision.url)||'')?fileUrl(revision.url):null;
  useEffect(()=>{heading.current?.focus();},[]);
  useEffect(()=>{
    const controller=new AbortController();let objectUrl,cancelled=false;
    setResource(null);setError('');
    loadPreviewResource(revision,{resolveFile:obterLinkArquivoOneDrive,signal:controller.signal}).then(result=>{
      if(cancelled)return;objectUrl=URL.createObjectURL(result.blob);setResource({...result,url:objectUrl});
    }).catch(cause=>{if(!cancelled)setError(cause.message||'Não foi possível visualizar o documento. Tente novamente.');});
    return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[revision,attempt]);
  return <section className="work-file-viewer" aria-label="Visualizador de documentos">
    <div className="work-files-actions"><Button variant="outline" onClick={onClose}><ArrowLeft data-icon="inline-start" />Fechar visualização</Button>{resource&&<Button variant="outline" asChild><a href={resource.url} download={revision.fileName||document.name}><Download data-icon="inline-start" />Baixar documento</a></Button>}{externalReference&&<Button variant="outline" asChild><a href={externalReference} target="_blank" rel="noopener noreferrer"><ExternalLink data-icon="inline-start" />Abrir link cadastrado</a></Button>}</div>
    <h2 ref={heading} tabIndex={-1}>{document.name}</h2><p>{document.source}{document.areaLabel?` · ${document.areaLabel}`:''}{document.stage?` · ${document.stage}`:''}</p>
    <Select label="Revisão do documento" value={revision.id} onChange={event=>setRevisionId(event.target.value)} options={[...document.revisions].reverse().map((item,index)=>({value:item.id,label:`${item.label}${index===0?' · Atual':''}`}))} />
    <p>{revision.note||'Documento original anexado à obra.'}</p>
    {error?<Alert variant="destructive"><AlertDescription><p>{error}</p><Button variant="outline" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</Button></AlertDescription></Alert>:!resource?<p role="status">Carregando documento…</p>:resource.kind==='pdf'?<Suspense fallback={<p role="status">Preparando leitor de PDF…</p>}><PdfPreview key={resource.url} url={resource.url} name={document.name} onError={pdfError} /></Suspense>:resource.kind==='image'?<div className="work-file-viewer-surface"><img src={resource.url} alt={document.name} onError={()=>setError('Não foi possível visualizar esta imagem.')} /></div>:resource.kind==='text'?<pre className="work-file-viewer-text" tabIndex={0} aria-label="Conteúdo do documento">{resource.text}</pre>:<p role="status">Este formato está preservado, mas ainda não possui leitor interno. Use Baixar documento para consultar o arquivo.</p>}
  </section>;
}
