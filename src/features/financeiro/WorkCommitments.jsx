import FinancialColumnsHelp from './FinancialColumnsHelp.jsx';
import {tableColumnsKey} from '../../design-system/data/useTableColumns.js';
import {useMemo,useState} from 'react';
import {RecordAction} from '../../design-system/primitives/RecordAction.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {DataTable} from '../../design-system/data/DataTable.jsx';
import {contar} from '../../design-system/copy.js';
import {workCommitments} from '../../domains/financeiro/work-commitments.js';
import {Button} from '../../components/ui/button.jsx';
import ServiceLinkEditor from './ServiceLinkEditor.jsx';
import TechnicalRetentions from './TechnicalRetentions.jsx';

const money=value=>value==null?'Não disponível':(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function WorkCommitments({data,ledger,work,onOpen,stageReport,dispatchCommand,currentUser}){
 const report=useMemo(()=>workCommitments(data,ledger,work.id),[data,ledger,work.id]);
 const [selected,setSelected]=useState(null);
 if(!report)return null;
 const openPurchases=()=>onOpen({title:`${work.name} · Compras ainda não faturadas`,context:'Posição atual dos cadastros carregados, independente do corte dos custos. O saldo desconta as notas reconhecidas pelo razão; pagamento não equivale a faturamento.',items:report.purchases,totalCents:report.purchaseCents});
 const columns=[{key:'name',header:'Contrato',render:row=><RecordAction disabled={row.remainingCents===null} onClick={()=>onOpen({title:`${work.name} · ${row.name}`,context:'Consulta do saldo contratual atual. Não é uma obrigação a pagar nem uma previsão adicional de custo.',items:[row.entry],totalCents:row.remainingCents})} aria-label={`Conferir contrato ${row.name}`}>{row.name}</RecordAction>},
  ...[['contractCents','Contratado'],['approvedCents','Medições aprovadas'],['pendingCents','Em revisão'],['balanceCents','A pagar das medições'],['remainingCents','Saldo a medir']].map(([key,header])=>({key,header,render:row=>money(row[key])})),
  {key:'issues',header:'Conferência',render:row=>row.issues.length?row.issues.join(' '):'Sem divergências identificadas nesta consulta'},
  {key:'forecast',header:'Integração à previsão',render:row=>{
   const group=stageReport?.services.groups.find(g=>String(g.contractId)===row.id),issue=stageReport?.services.issues.find(g=>String(g.contractId)===row.id);
   return <><p>{group?`${stageReport.budget.etapas.find(s=>s.id===group.stageId)?.nome} · ${money(group.remainingCents)} a incorrer`:issue?.reason||'Vínculo pendente'} {group?.notices.join(' ')}</p>
    {dispatchCommand&&['admin','financeiro'].includes(currentUser?.role)&&<Button variant="outline" onClick={()=>setSelected((data.terceirizados||[]).find(c=>String(c.id)===row.id))} aria-label={`Vincular previsão de ${row.name}`}>Vincular à previsão</Button>}</>;
  }}].map(column=>({...column,hideable:!['name','issues','forecast'].includes(column.key),sortable:false}));
 return <section aria-label={`Compromissos por origem · ${work.name}`}>
  <h4>Compromissos por origem</h4>
  <p>Posição atual dos cadastros carregados, independente da data de corte dos custos. Confira os saldos antes de revisar o restante da obra.</p>
  <p>Compras ainda não faturadas: <RecordAction onClick={openPurchases}>{money(report.purchaseCents)}</RecordAction> · {contar(report.purchases.length,'pedido com saldo','pedidos com saldo')}.</p>
  <p>Contratos de terceiros ainda a medir: <strong>{money(report.serviceCents)}</strong>{report.incompleteCount>0?' · subtotal dos contratos com valor disponível':''} · {contar(report.services.length,'contrato por medição ativo','contratos por medição ativos')}.</p>
  <Alert><AlertDescription>Somente vínculos conferidos entram na referência automática por etapa. Pedidos do mesmo escopo são considerados uma vez junto ao contrato. Revisões manuais substituem a referência, sem outra soma de compromissos. Estoque e contratos comerciais com clientes não são novos compromissos de custo nesta consulta.</AlertDescription></Alert>
  {report.reviewCount>0&&<p role="status">{contar(report.reviewCount,'contrato exige conferência','contratos exigem conferência')}. Valores ausentes não foram estimados.</p>}
  <details><summary>Conferir contratos de terceiros ({report.services.length})</summary>
   <p>Saldo a medir desconta somente medições aprovadas. A pagar considera as baixas do razão, inclusive as vinculadas a notas; pagamentos espelhados não contam duas vezes. Em revisão não representa custo aprovado.</p>
   <DataTable columnsHelp={<FinancialColumnsHelp/>} columnPreferenceKey={tableColumnsKey(currentUser,data.config,'fin-commitments')} data={report.services} columns={columns} search={{placeholder:'Pesquisar contrato',fields:['name']}} emptyMessage="Nenhum contrato por medição ativo nesta obra. Confira o cadastro em Terceiros."/>
  </details>
  <TechnicalRetentions data={data} obraId={work.id} user={currentUser} dispatchCommand={dispatchCommand}/>
  {selected&&<ServiceLinkEditor key={selected.id} data={data} ledger={ledger} work={work} budget={stageReport?.budget} contract={selected} user={currentUser} dispatchCommand={dispatchCommand} onClose={()=>setSelected(null)}/>}
 </section>;
}
