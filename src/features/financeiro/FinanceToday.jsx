import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import './financial-overview.css';
const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function FinanceToday({queues,today,work,onOpen,active:controlledActive,onActiveChange}){
  const [localActive,setLocalActive]=useState('payToday');
  const active=controlledActive??localActive;
  const setActive=onActiveChange??setLocalActive;
  const queue=queues.find(q=>q.id===active)||queues[0];
  const overdue=queues.find(q=>q.id==='overdue');
  return <section className="finance-today" aria-labelledby="finance-today-title">
    <div className="finance-today__heading"><h2 id="finance-today-title">Hoje</h2><p>Posição em {today.split('-').reverse().join('/')} · {work} · por vencimento.</p></div>
    {overdue?.items.length>0&&queue.id!=='overdue'&&<div className="finance-today__attention" role="status"><p><strong>{overdue.items.length} título(s) vencido(s) · {money(overdue.amountCents)}</strong> para conferir neste recorte.</p><Button variant="outline" onClick={()=>setActive('overdue')}>Conferir vencidos</Button></div>}
    <div className="finance-today__mobile"><Select label="Fila de vencimentos" value={queue.id} onChange={event=>setActive(event.target.value)}
      options={queues.map(q=>({value:q.id,label:`${q.label} (${q.items.length})`}))}/></div>
    <div className="finance-today__filters" role="group" aria-label="Filtrar fila de hoje">{queues.map(q=><Button key={q.id} variant={active===q.id?'default':'outline'} aria-pressed={active===q.id} onClick={()=>setActive(q.id)}>
      <span>{q.label} · {q.items.length}</span><strong>{money(q.amountCents)}</strong>
    </Button>)}</div>
    <div className="finance-today__results"><h3>{queue.label}</h3><strong className="finance-today__total">{money(queue.amountCents)}</strong><p>{queue.items.length} título(s) · saldo em aberto, sem representar saldo de caixa.</p></div>
    <ul className="finance-today__list">{queue.items.map((item,i)=><li className="finance-today__row" key={`${item.id}:${i}`}>
      <div><strong>{item.description}</strong><p>{item.direction} · {item.obra}</p></div>
      <time dateTime={item.dueDate||undefined}>{item.dueDate?item.dueDate.split('-').reverse().join('/'):'Sem vencimento'}</time>
      <strong>{money(item.amountCents)}</strong><Button variant="outline" onClick={()=>onOpen({title:item.description,items:[item],context:`Posição em ${today} · ${item.direction}`})}>Ver memorial</Button>
    </li>)}</ul>
    {!queue.items.length&&<div className="finance-today__empty" role="status"><strong>Nenhum título em {queue.label.toLocaleLowerCase('pt-BR')} para esta obra.</strong><p>Consulte outra fila ou altere a obra selecionada.</p></div>}
  </section>;
}
