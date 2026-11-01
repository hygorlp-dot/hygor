import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../design-system/primitives/Input.jsx';
GlobalWorkerOptions.workerSrc=workerUrl;
export default function PdfReader({url,name,onError}){
  const canvas=useRef(null);const [pdf,setPdf]=useState(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[pages,setPages]=useState([]),[query,setQuery]=useState(''),[indexing,setIndexing]=useState(true);
  useEffect(()=>{let cancelled=false;setPdf(null);setPages([]);setPage(1);setIndexing(true);const task=getDocument({url,isEvalSupported:false});
    task.promise.then(async doc=>{if(cancelled)return;setPdf(doc);const texts=[];for(let n=1;n<=doc.numPages;n++){if(cancelled)return;const p=await doc.getPage(n),content=await p.getTextContent();texts.push(content.items.map(item=>item.str||'').join(' '));}if(!cancelled){setPages(texts);setIndexing(false);}}).catch(error=>{if(!cancelled)onError(error);});return()=>{cancelled=true;task.destroy();};
  },[url,onError]);
  useEffect(()=>{if(!pdf)return;let cancelled=false,render;pdf.getPage(page).then(async p=>{if(cancelled||!canvas.current)return;const viewport=p.getViewport({scale:1.5*zoom}),element=canvas.current;element.width=viewport.width;element.height=viewport.height;render=p.render({canvasContext:element.getContext('2d'),viewport});await render.promise;}).catch(error=>{if(!cancelled)onError(error);});return()=>{cancelled=true;render?.cancel();};},[pdf,page,zoom,onError]);
  const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const matches=query.trim()?pages.flatMap((text,i)=>normalize(text).includes(normalize(query.trim()))?[{page:i+1,text}]:[]):[];
  return <div className="work-pdf-reader"><Input label={`Buscar no texto do PDF · ${name}`} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Digite uma palavra ou expressão" />
    <p role="status">{indexing?'Preparando busca no texto…':!pages.some(text=>text.trim())?'PDF sem texto extraível. Documentos digitalizados precisam de OCR.':query.trim()?`${matches.length} página(s) encontrada(s).`:'A busca lê todas as páginas deste PDF.'}</p>
    {Boolean(matches.length)&&<ol className="work-pdf-matches">{matches.map(match=><li key={match.page}><Button variant="link" onClick={()=>setPage(match.page)}>Ir para página {match.page}</Button><p>{match.text.slice(Math.max(0,normalize(match.text).indexOf(normalize(query))-55),Math.max(0,normalize(match.text).indexOf(normalize(query))-55)+200)}</p></li>)}</ol>}
    <div className="work-files-actions" aria-label={`Páginas de ${name}`}><Button variant="outline" disabled={!pdf||page===1} onClick={()=>setPage(n=>n-1)}>Anterior</Button><label>Zoom do PDF<SelectControl aria-label="Zoom do PDF" value={zoom} onChange={event=>setZoom(Number(event.target.value))}>{[0.75,1,1.5,2].map(value=><option key={value} value={value}>{value*100}%</option>)}</SelectControl></label><span>Página {page} de {pdf?.numPages||'…'}</span><Button variant="outline" disabled={!pdf||page>=pdf.numPages} onClick={()=>setPage(n=>n+1)}>Próxima</Button></div>
    <div className="work-file-viewer-surface" tabIndex={0} aria-label={`Página do PDF · ${name}`}><canvas ref={canvas} style={{width:`${zoom*100}%`,maxWidth:'none'}} role="img" aria-label={`${name}, página ${page}`} /></div>
  </div>;
}
