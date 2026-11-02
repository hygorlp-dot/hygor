import {LoadingState} from '../../design-system/patterns/LoadingState.jsx';
import {SelectControl} from '../../design-system/primitives/Select.jsx';
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
    let cancelled = false, task, settled = false, destroyed = false;
    const controller = new AbortController();
    const destroy = () => {
      if (!task || destroyed) return;
      destroyed = true;
      Promise.resolve(task.destroy()).catch(() => {});
    };
    setPdf(null);
    (async () => {
      try {
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) throw new Error('Não foi possível carregar o PDF.');
        const bytes = await response.arrayBuffer();
        if (cancelled) return;
        task = getDocument({data: new Uint8Array(bytes), isEvalSupported: false});
        const document = await task.promise;
        settled = true;
        if (cancelled) destroy();
        else setPdf(document);
      } catch (error) {
        settled = true;
        if (!cancelled) onError(error);
        else destroy();
      }
    })();
    // Não interromper a inicialização em memória do worker. A conclusão
    // acima encerra a tarefa cancelada, sem atualizar um componente fechado.
    return () => { cancelled = true; controller.abort(); if (settled) destroy(); };
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
      <label>Zoom do PDF<SelectControl aria-label="Zoom do PDF" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[0.75,1,1.5,2].map(value => <option value={value} key={value}>{value * 100}%</option>)}</SelectControl></label>
    </div>
    {rendering && <LoadingState label="página do PDF"/>}
    <div className="invoice-original__surface" tabIndex={0} aria-label="Página do documento original">
      <canvas ref={canvas} style={{width:`${zoom * 100}%`,maxWidth:'none'}} role="img" aria-label={`${name}, página ${page}`} />
    </div>
  </>;
}
