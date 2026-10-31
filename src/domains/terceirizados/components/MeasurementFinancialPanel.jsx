import { Badge, C } from "../../../LegacyApp";
import FinancialDocumentLink from "../../../features/financeiro/FinancialDocumentLink.jsx";
import { financialDocumentUrl } from "../../financeiro/document-links.js";
import { Alert, AlertDescription } from "../../../components/ui/alert.jsx";
import "./measurement-workspace.css";

const money = value => (Number(value || 0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || "")) ? String(value).slice(0,10).split("-").reverse().join("/") : "Não informada";
const toneColor = tone => ({success:C.green,warning:C.orange,danger:C.red,muted:C.muted})[tone] || C.muted;

export function MeasurementStatusBadges({model}) {
  if (!model) return null;
  return <dl className="third-measurement-statuses" aria-label="Situações da medição e do financeiro">
    <div><dt>Medição</dt><dd><Badge color={toneColor(model.approval.tone)}>{model.approval.label}</Badge></dd></div>
    <div><dt>Financeiro</dt><dd><Badge color={toneColor(model.financial.tone)}>{model.financial.label}</Badge></dd></div>
  </dl>;
}

export function MeasurementFinancialPanel({model}) {
  if (!model) return null;
  const {measurement,invoice,payments,preview} = model;
  return <details className="third-measurement-finance" aria-label={`Financeiro da medição ${measurement.numero || measurement.id}`}>
    <summary><strong>Financeiro vinculado</strong><span>Saldo: {money(model.balanceCents)}</span></summary>
    <div className="third-measurement-finance__body">
      <p>Valores da obrigação e das baixas já registradas no financeiro.</p>
      <dl className="third-measurement-values">
        <div><dt>Valor medido · bruto</dt><dd>{money(Number(measurement.total || 0)*100)}</dd></div>
        <div><dt>Obrigação reconhecida</dt><dd>{money(model.recognizedCents)}</dd></div>
        <div><dt>Baixado · valor bruto</dt><dd>{money(model.settledCents)}</dd></div>
        <div><dt>Saldo em aberto</dt><dd>{money(model.balanceCents)}</dd></div>
        <div><dt>Competência</dt><dd>{model.competence ? model.competence.split("-").reverse().join("/") : "Não informada"}</dd></div>
        <div><dt>Vencimento</dt><dd>{date(model.dueDate)}</dd></div>
      </dl>
      {model.financial.label==="Não liberada" && <p>A medição não gera obrigação enquanto estiver pendente, em correção ou cancelada.</p>}
      {!!model.overpaidCents && <Alert variant="warning"><AlertDescription>As baixas superam a obrigação em {money(model.overpaidCents)}. Confira os vínculos no financeiro.</AlertDescription></Alert>}
      <p><strong>Conciliação:</strong> {model.reconciliation}</p>
      {invoice ? <details className="third-measurement-document">
        <summary>Ver nota fiscal vinculada · {invoice.numero || "Sem número"}</summary>
        <dl className="third-measurement-values">
          <div><dt>Fornecedor</dt><dd>{invoice.fornecedorNome || "Não informado"}</dd></div>
          <div><dt>Situação da nota</dt><dd>{invoice.status || "Não informada"}</dd></div>
          <div><dt>Emissão</dt><dd>{date(invoice.emissao)}</dd></div>
          <div><dt>Valor bruto da nota</dt><dd>{money(Number(invoice.valorBruto || 0)*100)}</dd></div>
        </dl>
        {(invoice.documentos || []).map((document,index)=>{
          const url=financialDocumentUrl(document.url || document.webUrl);
          return url ? <p key={document.id || index}><FinancialDocumentLink href={url}>{document.legenda || document.nome || "Documento original"} · Abrir</FinancialDocumentLink></p> : null;
        })}
        {!invoice.documentos?.length && <p>A nota está vinculada, mas não possui arquivo anexado.</p>}
      </details> : <p>{model.missingInvoice ? "A nota referenciada não está disponível nesta obra. Confira o vínculo." : "Sem nota fiscal vinculada."}</p>}
      {preview && <div className="third-measurement-finance__preview">
        <p>Prévia de liquidação pelas condições atuais do contrato</p>
        <dl className="third-measurement-values">
          <div><dt>ISS a reter</dt><dd>{money(preview.issCents)}</dd></div>
          <div><dt>INSS a reter</dt><dd>{money(preview.inssCents)}</dd></div>
          <div><dt>Líquido previsto</dt><dd>{money(preview.netCents)}</dd></div>
        </dl>
        <p>Simulação; não registra pagamento.</p>
      </div>}
      {!!payments.length && <div className="third-measurement-finance__payments">
        <h4>Baixas vinculadas</h4>
        {payments.map(payment=><div key={payment.id}>
          <p><strong>{date(payment.date)} · {money(payment.amountCents)}</strong></p>
          <p>{payment.reconciled ? "Conciliada" : "Pendente de conciliação"}{payment.payer ? ` · ${payment.payer==="empresa" ? "Pago pela empresa" : payment.payer==="obra" ? "Pago pela obra" : payment.payer}` : ""}</p>
          {payment.netCents!=null && <p>Líquido registrado: {money(payment.netCents)} · ISS: {payment.issCents==null ? "Não informado" : money(payment.issCents)} · INSS: {payment.inssCents==null ? "Não informado" : money(payment.inssCents)}</p>}
        </div>)}
      </div>}
      <p>A baixa liquida a obrigação existente. A nota vinculada não cria um segundo custo.</p>
    </div>
  </details>;
}
