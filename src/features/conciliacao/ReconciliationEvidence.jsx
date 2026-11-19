import { extrairContraparteDescricaoPix } from "../../domains/conciliacao/calculations.js";
import {transactionPixKey,normalizePixKey} from '../../domains/conciliacao/pix-evidence.js';

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const digits = value => String(value || "").replace(/\D/g, "");
const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join("/") : value;

// Evidências visuais não alteram a decisão do motor nem autorizam uma baixa.
export default function ReconciliationEvidence({ transaction, candidate, identities, data, fmt }) {
  const matches = identities.filter(person => [person.nome, person.razaoSocial, person.nomeFantasia, ...person.aliases].some(name => name && normalize(name) === normalize(candidate.contraparte)));
  const person = matches.length === 1 ? matches[0] : null;
  const bankName = transaction.contraparteNome || transaction.nomeContraparte || extrairContraparteDescricaoPix(transaction.descricao);
  const bankDocument = transaction.contraparteDocumento || transaction.cpfCnpj;
  const bankPix = transactionPixKey(transaction);
  const appDocument = candidate.documento || person?.documentos.join(" · ");
  const documents = candidate.documento ? [digits(candidate.documento)] : person?.documentos;
  const reference = candidate.tipo === "nota" ? (data.notasFiscais || []).find(item => item.id === candidate.entidadeId)?.numero
    : candidate.tipo === "pedido" ? (data.pedidos || []).find(item => item.id === candidate.entidadeId)?.numero : "";
  const workName = id => (data.obras || []).find(work => String(work.id) === String(id))?.name || (id ? "Obra não encontrada" : "");
  const rows = [
    { label: "Valor", bank: fmt(Math.abs(Number(transaction.valor))), app: fmt(Number(candidate.saldoCentavos || 0) / 100), same: Math.round(Math.abs(Number(transaction.valor)) * 100) === Number(candidate.saldoCentavos || 0) },
    { label: "Data / vencimento", bank: dateLabel(transaction.data), app: dateLabel(candidate.dataPrevista) },
    { label: "Favorecido / pagador", bank: bankName, app: candidate.contraparte },
    { label: "CPF/CNPJ", bank: bankDocument, app: appDocument, same: bankDocument && documents?.length ? documents.includes(digits(bankDocument)) : undefined },
    { label: "Chave PIX", bank: bankPix, app: person?.pix.join(" · "), same: bankPix && person?.pix.length ? person.pix.some(key => normalizePixKey(key) === normalizePixKey(bankPix)) : undefined },
    { label: "Obra", bank: workName(transaction.obraId), app: workName(candidate.obraId) },
    { label: "Nota / pedido", bank: transaction.documentoReferencia || transaction.numeroDocumento, app: reference },
  ];
  return <><div className="reconciliation-evidence" role="table" aria-label={`Evidências de ${candidate.titulo}`}>
    <div role="row" className="reconciliation-evidence__header"><span role="columnheader">Evidência</span><span role="columnheader">Banco</span><span role="columnheader">ERP</span><span role="columnheader">Conferência</span></div>
    {rows.map(row => {
      const available = Boolean(row.bank && row.app);
      const same = row.same ?? (available && normalize(row.bank) === normalize(row.app));
      const state = !available ? "missing" : same ? "match" : "different";
      return <div role="row" key={row.label} data-evidence={state}>
        <strong role="rowheader">{row.label}</strong><span role="cell" data-label="Banco">{row.bank || "Não informado"}</span><span role="cell" data-label="ERP">{row.app || "Não informado"}</span><span role="cell" className="reconciliation-evidence__state">{!available ? "Sem dados para comparar" : same ? "Coincide" : "Divergente · conferir"}</span>
      </div>;
    })}
  </div>{!bankPix&&<p>Chave PIX não informada no extrato. O identificador da linha evita duplicidades; ele não comprova a chave PIX do recebedor.</p>}</>;
}
