import { Suspense, useMemo, useState } from "react";
import { lazyWithCssRetry as lazy } from "../../lib/lazy-with-css-retry.js";
import { Button } from "../../components/ui/button";
import DocumentEvidence from "../financeiro/DocumentEvidence.jsx";
import { reviewDocumentContext } from "./review-documents.js";

const PurchaseDossier = lazy(() => import("../../domains/compras/components/PurchaseDossier.jsx").then(module => ({ default: module.PurchaseDossier })));
export default function ReconciliationDocuments({ data, transaction, selection, onClose }) {
  const context = useMemo(() => reviewDocumentContext(data, transaction, selection), [data, transaction, selection]);
  const [purchase, setPurchase] = useState(false);
  return <section className="reconciliation-documents" aria-label="Documentos da revisão">
    <header><h3>Documentos · {context.entry.description}</h3><Button size="sm" variant="ghost" onClick={onClose}>Fechar documentos</Button></header>
    <p>A consulta mantém o movimento selecionado e não altera o lançamento.</p>
    <DocumentEvidence documents={[...context.documents,...context.unavailableDocuments]} origin={context.entry.description}/>
    {context.pedidoId && <Button variant="outline" onClick={() => setPurchase(value => !value)}>{purchase ? "Recolher ficha da compra" : "Ver ficha da compra nesta revisão"}</Button>}
    {purchase && <Suspense fallback={<p role="status">Carregando ficha da compra…</p>}><PurchaseDossier inline data={data} selection={{ pedidoId: context.pedidoId }} onClose={() => setPurchase(false)}/></Suspense>}
  </section>;
}
