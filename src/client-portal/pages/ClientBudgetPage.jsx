import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {DataTable} from "../../design-system/data/DataTable.jsx";
import {EmptyState} from "../../design-system/patterns/FeedbackState.jsx";
import {portalMoney,portalDate} from "../format.js";
export function ClientBudgetPage({data}){
  const summary=data.stageBudgets?.[0];
  return <section className="arcd-client-page"><PageHeader headingLevel={2} title="Previsto e realizado por etapa" description="Compare o orçamento de controle aprovado com o custo reconhecido na mesma etapa."/>{!summary?<EmptyState title="Orçamento por etapa ainda não liberado" description="Solicite a liberação à equipe responsável pela obra."/>:!summary.available?<EmptyState title="Custos em conferência" description="A equipe precisa conferir a base financeira antes de apresentar o realizado completo."/>:<>
    <p>Atualizado em {portalDate(summary.asOf)}. {summary.hasBudget?`Orçamento de controle: ${summary.budgetName||"versão aprovada"}.`:"Ainda não há uma única versão aprovada do orçamento de controle. O previsto permanece indisponível."}</p>
    <DataTable data={summary.rows} columns={[
      {key:"name",header:"Etapa",render:row=>row.id==="unassigned"?"Etapa ainda não informada":row.name},
      {key:"budget",header:"Previsto",render:row=>portalMoney(row.budget)},
      {key:"recognized",header:"Realizado (custo)",render:row=>portalMoney(row.recognized)},
      {key:"paid",header:"Pago",render:row=>portalMoney(row.paid)},
      {key:"difference",header:"Previsto menos realizado",render:row=>portalMoney(row.budget===null||row.recognized===null?null:row.budget-row.recognized)},
    ].map(column=>({...column,hideable:false}))}/>
    <p className="arcd-client-muted">Etapa ainda não informada reúne gastos que a equipe precisa vincular à etapa correta. Esses valores continuam no total da obra. Realizado é o custo já registrado; Pago é o dinheiro já desembolsado. Previsto, realizado e pago não devem ser somados.</p>
  </>}</section>;
}
