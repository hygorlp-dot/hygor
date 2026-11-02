import {useEffect,useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {fileUrl} from './model.js';
import RevisionPane from './RevisionPane.jsx';
export default function FilePreview({document,initialRevisionId,onClose}){
  const latest=document.revisions.at(-1);const [revisionId,setRevisionId]=useState(initialRevisionId||latest.id),[compare,setCompare]=useState(false),[otherId,setOtherId]=useState(document.revisions.find(item=>item.id!==(initialRevisionId||latest.id))?.id||'');const heading=useRef(null);
  const revision=document.revisions.find(item=>item.id===revisionId)||latest,other=document.revisions.find(item=>item.id===otherId);
  useEffect(()=>{heading.current?.focus();},[]);
  const external=revision.kind==='link'&&/^https?:\/\//i.test(fileUrl(revision.url)||'')?fileUrl(revision.url):null;
  return <section className="work-file-viewer" aria-label="Visualizador de documentos"><div className="work-files-actions"><Button variant="outline" onClick={onClose}>Fechar visualização</Button>{document.revisions.length>1&&<Button variant="outline" aria-pressed={compare} onClick={()=>setCompare(value=>!value)}>{compare?'Encerrar comparação':'Comparar revisões'}</Button>}{external&&<Button variant="outline" asChild><a href={external} target="_blank" rel="noopener noreferrer">Abrir link cadastrado</a></Button>}</div>
    <h2 ref={heading} tabIndex={-1}>{document.name}</h2><p>{document.source}{document.areaLabel?` · ${document.areaLabel}`:''}</p>
    {revision.id!==latest.id&&<Alert><AlertDescription><strong>Você está consultando uma revisão antiga: {revision.label}.</strong> A revisão atual é {latest.label}. <Button variant="link" onClick={()=>setRevisionId(latest.id)}>Abrir revisão atual</Button></AlertDescription></Alert>}
    <div className="work-files-form-grid"><Select label="Revisão do documento" value={revision.id} onChange={event=>setRevisionId(event.target.value)} options={[...document.revisions].reverse().map(item=>({value:item.id,label:`${item.label}${item.id===latest.id?' · Atual':''}`}))} />{compare&&<Select label="Comparar com a revisão" value={otherId} onChange={event=>setOtherId(event.target.value)} options={document.revisions.map(item=>({value:item.id,label:item.label}))} />}</div>
    {compare&&<p>Compare o conteúdo lado a lado. Cada painel tem navegação e busca próprias; não há marcação automática de diferenças.</p>}
    <div className={compare?'work-files-compare':''}><RevisionPane key={revision.id} revision={revision} name={document.name} />{compare&&other&&<RevisionPane key={`other:${other.id}`} revision={other} name={document.name} />}</div>
  </section>;
}
