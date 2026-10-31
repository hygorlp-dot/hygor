import {lazy, Suspense, useCallback, useEffect, useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Alert, AlertDescription} from '../../components/ui/alert.jsx';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../../components/ui/tabs.jsx';
import {documentPreviewType, isMicrosoftDocumentUrl, previewDocumentUrl} from './document-preview.js';
import {protectedDocumentReference} from '../../domains/financeiro/document-links.js';
import './invoice-conference.css';

const PdfDocumentPreview = lazy(() => import('./PdfDocumentPreview.jsx'));

function XmlOriginal({url, onError}) {
  const [text, setText] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const response = await fetch(url, {signal:controller.signal});
      if (!response.ok) throw new Error('Arquivo indisponível.');
      const original = await response.text();
      if (original.length > 6 * 1024 * 1024) throw new Error('Arquivo muito grande para leitura interna.');
      if (!/^(?:\uFEFF)?\s*<(?:\?xml|nfeProc\b|NFe\b|cteProc\b|CTe\b|CompNfse\b|NFSe\b|nfse\b)/i.test(original)) throw new Error('O provedor não retornou um XML fiscal.');
      if (!controller.signal.aborted) setText(original);
    })().catch(error => { if (!controller.signal.aborted) onError(error); });
    return () => controller.abort();
  }, [url, onError]);
  return text === null ? <p role="status">Carregando XML original…</p> : <pre className="invoice-original__xml" tabIndex={0} aria-label="XML original">{text}</pre>;
}

export function OriginalDocument({document, driveId, resolveFile}) {
  const [resource, setResource] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const source = document.url || document.webUrl || '';
  const originalUrl = previewDocumentUrl(source);
  const kind = documentPreviewType(document);
  const resolvedDrive = document.driveId || document.parentReference?.driveId || driveId;
  const resourceKey = JSON.stringify([source, document.id, resolvedDrive, attempt]);
  const name = document.legenda || document.nome || document.name || 'Documento original';
  const fail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setResource(null);
    (async () => {
      let url = originalUrl;
      const protectedReference = protectedDocumentReference(source);
      if (protectedReference || (document.id && resolvedDrive && (!source || isMicrosoftDocumentUrl(source)))) {
        const response = await resolveFile(protectedReference || {driveId:resolvedDrive, itemId:document.id});
        if (!response?.ok) throw new Error('Não foi possível abrir o arquivo protegido.');
        url = previewDocumentUrl(response.url);
      }
      if (!url) throw new Error('Link indisponível.');
      if (!cancelled) setResource({key:resourceKey, url});
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [source, originalUrl, document.id, resolvedDrive, resolveFile, resourceKey]);

  const url = resource?.key === resourceKey ? resource.url : null;
  return <>
    <div className="invoice-original__heading"><h3>Documento original</h3>{(url || originalUrl) && <a href={url || originalUrl} target="_blank" rel="noopener noreferrer">Abrir original em nova aba</a>}</div>
    <p className="invoice-original__name">{name}</p>
    {failed ? <Alert role="status"><AlertDescription><p>Não foi possível visualizar este arquivo aqui. O provedor pode exigir autenticação ou bloquear a leitura. Abra o original em nova aba; os campos preenchidos foram mantidos.</p><Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></AlertDescription></Alert> : !url ? <p role="status">Preparando documento original…</p> : kind === 'pdf' ? <Suspense fallback={<p role="status">Preparando leitor de PDF…</p>}><PdfDocumentPreview url={url} name={name} onError={fail}/></Suspense> : kind === 'image' ? <div className="invoice-original__surface"><img src={url} alt={name} referrerPolicy="no-referrer" onError={fail}/></div> : kind === 'xml' ? <XmlOriginal url={url} onError={fail}/> : <p role="status">Este formato não tem visualização interna. Abra o original em nova aba e mantenha a ficha aberta para conferir.</p>}
    <p className="invoice-original__hint">Compare o original com os campos ao lado. Trocar o arquivo não altera os dados da nota.</p>
  </>;
}

export default function InvoiceConference({documents = [], driveId, resolveFile, children}) {
  const [selected, setSelected] = useState(0);
  const current = documents[selected] || documents[0];
  const [panel, setPanel] = useState('fields');
  return <Tabs value={panel} onValueChange={setPanel} className="invoice-conference">
    <TabsList className="invoice-conference__tabs" aria-label="Conferência da nota fiscal"><TabsTrigger value="original">Documento</TabsTrigger><TabsTrigger value="fields">Dados da nota</TabsTrigger></TabsList>
    <TabsContent forceMount value="original" className="invoice-conference__original">
      {documents.length > 1 && <label className="invoice-original__select">Arquivo para conferência<select aria-label="Arquivo para conferência" value={documents[selected] ? selected : 0} onChange={event => setSelected(Number(event.target.value))}>{documents.map((document, index) => <option key={`${document.id || index}:${index}`} value={index}>{document.legenda || document.nome || document.name || `Documento ${index + 1}`}</option>)}</select></label>}
      {current ? <OriginalDocument key={`${current.id || selected}:${current.url || current.webUrl || ''}`} document={current} driveId={driveId} resolveFile={resolveFile}/> : <section aria-label="Documento original"><h3>Documento original</h3><p>Nenhum documento anexado. Use “Anexar XML, PDF ou imagem da nota” nos dados da nota para incluir o original.</p></section>}
    </TabsContent>
    <TabsContent forceMount value="fields" className="invoice-conference__fields"><h3>Dados para conferência</h3>{children}</TabsContent>
  </Tabs>;
}
