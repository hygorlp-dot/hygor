import {ChoiceControl} from '../../design-system/primitives/ChoiceControl.jsx';
import {useRef,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {documentReviewEligibility,documentReviewStatus} from '../../domains/financeiro/document-review-queue.js';
import RecordPagination,{DOCUMENT_PAGE_SIZE,recordPage} from './RecordPagination.jsx';

export default function DocumentReviewQueue({rows,allRows=rows,data,user,scope,onReview,view,onChange}){
 const [local,setLocal]=useState({});
 const saved=view??local;
 // A refresh or reordering must not reset a sequence. Only an explicit scope change does.
 const state=saved.scope===scope?saved:{scope,ids:[],preview:false,opened:[],skipped:[],attempts:{},errors:{}};
 const {ids=[],preview=false,opened=[],skipped=[],attempts={},errors={}}=state;
 const currentState=useRef(state);currentState.current=state;
 const update=patch=>{const next={...currentState.current,...patch};currentState.current=next;(onChange??setLocal)(next);};
 const available=new Map(rows.map(row=>[row.id,row])),known=new Map(allRows.map(row=>[row.id,row]));
 const reasonFor=id=>!known.has(id)?'Registro indisponível na base atual':!available.has(id)?'Fora dos filtros atuais':documentReviewEligibility(known.get(id),data,user);
 const eligible=rows.filter(row=>!reasonFor(row.id));
 const selected=ids.map(id=>({id,row:known.get(id),reason:reasonFor(id)}));
 const ready=selected.filter(item=>!item.reason);
 const remaining=ready.filter(item=>!opened.includes(item.id)&&!skipped.includes(item.id));
 const source=preview?selected:rows.map(row=>({id:row.id,row,reason:reasonFor(row.id)}));
 const page=recordPage(source.length,state.page),visible=source.slice(page*DOCUMENT_PAGE_SIZE,(page+1)*DOCUMENT_PAGE_SIZE);
 const setIds=next=>update({ids:typeof next==='function'?next(ids):next,preview:false,opened:[],skipped:[],attempts:{},errors:{}});
 async function open(item){
  if(!item.row||reasonFor(item.id))return;
  const patch={opened:[...new Set([...opened,item.id])],skipped:skipped.filter(id=>id!==item.id),attempts:{...attempts,[item.id]:Number(item.row.record.version||0)},errors:{...errors,[item.id]:''}};
  update(patch);
  const fail=message=>{if(currentState.current.scope===scope)update({errors:{...currentState.current.errors,[item.id]:message}});};
  try{const result=await onReview(item.row.record.id);if(result?.ok===false)fail(result.reason||result.error||'Não foi possível abrir a ficha. Tente novamente ou siga para outra.');}
  catch{fail('Não foi possível abrir a ficha. Tente novamente ou siga para outra.');}
 }
 return <details className="document-review-queue" open={preview||undefined}><summary>Conferir documentos em sequência · {eligible.length} disponível(is)</summary>
 <p>Selecione as notas e confira a prévia. Cada ficha usa sua própria revisão e confirmação; esta seleção não classifica nem aprova em massa.</p>
 <div className="document-review-queue__actions">{preview?<Button variant="outline" onClick={()=>update({preview:false,page:0})}>Ajustar seleção</Button>:<><Button variant="outline" disabled={!eligible.length} onClick={()=>setIds(eligible.map(row=>row.id))}>Selecionar notas disponíveis</Button><Button disabled={!ids.length} onClick={()=>update({preview:true,page:0})}>Revisar seleção · {ids.length}</Button></>}<Button variant="ghost" disabled={!ids.length} onClick={()=>setIds([])}>Limpar seleção</Button></div>
 {preview&&<section aria-label="Prévia da conferência em sequência"><h3>Prévia da conferência em sequência</h3><p role="status">{remaining.length} ficha(s) por abrir · {selected.length-ready.length} bloqueado(s) ou indisponível(is) na seleção atual · {skipped.length} deixado(s) para depois. A elegibilidade será verificada novamente ao abrir.</p><p>Abrir uma ficha não significa que foi salva ou conferida. Uma atualização da base mantém a seleção e mostra a situação de cada registro.</p><Button disabled={!remaining.length} onClick={()=>open(remaining[0])}>Abrir próxima ficha fiscal</Button></section>}
 <RecordPagination count={source.length} page={page} onPage={page=>update({page})} label={preview?'Paginação da sequência':'Paginação da seleção'}/>
 <ul>{visible.map(item=>{const {id,row,reason}=item,wasOpened=opened.includes(id),changed=wasOpened&&row&&Number(row.record.version||0)!==attempts[id];return <li key={id}>
 {!preview?<label><ChoiceControl type="checkbox" checked={ids.includes(id)} disabled={Boolean(reason)} onChange={event=>setIds(previous=>event.target.checked?[...previous,id]:previous.filter(value=>value!==id))}/><span><strong>{row.label} · {row.entry.description}</strong><small>{reason||'Disponível para abrir a ficha fiscal'}</small></span></label>:<>
 <strong>{row?.record.numero||row?.entry.description||id}</strong><p>{reason||`Situação atual: ${documentReviewStatus(row.record.status)}`}</p>
 <p>{skipped.includes(id)?'Deixada para depois':wasOpened?(changed?'Registro atualizado desde a abertura · confira o resultado individual':'Ficha aberta nesta sequência · sem nova versão confirmada'):'Ficha ainda não aberta'}</p>
 {errors[id]&&<p role="alert">{errors[id]}</p>}
 <div className="document-review-queue__actions"><Button variant="outline" disabled={Boolean(reason)} onClick={()=>open(item)}>{wasOpened?'Reabrir ficha fiscal':'Abrir esta ficha fiscal'}</Button><Button variant="ghost" disabled={skipped.includes(id)||Boolean(reason)} onClick={()=>update({skipped:[...skipped,id]})}>Deixar para depois</Button></div>
 </>}
 </li>;})}</ul>{!source.length&&<p role="status">Nenhum documento neste recorte. Ajuste os filtros para iniciar uma sequência.</p>}
 <RecordPagination count={source.length} page={page} onPage={page=>update({page})} label={preview?'Continuar a sequência':'Continuar a seleção'} anchorLabel={preview?'Paginação da sequência':'Paginação da seleção'}/>
 </details>;
}
