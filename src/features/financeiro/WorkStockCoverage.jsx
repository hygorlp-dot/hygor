import FinancialColumnsHelp from './FinancialColumnsHelp.jsx';
import {tableColumnsKey} from '../../design-system/data/useTableColumns.js';
import {DataTable} from '../../design-system/data/DataTable.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {useState} from 'react';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {HelpButton} from '../help/HelpButton.jsx';

const qty=value=>Number.isFinite(value)?value.toLocaleString('pt-BR',{maximumFractionDigits:6}):'Não disponível';
const money=value=>value===null?'Não disponível':(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function CoverageHelp(){
 useHelpTopic('fin_etapas','fin_estoque');
 return <HelpButton pageId="fin_estoque" label="Ajuda da cobertura do estoque"/>;
}
export default function WorkStockCoverage({work,report,currentUser,config}){
 const [expanded,setExpanded]=useState(false);
 const columns=[
  {key:'descricao',header:'Material',render:row=><>{row.descricao} · {row.unidade}</>},
  {key:'stage',header:'Etapa'},
  ...[['quantidade','Demanda orçada'],['applied','Aplicado líquido'],['physical','Saldo físico'],['reserved','Reservado na etapa'],['free','Livre na etapa'],['openOrders','Pedidos a receber'],['toBuy','Falta comprar']].map(([key,header])=>({key,header,render:row=>qty(row[key])})),
  {key:'replacementCents',header:'Reposição estimada',render:row=>money(row.replacementCents)},
  {key:'origin',header:'Origem e conferência',render:row=><>{row.issues.length?row.issues.join(' '):'Vínculos compatíveis nesta consulta.'} <details><summary>Conferir origens</summary><p>Itens do orçamento: {row.itemOrcamentoIds.join(', ')}.</p><ul>{row.sources.map((source,index)=><li key={index}>{source.type} {source.id}{source.itemId?' · item '+source.itemId:''}{source.pedidoId?' · pedido '+source.pedidoId:''}: {qty(source.quantity)} {row.unidade}{source.tipo?' · '+source.tipo:''}</li>)}</ul></details></>},
 ].map(column=>({...column,hideable:!['descricao','stage','origin'].includes(column.key),sortable:false}));
 return <section aria-label={'Cobertura do estoque · '+work.name}><h4>Cobertura do estoque</h4>
  <p>Posição física atual da obra, independente da data de corte financeiro. Quantidades, unidades, materiais e etapas vêm do orçamento, de Compras e do Estoque; não precisam ser preenchidos novamente.</p>
  <Alert><AlertDescription>Falta comprar = demanda − aplicado líquido − saldo físico − pedidos a receber, limitado a zero. A reserva da mesma etapa já está no saldo físico. Reposição usa o preço médio orçado, como estimativa de compra; entrada, consumo e reserva não criam outro custo no DRE.</AlertDescription></Alert>
  <details onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Conferir cobertura dos materiais ({report.stock.rows.length})</summary>
   {expanded&&<CoverageHelp/>}
   <p>O piso de materiais compara reposição + compras independentes ainda não faturadas com o piso dos compromissos; não soma materiais novamente ao contrato. Uma entrada já faturada não aumenta o incorrido outra vez. Perdas aumentam a necessidade de reposição. Pendências exigem correção na origem ou revisão explícita do restante da etapa.</p>
   <DataTable columnsHelp={<FinancialColumnsHelp/>} columnPreferenceKey={tableColumnsKey(currentUser,config,'fin-stock')} data={report.stock.rows} columns={columns} search={{placeholder:'Pesquisar material ou etapa',fields:['descricao','stage']}} emptyMessage="Nenhum material vinculado à composição do orçamento de controle. A referência monetária permanece; esta consulta não comprova cobertura dos materiais."/>
  </details>
 </section>;
}
