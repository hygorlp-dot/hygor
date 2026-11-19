import { contar } from "../../design-system/copy.js";
import {WorkspaceCommandBar} from '../../design-system/patterns/WorkspaceCommandBar.jsx';
import {Input as StandardInput} from '../../components/ui/input.jsx';
import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {documentRegister} from '../../domains/financeiro/document-register.js';
import {bankExpenseContext,documentConferenceLabels,documentConferenceRows} from '../../domains/financeiro/document-conference.js';
import DocumentTrace from './DocumentTrace.jsx';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import {financialSearchText} from '../../domains/financeiro/search.js';
import DocumentEvidence from './DocumentEvidence.jsx';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import './document-center.css';
import SavedDocumentQueries from './SavedDocumentQueries.jsx';
import DocumentReviewQueue from './DocumentReviewQueue.jsx';
import {queryStorageKey} from '../../domains/financeiro/saved-queries.js';
import FinancialRecordFlow from './FinancialRecordFlow.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import RecordPagination,{DOCUMENT_PAGE_SIZE,recordPage} from './RecordPagination.jsx';
const counterpartyLabel=row=>row.pixName?`Nome no Pix · ${row.pixName}`:row.entry.counterparty?.trim()||'Contraparte não informada';
export default function DocumentCenter({data,obraId,competence,onCompetence,onOpen,onReview,onReceive,view,onViewChange,resolveFile,currentUser,onObra,onPayments,onBank,onBankExpense,onExpenseEvidence,onException,scopeControl}){
 const [localView,setLocalView]=useState({query:'',filter:'all',selected:null});
 const {query,filter,selected}=view??localView;
 const change=(key,value)=>(onViewChange??setLocalView)(previous=>({...previous,[key]:value}));
 const setQuery=value=>change('query',value),setFilter=value=>change('filter',value),setSelected=value=>change('selected',value);
 const selectionRef=useRef(null);
 const selectionTrigger=useRef(null);
 const register=useMemo(()=>documentConferenceRows(data,documentRegister(data,{obraId,competence})),[data,obraId,competence]);
 const rows=register.filter(r=>(filter==='all'||r.issues.includes(filter))&&financialSearchText([r.label,r.entry.description,r.entry.obra,r.entry.documentNumber,r.entry.counterparty,r.pixName].join(' ')).includes(financialSearchText(query)));
 const current=rows.find(r=>r.id===selected);
 const supplementary=current?.originals?current.docs.filter(doc=>!current.originals.includes(doc)):[];
 const bankContext=current&&bankExpenseContext(current,currentUser);
 const selectedOutside=register.some(r=>r.id===selected)&&!current;
 const selectedUnavailable=selected&&!register.some(row=>row.id===selected);
 const storageKey=queryStorageKey(currentUser,data.config);
 const pageScope=JSON.stringify([storageKey,obraId,competence,query,filter]);
 const activeView=view??localView;
 const page=recordPage(rows.length,activeView.pageScope===pageScope?activeView.page:0);
 const setPage=value=>(onViewChange??setLocalView)(previous=>({...previous,page:value,pageScope}));
 const visible=rows.slice(page*DOCUMENT_PAGE_SIZE,(page+1)*DOCUMENT_PAGE_SIZE);
 const closeReview=()=>{
  setSelected(null);
  if(selectionTrigger.current?.isConnected)selectionTrigger.current.focus();
 };
 useEffect(()=>{
  if(!current)return;
  selectionRef.current?.focus({preventScroll:true});
  selectionRef.current?.scrollIntoView?.({block:'nearest'});
 },[selected,Boolean(current)]);
 return <section className="document-center"><h2>Central de documentos e conferência</h2>
 <p>Revise notas fiscais, originais e despesas do extrato na mesma fila.</p>
 <WorkspaceCommandBar label="Comandos de documentos" scope={scopeControl} actions={<Button onClick={onReceive}>Receber documento fiscal</Button>}><label>Competência ou mês de emissão<StandardInput type="month" value={competence} onChange={e=>onCompetence(e.target.value)}/></label><label>Pesquisar documento ou fornecedor<StandardInput type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Conferência<SelectControl aria-label="Conferência" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos · {register.length}</option>{Object.entries(documentConferenceLabels).map(([id,label])=><option key={id} value={id}>{label} · {register.filter(r=>r.issues.includes(id)).length}</option>)}</SelectControl></label></WorkspaceCommandBar>
 <SavedDocumentQueries key={storageKey||'unavailable'} storageKey={storageKey} value={{query,filter,competence,obraId}} works={data.obras||[]} restrictedWork={currentUser?.obraId} onApply={value=>{onCompetence(value.competence);onObra?.(value.obraId);(onViewChange??setLocalView)({query:value.query,filter:value.filter,selected:null});}}/>
 {selectedOutside&&<section className="financial-origin-return" role="status"><p>O registro selecionado está fora dos filtros atuais. O recorte foi preservado.</p><Button variant="outline" onClick={()=>{setQuery('');setFilter('all');}}>Mostrar registro selecionado</Button></section>}
 {selectedUnavailable&&<Alert role="status"><AlertDescription>O registro selecionado não está disponível neste recorte. Confira a obra, o mês e a atualização da base.</AlertDescription><Button variant="outline" onClick={()=>setSelected(null)}>Encerrar seleção indisponível</Button></Alert>}
 {onReview&&currentUser&&<DocumentReviewQueue rows={rows} allRows={register} data={data} user={currentUser} scope={pageScope} onReview={onReview} view={(view??localView).reviewQueue} onChange={value=>change('reviewQueue',value)}/>}
 <RecordPagination count={rows.length} page={page} onPage={setPage} label="Paginação dos documentos"/>
 <div className="document-center__workspace" data-selected={Boolean(current)}><div><div className="document-center__scope"><p role="status">{contar(rows.length,"registro","registros")} · {competence||"Todos os meses"} · {documentConferenceLabels[filter]||"Todas as situações"}</p>{(query||filter!=="all")&&<Button variant="outline" size="sm" onClick={()=>{setQuery('');setFilter('all');}}>Limpar busca e situação</Button>}</div>{visible.map(row=><article key={row.id} data-selected={current?.id===row.id}><h3>{row.label} · {row.entry.description}</h3><p>{row.entry.obra} · {financialDateLabel(row.entry.date,'Sem data')} · {counterpartyLabel(row)}</p><p>{row.issues.map(id=>documentConferenceLabels[id]).join(' · ')||'Sem alertas nesta checagem'}</p>{row.duplicates?.length>0&&<p>Conferir com: {row.duplicates.join(', ')}</p>}{row.exception&&<p>Exceção documental registrada no fechamento.</p>}<Button variant="outline" aria-pressed={current?.id===row.id} onClick={event=>{selectionTrigger.current=event.currentTarget;setSelected(row.id);}}>Conferir documentos</Button></article>)}{!rows.length&&<p role="status">Nenhum registro neste filtro. Limpe o mês para incluir registros sem data.</p>}</div>
 {current&&<aside ref={selectionRef} tabIndex={-1} aria-label="Documento e dados para conferência">
  <header><h3>{current.entry.description}</h3><Button variant="outline" size="sm" onClick={closeReview}>Fechar conferência</Button></header>
  <p>{current.type==='nota_fiscal'?'Emissão':'Data do registro'} {financialDateLabel(current.entry.date)} · Competência {current.period||'não informada'}</p>
  <p>{counterpartyLabel(current)}</p>
  <div className="financial-record-flow__actions">
   {current.type==='nota_fiscal'&&onReview&&<Button onClick={()=>onReview(current.record.id)}>Conferir e editar ficha fiscal</Button>}
   {onOpen&&<Button variant="link" onClick={()=>onOpen({title:current.entry.description,items:[current.entry],context:'Conferência documental'})}>Ver memorial</Button>}
  </div>
  <DocumentTrace row={current} data={data} onBank={bankContext&&onBankExpense?()=>onBankExpense(bankContext):undefined}
   onExpenseEvidence={onExpenseEvidence?.available(current)?onExpenseEvidence.open:undefined}
   onException={onException}/>
  <DocumentEvidence key={current.id} resolveFile={resolveFile} documents={current.originals||current.docs}
   title={current.type==='nota_fiscal'?'Originais da nota fiscal':'Evidências do registro'}
   origin={`${current.label} · ${current.record.numero||current.record.id}`}/>
  {supplementary.length>0&&<TaskDisclosure summary="Comprovantes e documentos relacionados">
   <DocumentEvidence key={current.id} resolveFile={resolveFile} documents={supplementary} title="Documentos relacionados"/>
  </TaskDisclosure>}
  {current.type==='nota_fiscal'&&<FinancialRecordFlow invoice={current.record} data={data} onPayments={onPayments} onBank={onBank}/>}
 </aside>}</div><RecordPagination count={rows.length} page={page} onPage={setPage} label="Continuar pelos documentos" anchorLabel="Paginação dos documentos"/></section>;
}
