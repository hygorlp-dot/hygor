import { lazy, Suspense, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { obterLinkArquivoOneDrive } from "../../api.js";
import { OriginalDocument } from "../financeiro/InvoiceConference.jsx";
import { reviewDocumentContext } from "./review-documents.js";

const PurchaseDossier = lazy(() => import("../../domains/compras/components/PurchaseDossier.jsx").then(module => ({ default: module.PurchaseDossier })));
export default function ReconciliationDocuments({ data, transaction, selection, onClose }) {
  const context = useMemo(() => reviewDocumentContext(data, transaction, selection), [data, transaction, selection]);
  const [selected, setSelected] = useState(null);
  const [purchase, setPurchase] = useState(false);
  const document = context.documents[selected];
  return <section className="reconciliation-documents" aria-label="Documentos da revisão">
    <header><h3>Documentos · {context.entry.description}</h3><Button size="sm" variant="ghost" onClick={onClose}>Fechar documentos</Button></header>
    <p>A consulta mantém o movimento selecionado e não altera o lançamento.</p>
    <div className="reconciliation-filter-chips">{context.documents.map((item,index) => <Button key={index} size="sm" variant="outline" aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.legenda || item.nome || item.name || `Documento ${index + 1}`}</Button>)}</div>
    {!context.documents.length && <p>Nenhum documento disponível neste registro. Consulte ou anexe o original no módulo de origem.</p>}
    {document && <OriginalDocument key={`${selected}:${document.id || document.url}`} document={document} resolveFile={obterLinkArquivoOneDrive}/>}
    {context.pedidoId && <Button variant="outline" onClick={() => setPurchase(value => !value)}>{purchase ? "Recolher ficha da compra" : "Ver ficha da compra nesta revisão"}</Button>}
    {purchase && <Suspense fallback={<p role="status">Carregando ficha da compra…</p>}><PurchaseDossier inline data={data} selection={{ pedidoId: context.pedidoId }} onClose={() => setPurchase(false)}/></Suspense>}
  </section>;
}
