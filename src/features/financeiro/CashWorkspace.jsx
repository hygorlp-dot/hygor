import { Suspense, useState } from "react";
import { lazyWithCssRetry as lazy } from "../../lib/lazy-with-css-retry.js";
import AccountCashPosition from './AccountCashPosition.jsx';
import CashForecast from './CashForecast.jsx';
import {Button} from '../../components/ui/button.jsx';
import './cash-forecast.css';
const LocalAccountCashPreview=import.meta.env.DEV?lazy(()=>import('./LocalAccountCashPreview.jsx')):null;
const AssistedReviewQueue=lazy(()=>import('../pilot/AssistedReviewQueue.jsx'));
export default function CashWorkspace({data,ledger,today,obraId,onOpen,view,onViewChange,scenario,onScenarioChange,currentUser}){
 const [localView,setLocalView]=useState({account:'',accountPositions:{}});
 const [reviewOpen,setReviewOpen]=useState(false);
 const state=view??localView,setView=onViewChange??setLocalView;
 const preview=import.meta.env.DEV&&location.origin==='http://127.0.0.1:4192'&&new URLSearchParams(location.search).get('account-preview')==='9896';
 const accounts=data.contasBancarias||[];
 if(reviewOpen)return <Suspense fallback={<p role="status">Preparando revisão assistida…</p>}><AssistedReviewQueue data={data} onClose={()=>setReviewOpen(false)}/></Suspense>;
 return <section className="cash-workspace" aria-labelledby="cash-workspace-heading"><h2 id="cash-workspace-heading">Caixa por conta</h2><p>Posição bancária da empresa, atualização dos dados e pendências. A previsão dos títulos mantém seu próprio recorte por obra.</p>
 <div><Button variant="outline" onClick={()=>setReviewOpen(true)}>Abrir fila de revisão assistida</Button></div>
 {preview?<Suspense fallback={<p role="status">Preparando prévia local da conta…</p>}><LocalAccountCashPreview data={data} ledger={ledger} today={today} obraId={obraId} onOpen={onOpen} state={state.preview} onStateChange={next=>setView(previous=>({...previous,preview:typeof next==='function'?next(previous.preview||{accountPositions:{}}):next}))}/></Suspense>:<>
 <div className="cash-forecast__controls"><label>Conta bancária do caixa<select aria-label="Conta bancária do caixa" value={state.account||''} onChange={e=>setView(previous=>({...previous,account:e.target.value}))}><option value="">Selecione uma conta</option>{state.account&&!accounts.some(a=>String(a.id)===state.account)&&<option value={state.account}>Conta não cadastrada (revisar)</option>}{accounts.map(a=><option key={a.id} value={a.id}>{a.nome}{a.ativa===false?' (inativa)':''}</option>)}</select></label></div>
 <AccountCashPosition data={data} ledger={ledger} today={today} account={state.account||''} obraId={obraId} state={state} onChange={patch=>setView(previous=>({...previous,...patch}))} onOpen={onOpen}/></>}
 <details className="financial-analysis"><summary>Previsão por vencimentos</summary><CashForecast data={data} ledger={ledger} today={today} obraId={obraId} onOpen={onOpen} scenario={scenario} onScenarioChange={onScenarioChange} currentUser={currentUser}/></details>
 </section>;
}
