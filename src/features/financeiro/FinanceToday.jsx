import {WorkQueueBoard} from '../../design-system/patterns/WorkQueueBoard.jsx';
import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import './financial-overview.css';
const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function FinanceToday({queues,today,work,onOpen,resolveAction,onAction,active:controlledActive,onActiveChange,preferences={},onPreferencesChange}){
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
  const identity=item=><div><strong>{item.description}</strong><p>{item.obra}{item.counterparty?` · ${item.counterparty}`:''}</p></div>;
  const date=item=><time dateTime={item.dueDate||undefined}>{item.dueDate?item.dueDate.split('-').reverse().join('/'):'Sem vencimento'}</time>;
  const actions=item=>{const action=onAction&&resolveAction?.(item);return <div className="finance-today__actions">{action&&<><p>{action.reason}</p><Button onClick={()=>onAction(item)}>{action.label}</Button></>}<Button variant={action?'link':'outline'} onClick={()=>onOpen({title:item.description,items:[item],context:`Posição em ${today} · ${item.direction}`})}>Ver memorial</Button></div>;};
  const renderItem=item=><div className="finance-today__row">{identity(item)}{date(item)}<strong>{money(item.amountCents)}</strong>{actions(item)}</div>;
  return <section className="finance-today" aria-labelledby="finance-today-title">
    <div className="finance-today__heading"><h2 id="finance-today-title">Hoje</h2><p>Posição em {today.split('-').reverse().join('/')} · {work} · por vencimento.</p></div>
    <div className="mrc-queue-controls">
      <Select label="Movimentação" value={prefs.direction} onChange={event=>change({direction:event.target.value})} options={['A pagar','A receber'].map(value=>({value,label:value}))}/>
      <Select label="Visualização" value={prefs.layout} onChange={event=>change({layout:event.target.value})} options={[{value:'table',label:'Tabela'},{value:'kanban',label:'Kanban'}]}/>
    </div>
    {overdue?.items.length>0&&!['all','overdue'].includes(queue.id)&&<div className="finance-today__attention" role="status"><p><strong>{overdue.items.length} título(s) vencido(s) · {money(overdue.amountCents)}</strong> para conferir neste recorte.</p><Button variant="outline" onClick={()=>setActive('overdue')}>Conferir vencidos</Button></div>}
    <div className="finance-today__mobile"><Select label="Fila de vencimentos" value={queue.id} onChange={event=>setActive(event.target.value)}
      options={visible.map(q=>({value:q.id,label:`${q.label} (${q.items.length})`}))}/></div>
    <div className="finance-today__filters" role="group" aria-label="Filtrar fila de hoje">{visible.map(q=><Button key={q.id} variant={active===q.id?'default':'outline'} aria-pressed={active===q.id} onClick={()=>setActive(q.id)}>
      <span>{q.label} · {q.items.length}</span><strong>{money(q.amountCents)}</strong>
    </Button>)}</div>
    <div className="finance-today__results"><h3>{queue.label}</h3><strong className="finance-today__total">{money(queue.amountCents)}</strong><p>{queue.items.length} título(s) · saldo em aberto, sem representar saldo de caixa.</p></div>
    {prefs.layout==='kanban'?<>
      <p className="mrc-queue-note">Quadro por vencimento. Use a ação do registro para continuar.</p>
      <WorkQueueBoard label="Compromissos por vencimento" groups={ordered.filter(q=>queue.id==='all'||q.id===queue.id).map(q=>({...q,summary:money(q.amountCents)}))} itemKey={item=>String(item.id)} renderItem={renderItem}/>
    </>:<div className="finance-today__table-scroll" role="region" aria-label="Compromissos da tabela" tabIndex={0}><table className="finance-today__table"><caption className="sr-only">{prefs.direction} · {queue.label} · {work}</caption><thead><tr><th scope="col">Registro / obra</th><th scope="col">Vencimento</th><th scope="col">Saldo em aberto</th><th scope="col">Próxima ação</th></tr></thead><tbody>{queue.items.map(item=><tr key={item.id} data-record={String(item.id)}><td data-label="Registro / obra">{identity(item)}</td><td data-label="Vencimento">{date(item)}</td><td data-label="Saldo em aberto"><strong>{money(item.amountCents)}</strong></td><td data-label="Próxima ação">{actions(item)}</td></tr>)}</tbody></table></div>}
    {prefs.layout!=='kanban'&&!queue.items.length&&<div className="finance-today__empty" role="status"><strong>Nenhum título em {queue.label.toLocaleLowerCase('pt-BR')} para esta obra.</strong><p>Consulte outra fila ou altere a obra selecionada.</p></div>}
  </section>;
}
