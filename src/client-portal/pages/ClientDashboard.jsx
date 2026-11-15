import {PageHeader} from "../../design-system/patterns/PageHeader.jsx";
import {portalDate,portalMoney,portalPercent} from "../format.js";
import {ClientContractSummary} from "../components/ClientContractSummary.jsx";
import {Button} from "../../design-system/primitives/Button.jsx";
import "../styles/portal.css";
export function ClientDashboard({data,permissions={},onNavigate}){
 const project=data.project||{},progress=project.progress==null?null:Math.max(0,Math.min(100,Number(project.progress)||0));
 return <section className="arcd-client-dashboard"><PageHeader headingLevel={2} title="Acompanhamento da obra" description="Veja a evolução da obra e acompanhe os registros da equipe."/>
 <section className="arcd-client-progress"><h3>Avanço físico</h3><strong>{progress===null?"Avanço ainda não informado":portalPercent(progress)}</strong>{progress!==null&&<div role="progressbar" aria-label="Avanço físico da obra" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${progress}%`}}/></div>}{project.progressSource?.startsWith("cronograma")&&<p>Estimativa pelo cronograma; ainda sem medição confirmada.</p>}<p>{project.currentPhase||"Fase ainda não informada"}</p><p>Previsão de término: {portalDate(project.estimatedCompletion,"A confirmar")}</p><p>Dados atualizados em {portalDate(project.lastUpdate)}</p>
 {(permissions.viewMedia||permissions.viewWeeklyUpdates)&&<div className="arcd-client-actions"><Button variant="secondary" onClick={()=>onNavigate?.("photos")}>Ver diário e fotos</Button></div>}</section>
 {data.weeklyUpdates?.[0]&&<section className="arcd-client-weekly"><h3>Última atualização da equipe</h3><p>{data.weeklyUpdates[0].summary}</p></section>}
 {permissions.viewFinancial&&<ClientContractSummary position={data.contractPositions?.[0]} onViewContract={()=>onNavigate?.("financial")}/>}
 {permissions.viewCosts&&data.costSummaries?.[0]?.available&&<section className="arcd-client-financial-grid" aria-label="Custos até a consulta"><article><span>Mão de obra até {portalDate(data.costSummaries[0].asOf)}</span><strong>{portalMoney(data.costSummaries[0].laborToDate)}</strong><small>Benefícios: {portalMoney(data.costSummaries[0].laborBenefitsToDate)} · mão de obra própria registrada até esta data.</small></article><article><span>Custo registrado da obra</span><strong>{portalMoney(data.costSummaries[0].recognized)}</strong><small>Gastos já reconhecidos na obra; o valor pago pode ser diferente. Detalhes em Gastos por categoria.</small></article></section>}
 </section>;
}
