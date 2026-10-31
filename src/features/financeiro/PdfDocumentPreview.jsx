import {useEffect, useRef, useState} from 'react';
import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {Button} from '../../components/ui/button.jsx';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfDocumentPreview({url, name, onError}) {
  const canvas = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let task;
    const controller=new AbortController();
    setPdf(null);setPage(1);setRendering(true);
    (async()=>{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw Object.assign(new Error('Arquivo indisponível.'),{status:response.status});
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(cancelled)return;
      task=getDocument({data:bytes,isEvalSupported:false});
      const document=await task.promise;
      if(!cancelled)setPdf(document);
    })().catch(error=>{if(!cancelled)onError(error);});
    return () => {
      cancelled=true;controller.abort();
      // PDF.js 4 can throw inside its worker when initialization is destroyed.
      // Network loading is abortable above; in-memory initialization settles first.
      if(task)void task.promise.catch(()=>{}).then(()=>task.destroy()).catch(()=>{});
    };
  }, [url, onError]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false, render;
    setRendering(true);
    pdf.getPage(page).then(async documentPage => {
      if (cancelled) return;
      const viewport = documentPage.getViewport({scale:zoom * 1.3});
      const element = canvas.current;
      element.width = viewport.width;
      element.height = viewport.height;
      render = documentPage.render({canvasContext:element.getContext('2d'), viewport});
      await render.promise;
      if (!cancelled) setRendering(false);
    }).catch(error => { if (!cancelled) onError(error); });
    return () => { cancelled = true; render?.cancel(); };
  }, [pdf, page, zoom, onError]);

  return <>
    <div className="invoice-original__toolbar" aria-label="Navegar no PDF">
      <Button variant="outline" size="sm" disabled={!pdf || page === 1} onClick={() => setPage(value => value - 1)}>Anterior</Button>
      <span aria-live="polite">Página {page} de {pdf?.numPages || '…'}</span>
      <Button variant="outline" size="sm" disabled={!pdf || page >= pdf.numPages} onClick={() => setPage(value => value + 1)}>Próxima</Button>
      <label>Zoom do PDF<select aria-label="Zoom do PDF" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[0.75,1,1.5,2].map(value => <option value={value} key={value}>{value * 100}%</option>)}</select></label>
    </div>
    {rendering && <p role="status">Carregando página do PDF…</p>}
    <div className="invoice-original__surface" tabIndex={0} aria-label="Página do documento original">
      <canvas ref={canvas} style={{width:`${zoom * 100}%`,maxWidth:'none'}} role="img" aria-label={`${name}, página ${page}`} />
    </div>
  </>;
}
