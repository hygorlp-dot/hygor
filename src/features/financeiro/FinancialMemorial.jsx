import {useEffect,useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {FinancialEntryDetails} from './DreMemorial.jsx';
import {captureFinancePosition} from './navigation-context.js';
import {financialSearchText} from '../../domains/financeiro/search.js';
import './annual-dre.css';
import './financial-overview.css';
const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function FinancialMemorial({detail,onClose,onOpenWork,onDocuments,canOpenDocuments}){
  const ref=useRef(null);const [query,setQuery]=useState(detail.query||'');
  useEffect(()=>{const opener=document.activeElement;const d=ref.current;d.showModal();return()=>{d.close();if(opener?.isConnected)opener.focus({preventScroll:true});};},[]);
  const entries=detail.items.filter(e=>financialSearchText([e.description,e.obra,e.counterparty,e.documentNumber].join(' ')).includes(financialSearchText(query)));
  const sum=detail.items.reduce((s,e)=>s+e.amountCents,0);
  const openDocuments=item=>onDocuments(item,{...detail,query,expandedIds:[...ref.current.querySelectorAll('details.dre-memorial__entry[open]')].map(entry=>entry.dataset.entryKey)},captureFinancePosition(ref.current.parentElement));
  return <dialog ref={ref} className="annual-dre__dialog financial-memorial" aria-labelledby="financial-memorial-title" onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h3 id="financial-memorial-title">{detail.title}</h3><Button variant="outline" onClick={onClose}>Fechar memorial</Button></header>
    <p>{detail.context}</p><p>{detail.items.length} lançamento(s) · Total: <strong>{money(detail.totalCents??sum)}</strong></p>
    <label className="financial-search">Pesquisar lançamento, obra ou documento<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="dre-memorial">{entries.map((item,i)=><details className="dre-memorial__entry" data-entry-key={`${item.id}:${i}`} key={`${item.id}:${i}`} open={detail.items.length===1||detail.expandedIds?.includes(`${item.id}:${i}`)||undefined}>
      <summary><span>{item.description}<small>{item.direction?`${item.direction} · `:''}{item.obra} · {item.dueDate||item.date||'Data não informada'}</small></span><strong>{money(item.amountCents)}</strong></summary>
    <FinancialEntryDetails item={item} onOpenWork={onOpenWork?id=>{onClose();onOpenWork(id);}:undefined}/>
    {onDocuments&&canOpenDocuments?.(item)&&<Button variant="outline" onClick={()=>openDocuments(item)}>Consultar na central de documentos</Button>}
    </details>)}</div>
    {!entries.length&&<p role="status">Nenhum lançamento encontrado neste recorte.</p>}
    {detail.totalCents!=null&&detail.totalCents!==sum&&<p role="status">Parcela sem detalhamento individual: {money(detail.totalCents-sum)}. O total do indicador foi preservado.</p>}
  </dialog>;
}
