import { Button } from "../../../design-system/primitives/Button.jsx";
import { TaskDisclosure } from "../../../design-system/patterns/TaskDisclosure.jsx";
import { useWorkflow } from "../../../features/workflow/WorkflowNavigation.jsx";
import { fmt } from "../../../legacy/format.js";
import { podeAcessarAba } from "../../administracao/abas-acesso.js";
import { clientMeasurementBankIds } from "../../financeiro/client-measurement-bank.js";
import { financialDateLabel } from "../../financeiro/dates.js";
import { active } from "../../financeiro/facts.js";
import { recebimentosDaMedicao } from "../../financeiro/ledger.js";
import "./client-billing.css";

export function ClientBillingTrace({ measurement, data, user, onEdit, children }) {
  const { navigate } = useWorkflow();
  const m = measurement;
  const details = m.billingDetails || {};
  const source = m.snapshotTecnico?.contrato;
  const technical = (data.medicoesObra || []).find(item => m.medicaoTecnicaId && item.id === m.medicaoTecnicaId && item.obraId === m.obraId);
  const contract = source?.source === "contrato_comercial"
    ? (data.comercial?.contratos || []).find(item => item.id === source.sourceId && item.obraId === m.obraId)
    : null;
  const receipts = m.recebimentos?.length ? m.recebimentos : recebimentosDaMedicao(m);
  const transactionIds = clientMeasurementBankIds(data,m);
  const canOpen = tab => navigate && podeAcessarAba(user, tab)
    && (!user?.obraId || user.obraId === m.obraId);
  const [year, month] = String(m.competencia || "").split("-").map(Number);
  return <TaskDisclosure summary="Origem, documento e recebimentos">
    <div className="client-billing-trace">
      <p><strong>Contrato</strong> · {source
        ? `${contract?.numero || (source.source === "obra" ? "Cadastro da obra" : source.sourceId)} · ${fmt(source.valueCents / 100)} na origem`
        : "Sem referência de contrato nesta parcela"}</p>
      <p><strong>Medição técnica</strong> · {technical
        ? `${technical.numero || technical.id} · ${financialDateLabel(technical.data)}`
        : m.medicaoTecnicaId || "Sem boletim vinculado"}</p>
      <p><strong>Documento emitido</strong> · {details.documento || "Referência não informada"}
        {details.emissao ? ` · Emissão em ${financialDateLabel(details.emissao)}` : ""}</p>
      <p><strong>Vencimento da parcela</strong> · {financialDateLabel(m.dataVencimento)}</p>
      <p><strong>Retenção informada</strong> · {details.retencao > 0 ? fmt(details.retencao) : "Sem valor informado"}</p>
      <p><strong>Recebimentos</strong>{receipts.length ? null : " · Nenhuma baixa registrada"}</p>
      {receipts.length > 0 && <ul>{receipts.map((item, index) => <li key={item.id || index}>
        {financialDateLabel(item.data)} · {fmt(item.valor)}
        {active(item) ? (item.transacaoId ? " · Banco" : " · Baixa registrada") : ` · Estornado${item.motivoEstorno ? ` · ${item.motivoEstorno}` : ""}`}
      </li>)}</ul>}
      <div className="client-billing-actions">
        {onEdit && <Button variant="outline" onClick={onEdit}>Editar dados da cobrança</Button>}
        {technical && canOpen("med") && <Button variant="ghost" onClick={()=>navigate("med",{obraId:m.obraId})}>Ver medições da obra</Button>}
        {year > 0 && month >= 1 && month <= 12 && canOpen("dre") && <Button variant="ghost" onClick={()=>navigate("dre",{obraId:m.obraId,year,month:month-1})}>Ver DRE por obra</Button>}
        {transactionIds.length > 0 && canOpen("conc") && <Button variant="ghost" onClick={()=>navigate("conc",{obraId:m.obraId},{
          action:"review-financial-origin",record:{obraId:m.obraId,transactionIds,label:m.numeroParcela || m.descricao || "Recebimentos da parcela"},
        })}>Ver na Conciliação</Button>}
      </div>
      {receipts.length > 0 && !transactionIds.length && <p>Sem movimento bancário vinculado.</p>}
      {children}
    </div>
  </TaskDisclosure>;
}
