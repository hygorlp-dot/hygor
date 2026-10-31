import { extrairContraparteDescricaoPix } from "../../domains/conciliacao/calculations.js";

const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const digits = value => String(value || "").replace(/\D/g, "");

// Evidências visuais não alteram a decisão do motor nem autorizam uma baixa.
export default function ReconciliationEvidence({ transaction, candidate, identities, data, fmt }) {
  const matches = identities.filter(person => [person.nome, person.razaoSocial, person.nomeFantasia, ...person.aliases].some(name => name && normalize(name) === normalize(candidate.contraparte)));
  const person = matches.length === 1 ? matches[0] : null;
  const bankName = transaction.contraparteNome || transaction.nomeContraparte || extrairContraparteDescricaoPix(transaction.descricao);
  const bankDocument = transaction.contraparteDocumento || transaction.cpfCnpj;
  const bankPix = transaction.chavePix || transaction.pixKey || transaction.chave;
  const workName = id => (data.obras || []).find(work => String(work.id) === String(id))?.name || (id ? "Obra não encontrada" : "");
  const rows = [
    { label: "Valor", bank: fmt(Math.abs(Number(transaction.valor))), app: fmt(Number(candidate.saldoCentavos || 0) / 100), same: Math.round(Math.abs(Number(transaction.valor)) * 100) === Number(candidate.saldoCentavos || 0) },
    { label: "Data / vencimento", bank: transaction.data, app: candidate.dataPrevista },
    { label: "Favorecido / pagador", bank: bankName, app: candidate.contraparte },
    { label: "CPF/CNPJ", bank: bankDocument, app: person?.documentos.join(" · "), same: bankDocument && person?.documentos.length ? person.documentos.includes(digits(bankDocument)) : undefined },
    { label: "Chave PIX", bank: bankPix, app: person?.pix.join(" · "), same: bankPix && person?.pix.length ? person.pix.some(key => normalize(key).replace(/\s+/g, "") === normalize(bankPix).replace(/\s+/g, "")) : undefined },
    { label: "Obra", bank: workName(transaction.obraId), app: workName(candidate.obraId) },
    { label: "Documento", bank: transaction.documentoReferencia || transaction.numeroDocumento, app: candidate.documento },
  ];
  return <div className="reconciliation-evidence" role="table" aria-label={`Evidências de ${candidate.titulo}`}>
    <div role="row" className="reconciliation-evidence__header"><span role="columnheader">Evidência</span><span role="columnheader">Banco</span><span role="columnheader">ERP</span><span role="columnheader">Conferência</span></div>
    {rows.map(row => {
      const available = Boolean(row.bank && row.app);
      const same = row.same ?? (available && normalize(row.bank) === normalize(row.app));
      const state = !available ? "missing" : same ? "match" : "different";
      return <div role="row" key={row.label} data-evidence={state}>
        <strong role="rowheader">{row.label}</strong><span role="cell" data-label="Banco">{row.bank || "Não informado"}</span><span role="cell" data-label="ERP">{row.app || "Não informado"}</span><span role="cell" className="reconciliation-evidence__state">{!available ? "Sem dados para comparar" : same ? "Coincide" : "Divergente · conferir"}</span>
      </div>;
    })}
  </div>;
}
