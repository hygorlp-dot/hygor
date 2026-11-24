import FinancialColumnsHelp from './FinancialColumnsHelp.jsx';
import {useTableColumns,tableColumnsKey} from '../../design-system/data/useTableColumns.js';
import {DataTableColumnMenu} from '../../design-system/data/DataTableColumnMenu.jsx';
import {contar} from '../../design-system/copy.js';
import {WorkspaceCommandBar} from '../../design-system/patterns/WorkspaceCommandBar.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {UNALLOCATED_ORDER_PAYMENT} from '../../domains/financeiro/workspace.js';
import {RecordPanel} from '../workflow/RecordPanel.jsx';
import {useWorkspaceState,useQueuePosition} from '../workflow/workspace-session.jsx';
import {RecordAction} from '../../design-system/primitives/RecordAction.jsx';
import {WorkQueueBoard} from '../../design-system/patterns/WorkQueueBoard.jsx';
import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import './financial-overview.css';
const tableFields=[{key:'record',header:'Registro / obra',hideable:false},{key:'date',header:'Vencimento'},{key:'amount',header:'Saldo em aberto'},{key:'actions',header:'Próxima ação',hideable:false}];
const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function FinanceToday({queues,today,work,scope=work,scopeControl,onOpen,onAllocate,resolveAction,onAction,active:controlledActive,onActiveChange,preferences={},onPreferencesChange,user,config}){
  const columns=useTableColumns(tableFields,tableColumnsKey(user,config,'fin-today'));
  const [localActive,setLocalActive]=useState('all');
  const active=controlledActive??localActive;
  const setActive=onActiveChange??setLocalActive;
  const [localPreferences,setLocalPreferences]=useState({direction:'A pagar',layout:'table'});
  const prefs={...localPreferences,...preferences};
  const change=patch=>{if(patch.direction&&['payToday','receiveToday'].includes(active))setActive(patch.direction==='A pagar'?'payToday':'receiveToday');const next={...prefs,...patch};setLocalPreferences(next);onPreferencesChange?.(next);};
  const opposite=prefs.direction==='A pagar'?'receiveToday':'payToday';
  const scoped=queues.filter(q=>q.id!==opposite).map(q=>{const items=q.items.filter(item=>!item.direction||item.direction===prefs.direction);return {...q,label:['payToday','receiveToday'].includes(q.id)?'Hoje':q.label,items,amountCents:items.reduce((sum,item)=>sum+item.amountCents,0)};});
  const ordered=['overdue',prefs.direction==='A pagar'?'payToday':'receiveToday','nextWeek','later','undated'].map(id=>scoped.find(q=>q.id===id)).filter(Boolean);
  const allItems=ordered.flatMap(q=>q.items).sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  const visible=[{id:'all',label:'Todos os prazos',items:allItems,amountCents:allItems.reduce((sum,item)=>sum+item.amountCents,0)},...ordered];
  const queue=visible.find(q=>q.id===active)||visible[0];
  const overdue=visible.find(q=>q.id==='overdue');
  const queueRef=useQueuePosition("fin",scope);
  const [selection,setSelection]=useWorkspaceState('fin','quickRecord',null,scope);
  const selected=allItems.find(item=>String(item.id)===selection);
  const identity=item=><div><RecordAction aria-label={`Consultar ${item.description}`} onClick={()=>setSelection(String(item.id))}>{item.description}</RecordAction><p>{item.obra}{item.counterparty?` · ${item.counterparty}`:''}</p></div>;
  const late=item=>Boolean(item.dueDate&&item.dueDate<today);
  const date=item=><time dateTime={item.dueDate||undefined} data-late={late(item)||undefined}>{item.dueDate?item.dueDate.split('-').reverse().join('/'):'Sem vencimento'}{late(item)&&<span className="finance-today__late"> · vencido</span>}</time>;
  const actions=item=>{const action=onAction&&resolveAction?.(item);return <div className="finance-today__actions">{action?<><p>{action.reason}</p><Button variant="outline" onClick={()=>onAction(item)}>{action.label}</Button></>:<p>Consulta pelo nome do registro.</p>}</div>;};
  const renderItem=item=><div className="finance-today__row">{identity(item)}{date(item)}<strong>{money(item.amountCents)}</strong>{actions(item)}</div>;
  return <section ref={queueRef} className="finance-today mrc-command-workspace" aria-labelledby="finance-today-title">
    <WorkspaceCommandBar label="Comandos do Financeiro" scope={scopeControl}>
      <Select label="Movimentação" value={prefs.direction} onChange={event=>change({direction:event.target.value})} options={['A pagar','A receber'].map(value=>({value,label:value}))}/>
      <Select label="Visualização" value={prefs.layout} onChange={event=>change({layout:event.target.value})} options={[{value:'table',label:'Tabela'},{value:'kanban',label:'Kanban'}]}/>
    {prefs.layout==='table'&&<DataTableColumnMenu help={<FinancialColumnsHelp/>} columns={tableFields} visible={columns.visible} onChange={columns.toggle} onReset={columns.reset} sessionOnly={columns.sessionOnly}/>}
    <div className="finance-today__mobile"><Select label="Fila de vencimentos" value={queue.id} onChange={event=>setActive(event.target.value)}
      options={visible.map(q=>({value:q.id,label:`${q.label} (${q.items.length})`}))}/></div>
    </WorkspaceCommandBar>
    {overdue?.items.length>0&&!['all','overdue'].includes(queue.id)&&<div className="finance-today__attention" role="status"><p><strong>{contar(overdue.items.length,"título vencido","títulos vencidos")} · {money(overdue.amountCents)}</strong> para conferir neste recorte.</p><Button variant="outline" onClick={()=>setActive('overdue')}>Conferir vencidos</Button></div>}
    <div className="finance-today__filters" role="group" aria-label="Filtrar fila de hoje">{visible.map(q=><Button key={q.id} variant={active===q.id?'default':'outline'} aria-pressed={active===q.id} data-tone={q.id==='overdue'&&q.items.length?'danger':undefined} onClick={()=>setActive(q.id)}>
      <span>{q.label} · {q.items.length}</span><strong>{money(q.amountCents)}</strong>
    </Button>)}</div>
    <div className="finance-today__results"><h2 id="finance-today-title">{queue.label}</h2><strong className="finance-today__total">{money(queue.amountCents)}</strong><p>{contar(queue.items.length,"título","títulos")} · saldo em aberto, sem representar saldo de caixa. Posição em {today.split('-').reverse().join('/')} · {work}.</p></div>
    {prefs.layout==='kanban'?<>
      <p className="mrc-queue-note">Quadro por vencimento. Use a ação do registro para continuar.</p>
      <WorkQueueBoard label="Compromissos por vencimento" groups={ordered.filter(q=>queue.id==='all'||q.id===queue.id).map(q=>({...q,summary:money(q.amountCents)}))} itemKey={item=>String(item.id)} renderItem={renderItem}/>
    </>:<div className="finance-today__table-scroll" role="region" aria-label="Compromissos da tabela" tabIndex={0}><table className="arcd-data-table__table finance-today__table"><caption className="sr-only">{prefs.direction} · {queue.label} · {work}</caption><thead><tr>{tableFields.filter(c=>columns.visible.includes(c.key)).map(c=><th key={c.key} scope="col" data-align={c.key==='amount'?'end':undefined}>{c.header}</th>)}</tr></thead><tbody>{queue.items.map(item=><tr key={item.id} data-record={String(item.id)}>{columns.visible.includes('record')&&<td data-label="Registro / obra">{identity(item)}</td>}{columns.visible.includes('date')&&<td data-label="Vencimento">{date(item)}</td>}{columns.visible.includes('amount')&&<td data-label="Saldo em aberto" data-align="end"><strong>{money(item.amountCents)}</strong></td>}{columns.visible.includes('actions')&&<td data-label="Próxima ação">{actions(item)}</td>}</tr>)}</tbody></table></div>}
    {selection&&<RecordPanel key={`${scope}:${selection}`} recordKey={selection} title={selected?'Ficha financeira':'Título indisponível'} pageId="fin" onClose={()=>setSelection(null)}>
      {selected?<>
        <h4>{selected.description}</h4>
        <dl className="mrc-record-panel__facts">{[['Obra',selected.obra],['Cliente / fornecedor',selected.counterparty||'Não informado'],['Movimentação',selected.direction],['Vencimento',date(selected)],...(selected.metadata?.valorOriginal!=null?[['Valor original',money(Math.round(selected.metadata.valorOriginal*100))],['Liquidado',money(Math.round(selected.metadata.liquidado*100))]]:[]),['Saldo em aberto',money(selected.amountCents)],['Documento',selected.documentNumber||'Não informado']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {selected.metadata?.pagamentoPedidoNaoAlocado&&<Alert variant="warning" role="status"><AlertDescription>{UNALLOCATED_ORDER_PAYMENT}</AlertDescription></Alert>}
        {selected.metadata?.vencimentoInvalido&&<p role="status">O vencimento de origem é inválido. Confira a data no registro; este título está em Sem vencimento.</p>}
        {selected.metadata?.pagamentoPedidoNaoAlocado&&resolveAction?.(selected)?.kind==='invoice'&&onAllocate&&<Button onClick={()=>onAllocate(selected)}>Alocar adiantamento</Button>}
        <section><h4>Próxima ação</h4>{onAction&&resolveAction?.(selected)?actions(selected):<p>Não há ação operacional disponível para este título e perfil. Consulte o detalhamento para conferir a origem.</p>}</section>
        <div className="mrc-record-panel__actions"><Button variant="secondary" onClick={()=>onOpen({title:selected.description,items:[selected],context:`Posição em ${today} · ${selected.direction}`})}>Consultar detalhamento</Button><Button variant="secondary" onClick={()=>setSelection(null)}>Voltar à fila</Button></div>
      </>:<p role="status">O título saiu deste recorte ou não está mais disponível. Volte à fila para conferir os saldos atuais.</p>}
    </RecordPanel>}
    {prefs.layout!=='kanban'&&!queue.items.length&&<div className="finance-today__empty" role="status"><strong>Nenhum título em {queue.label.toLocaleLowerCase('pt-BR')} para esta obra.</strong><p>Consulte outra fila ou altere a obra selecionada.</p></div>}
  </section>;
}
