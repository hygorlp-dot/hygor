import {LoadingState} from '../../design-system/patterns/LoadingState.jsx';
import {SelectControl} from '../../design-system/primitives/Select.jsx';
import { Suspense, useCallback, useEffect, useState } from "react";
import { lazyWithCssRetry as lazy } from "../../lib/lazy-with-css-retry.js";
import {Button} from '../../components/ui/button.jsx';
import {Alert, AlertDescription} from '../../components/ui/alert.jsx';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../../components/ui/tabs.jsx';
import {documentPreviewType, isMicrosoftDocumentUrl, previewDocumentUrl} from './document-preview.js';
import {protectedDocumentReference} from '../../domains/financeiro/document-links.js';
import {documentReadError,documentEvidenceInfo} from '../../domains/financeiro/document-evidence.js';
import FinancialDocumentLink from './FinancialDocumentLink.jsx';
import './invoice-conference.css';

const PdfDocumentPreview = lazy(() => import('./PdfDocumentPreview.jsx'));

function XmlOriginal({url, onError}) {
  const [text, setText] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const response = await fetch(url, {signal:controller.signal});
      if (!response.ok) throw Object.assign(new Error('Arquivo indisponível.'),{status:response.status});
      const original = await response.text();
      if (original.length > 6 * 1024 * 1024) throw new Error('Arquivo muito grande para leitura interna.');
      if (!/^(?:\uFEFF)?\s*<(?:\?xml|nfeProc\b|NFe\b|cteProc\b|CTe\b|CompNfse\b|NFSe\b|nfse\b)/i.test(original)) throw new Error('O provedor não retornou um XML disponível para leitura.');
      if (!controller.signal.aborted) setText(original);
    })().catch(error => { if (!controller.signal.aborted) onError(error); });
    return () => controller.abort();
  }, [url, onError]);
  return text === null ? <LoadingState label="XML original"/> : <pre className="invoice-original__xml" tabIndex={0} aria-label="XML original">{text}</pre>;
}

export function OriginalDocument({document, driveId, resolveFile}) {
  const [resource, setResource] = useState(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const source = document.url || document.webUrl || '';
  const originalUrl = previewDocumentUrl(source);
  const kind = documentPreviewType(document);
  const resolvedDrive = document.driveId || document.parentReference?.driveId || driveId;
  const resourceKey = JSON.stringify([source, document.id, resolvedDrive, attempt]);
  const name = document.legenda || document.nome || document.name || 'Documento original';
  const fail = useCallback(error => setFailure(documentReadError(error?.status)), []);

  useEffect(() => {
    let cancelled = false;
    setFailure(null);
    setResource(null);
    (async () => {
      let url = originalUrl;
      const protectedReference = protectedDocumentReference(source);
      if (protectedReference || (document.id && resolvedDrive && (!source || isMicrosoftDocumentUrl(source)))) {
        const response = await resolveFile(protectedReference || {driveId:resolvedDrive, itemId:document.id});
        if (!response?.ok) throw Object.assign(new Error('Não foi possível abrir o arquivo protegido.'),{status:response?.status});
        url = previewDocumentUrl(response.url);
      }
      if (!url) throw new Error('Link indisponível.');
      if (!cancelled) setResource({key:resourceKey, url});
    })().catch(error => { if (!cancelled) setFailure(documentReadError(error.status,'access')); });
    return () => { cancelled = true; };
  }, [source, originalUrl, document.id, resolvedDrive, resolveFile, resourceKey]);

  const url = resource?.key === resourceKey ? resource.url : null;
  const drivePreview=url?.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\//);
  return <>
    <div className="invoice-original__heading"><h3>Documento original</h3>{(url || originalUrl) && <FinancialDocumentLink href={url||originalUrl} reference={documentEvidenceInfo(document,driveId).reference} resolveFile={resolveFile}>Abrir original em nova aba</FinancialDocumentLink>}</div>
    <p className="invoice-original__name">{name}</p>
    {failure ? <Alert role="status" data-document-error={failure.code}><AlertDescription><p>{failure.message}</p><Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button></AlertDescription></Alert> : !url ? <p role="status">Preparando documento original…</p> : drivePreview ? <iframe title="Visualização do documento no Google Drive" className="invoice-original__frame" src={`https://drive.google.com/file/d/${drivePreview[1]}/preview`}/> : kind === 'pdf' ? <Suspense fallback={<LoadingState label="leitor de PDF"/>}><PdfDocumentPreview url={url} name={name} onError={fail}/></Suspense> : kind === 'image' ? <div className="invoice-original__surface"><img src={url} alt={name} referrerPolicy="no-referrer" onError={fail}/></div> : kind === 'xml' ? <XmlOriginal url={url} onError={fail}/> : <p role="status">Este formato não tem visualização interna. Abra o original em nova aba e mantenha a ficha aberta para conferir.</p>}
    <p className="invoice-original__hint">Confira o original junto aos dados do registro. Trocar o arquivo mantém os dados existentes.</p>
  </>;
}

export default function InvoiceConference({documents = [], driveId, resolveFile, children, emptyMessage}) {
  const [selected, setSelected] = useState(0);
  const current = documents[selected] || documents[0];
  const [panel, setPanel] = useState('fields');
  return <Tabs value={panel} onValueChange={setPanel} className="invoice-conference">
    <TabsList className="invoice-conference__tabs" aria-label="Conferência da nota fiscal"><TabsTrigger value="original">Documento</TabsTrigger><TabsTrigger value="fields">Dados da nota</TabsTrigger></TabsList>
    <TabsContent forceMount value="original" className="invoice-conference__original">
      {documents.length > 1 && <label className="invoice-original__select">Arquivo para conferência<SelectControl aria-label="Arquivo para conferência" value={documents[selected] ? selected : 0} onChange={event => setSelected(Number(event.target.value))}>{documents.map((document, index) => <option key={`${document.id || index}:${index}`} value={index}>{document.legenda || document.nome || document.name || `Documento ${index + 1}`}</option>)}</SelectControl></label>}
      {current ? <OriginalDocument key={`${current.id || selected}:${current.url || current.webUrl || ''}`} document={current} driveId={driveId} resolveFile={resolveFile}/> : <section aria-label="Documento original"><h3>Documento original</h3><p>{emptyMessage||'Nenhum documento anexado. Use “Anexar XML, PDF ou imagem da nota” nos dados da nota para incluir o original.'}</p></section>}
    </TabsContent>
    <TabsContent forceMount value="fields" className="invoice-conference__fields"><h3>Dados para conferência</h3>{children}</TabsContent>
  </Tabs>;
}
