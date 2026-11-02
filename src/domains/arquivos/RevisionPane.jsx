import {LoadingState} from '../../design-system/patterns/LoadingState.jsx';
import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {obterLinkArquivoOneDrive,lerArquivoOneDrive} from '../../api.js';
import {loadPreviewResource} from './preview-resource.js';
const PdfReader=lazy(()=>import('./PdfReader.jsx'));
export default function RevisionPane({revision,name}){
  const [resource,setResource]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const pdfError=useCallback(cause=>setError(cause?.message||'Não foi possível ler o PDF.'),[]);
  useEffect(()=>{const controller=new AbortController();let objectUrl,cancelled=false;setResource(null);setError('');loadPreviewResource(revision,{resolveFile:obterLinkArquivoOneDrive,fetchProtected:lerArquivoOneDrive,signal:controller.signal}).then(result=>{if(cancelled)return;objectUrl=URL.createObjectURL(result.blob);setResource({...result,url:objectUrl});}).catch(cause=>{if(!cancelled)setError(cause.message||'Não foi possível ler o arquivo.');});return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[revision,attempt]);
  return <section aria-label={`Conteúdo da revisão ${revision.label}`}><h3>{revision.label}</h3><p>{revision.note}</p>{resource&&<Button variant="outline" asChild><a href={resource.url} download={revision.fileName||name}>Baixar documento</a></Button>}
    {error?<Alert variant="destructive"><AlertDescription><p>{error}</p><Button variant="outline" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</Button></AlertDescription></Alert>:!resource?<LoadingState label="documento"/>:resource.kind==='pdf'?<Suspense fallback={<LoadingState label="PDF"/>}><PdfReader url={resource.url} name={name} onError={pdfError} /></Suspense>:resource.kind==='image'?<div className="work-file-viewer-surface"><img src={resource.url} alt={`${name} · ${revision.label}`} /></div>:resource.kind==='text'?<pre className="work-file-viewer-text" tabIndex={0} aria-label="Conteúdo do documento">{resource.text}</pre>:<p>Formato sem leitor interno. Use o download para consultar.</p>}
  </section>;
}
