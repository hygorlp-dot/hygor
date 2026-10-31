import { financialEntry } from "../../domains/financeiro/workspace.js";
import { financialDocumentUrl } from "../../domains/financeiro/document-links.js";

const sources = { nota: "nota_fiscal", notaFiscal: "nota_fiscal", pedido: "pedido", outrasDesp: "outra_despesa", despesaEmpresa: "despesa_empresa", medicao: "medicao", medicaoTerc: "medicao_terceiro", tituloFolha: "titulo_folha", caixaObra: "caixa_obra" };
export function reviewDocumentContext(data, transaction, selection) {
  const candidate = selection?.candidate;
  const event = selection?.event || (candidate ? { sourceType: sources[candidate.tipo], sourceId: candidate.entidadeId, sourceSubId: candidate.pagamentoId, description: candidate.titulo } : null);
  const entry = event ? financialEntry(data, event) : { record: transaction, documents: [], invoices: [], description: transaction.descricao };
  const record = entry.record;
  const payment = event?.sourceSubId ? [...(record?.pagamentos || []), ...(record?.recebimentos || [])].find(item => String(item.id) === String(event.sourceSubId)) : null;
  const documents = [];
  const seen = new Set();
  const add = items => (items || []).forEach(item => {
    if (!item || typeof item !== "object") return;
    const url = financialDocumentUrl(item.url || item.webUrl);
    const drive = item.driveId || item.parentReference?.driveId;
    if (!url && !(drive && item.id)) return;
    const key = drive && item.id ? `${drive}:${item.id}` : url;
    if (seen.has(key)) return;
    seen.add(key); documents.push({ ...item, ...(url ? { url } : {}) });
  });
  add(record?.documentos); add(record?.comprovantes); add(payment?.documentos); add(payment?.comprovantes); add(entry.documents);
  (entry.invoices || []).forEach(invoice => add(invoice.documentos));
  return { entry, documents, pedidoId: event?.sourceType === "pedido" ? record?.id : record?.pedidoId };
}
