import {Input as StandardInput} from '../../components/ui/input.jsx';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {FinancialEntryDetails} from './DreMemorial.jsx';
import {captureFinancePosition} from './navigation-context.js';
import {financialSearchText} from '../../domains/financeiro/search.js';
import {entryEvidenceDocuments} from '../../domains/financeiro/document-evidence.js';
import DocumentEvidence from './DocumentEvidence.jsx';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import './annual-dre.css';
import './financial-overview.css';
const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function FinancialMemorial({detail,onClose,onOpenWork,onDocuments,canOpenDocuments}){
  const ref=useRef(null);const [query,setQuery]=useState(detail.query||'');
  const [evidenceKey,setEvidenceKey]=useState(null);
  const [page,setPage]=useState(Number.isInteger(detail.page)?Math.max(0,detail.page):0);
  const [expanded,setExpanded]=useState(()=>new Set(detail.expandedIds||(detail.items.length===1?[`${detail.items[0].id}:0`]:[])));
  useEffect(()=>{const opener=document.activeElement;const d=ref.current;d.showModal();d.scrollTop=Number.isFinite(detail.scrollTop)?detail.scrollTop:0;return()=>{d.close();if(opener?.isConnected)opener.focus({preventScroll:true});};},[]);
  const indexed=useMemo(()=>detail.items.map((item,index)=>({item,key:`${item.id}:${index}`})),[detail.items]);
  const entries=useMemo(()=>indexed.filter(({item:e})=>financialSearchText([e.description,e.obra,e.counterparty,e.documentNumber].join(' ')).includes(financialSearchText(query))),[indexed,query]);
  const sum=useMemo(()=>detail.items.reduce((s,e)=>s+e.amountCents,0),[detail.items]);
  const subtotal=entries.reduce((s,{item})=>s+item.amountCents,0);
  const lastPage=Math.max(0,Math.ceil(entries.length/50)-1),currentPage=Math.min(page,lastPage);
  const visible=entries.slice(currentPage*50,currentPage*50+50);
  const toggle=(key,open)=>setExpanded(previous=>{if(previous.has(key)===open)return previous;const next=new Set(previous);if(open)next.add(key);else next.delete(key);return next;});
  const openDocuments=item=>onDocuments(item,{...detail,query,page:currentPage,expandedIds:[...expanded],scrollTop:ref.current.scrollTop},captureFinancePosition(ref.current.parentElement));
  return <dialog ref={ref} className="annual-dre__dialog financial-memorial" aria-labelledby="financial-memorial-title" onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation();}} onCancel={e=>{e.preventDefault();onClose();}}>
    <header><h3 id="financial-memorial-title">{detail.title}</h3><Button variant="outline" onClick={onClose}>Fechar memorial</Button></header>
    <p>{detail.context}</p><p>{detail.items.length} lançamento(s) no conjunto · Total do conjunto: <strong>{money(detail.totalCents??sum)}</strong></p>
    <label className="financial-search">Pesquisar lançamento, obra ou documento<StandardInput type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);setEvidenceKey(null);}}/></label>
    <p role="status">{entries.length} encontrado(s) · Subtotal da busca: <strong>{money(subtotal)}</strong> · Página {currentPage+1} de {lastPage+1}</p>
    {entries.length>50&&<nav className="financial-memorial__pagination" aria-label="Paginação do memorial"><Button variant="outline" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setEvidenceKey(null);}}>Página anterior</Button><span>{currentPage*50+1}–{Math.min((currentPage+1)*50,entries.length)} de {entries.length}</span><Button variant="outline" disabled={currentPage===lastPage} onClick={()=>{setPage(currentPage+1);setEvidenceKey(null);}}>Próxima página</Button></nav>}
    <div className="dre-memorial">{visible.map(({item,key})=><details className="dre-memorial__entry" data-entry-key={key} key={key} open={expanded.has(key)} onToggle={e=>{if(e.currentTarget.isConnected)toggle(key,e.currentTarget.open);}}>
      <summary><span>{item.description}<small>{item.direction?`${item.direction} · `:''}{item.obra} · {financialDateLabel(item.dueDate||item.date,'Data não informada')}</small></span><strong>{money(item.amountCents)}</strong></summary>
    {expanded.has(key)&&<><FinancialEntryDetails item={item} onOpenWork={onOpenWork?id=>{onClose();onOpenWork(id);}:undefined}/>
    {entryEvidenceDocuments(item).length>0&&<><Button variant="outline" aria-expanded={evidenceKey===key} onClick={()=>setEvidenceKey(current=>current===key?null:key)}>{evidenceKey===key?'Fechar evidências':'Conferir evidências'}</Button>{evidenceKey===key&&<DocumentEvidence documents={entryEvidenceDocuments(item)} origin={item.documentNumber||item.description} title="Evidências do lançamento"/>}</>}
    {onDocuments&&canOpenDocuments?.(item)&&<Button variant="outline" onClick={()=>openDocuments(item)}>Consultar na central de documentos</Button>}
    </>}</details>)}</div>
    {!entries.length&&<p role="status">Nenhum lançamento encontrado neste recorte.</p>}
    {detail.totalCents!=null&&detail.totalCents!==sum&&<p role="status">Parcela sem detalhamento individual: {money(detail.totalCents-sum)}. O total do indicador foi preservado.</p>}
  </dialog>;
}
