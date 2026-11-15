import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {DataTable} from "../../design-system/data/DataTable.jsx";
import {EmptyState} from "../../design-system/patterns/FeedbackState.jsx";
import {portalMoney,portalDate,portalCategory} from "../format.js";
export function ClientCostsPage({data}){
  const summary=data.costSummaries?.[0];
  return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Gastos por categoria" description="Custo reconhecido e pagamentos da obra são apresentados separadamente."/>{!summary?<EmptyState title="Gastos ainda não liberados" description="A equipe responsável precisa liberar esta consulta para sua obra."/>:!summary.available?<EmptyState title="Custos em conferência" description="A base financeira precisa de conferência antes de apresentar o custo completo da obra."/>:<>
    <p>Consulta atualizada em {portalDate(summary.asOf)}. Os custos seguem a competência registrada até o mês desta consulta; pagamentos seguem a data em que ocorreram.</p>
    <div className="arcd-client-financial-grid"><article><span>Mão de obra até {portalDate(summary.asOf)}</span><strong>{portalMoney(summary.laborToDate)}</strong><small>Benefícios da equipe: {portalMoney(summary.laborBenefitsToDate)}</small></article><article><span>Custo reconhecido</span><strong>{portalMoney(summary.recognized)}</strong></article><article><span>Pagamentos registrados</span><strong>{portalMoney(summary.paid)}</strong></article></div>
    <DataTable data={summary.categories} rowKey="category" columns={[{key:"category",header:"Categoria",render:row=>portalCategory(row.category)},{key:"recognized",header:"Custo reconhecido",render:row=>portalMoney(row.recognized)},{key:"paid",header:"Pagamentos registrados",render:row=>portalMoney(row.paid)}].map(column=>({...column,hideable:false}))}/>
    <p className="arcd-client-muted">Pedido de compra representa compromisso. Recebimento de material representa estoque. O pagamento baixa uma obrigação; ele não cria outro custo. Valores de mão de obra são apresentados somente pelo total da categoria.</p>
  </>}</section>;
}
