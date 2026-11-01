import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {FORECAST_REVIEW_DECISIONS,forecastReviewHistory} from '../../domains/financeiro/forecast-review-history.js';
import './forecast-review-history.css';

const money=value=>Number.isSafeInteger(value)?(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Não registrado';
const date=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}):'Não registrada';

export default function ForecastReviewHistory({work}){
 const [filter,setFilter]=useState('all'),[requestedPage,setPage]=useState(0);
 const rows=forecastReviewHistory(work),options=[...rows.reduce((map,r)=>map.has(r.amendmentId)?map:map.set(r.amendmentId,r),new Map()).values()];
 const filtered=rows.filter(r=>filter==='all'||r.amendmentId===filter),page=Math.min(requestedPage,Math.max(0,Math.ceil(filtered.length/10)-1));
 return <section className="forecast-review-history" aria-label="Histórico de conferência das duplicidades">
  <h4>Histórico de conferência das duplicidades</h4>
  <p>Conferências salvas, da mais recente para a mais antiga. Datas no fuso deste dispositivo. Rascunhos não entram no histórico.</p>
  {rows.length>0&&<label>Aditivo do histórico<SelectControl aria-label="Aditivo do histórico" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">Todos os aditivos</option>{options.map(r=><option key={r.amendmentId} value={r.amendmentId}>Aditivo {r.amendmentNumber||r.amendmentId}</option>)}</SelectControl></label>}
  {!filtered.length?<p>Nenhuma conferência salva neste recorte. Escolha a decisão na previsão e confirme para registrá-la aqui.</p>:<ol>{filtered.slice(page*10,page*10+10).map(r=><li key={r.id}>
   <p><strong>Aditivo {r.amendmentNumber||r.amendmentId}{r.description?` · ${r.description}`:''}</strong> · {r.stageLabel||r.stageId||'Etapa não registrada'} · Revisão {r.version??'não registrada'}</p>
   <dl><div><dt>Responsável</dt><dd>{r.by||'Não registrado'}</dd></div><div><dt>Data da conferência</dt><dd>{date(r.at)}</dd></div><div><dt>Decisão</dt><dd>{FORECAST_REVIEW_DECISIONS[r.mode]||'Não registrada'}</dd></div><div><dt>Impacto conferido</dt><dd>{money(r.amountCents)}</dd></div><div><dt>Restante conferido</dt><dd>{money(r.remainingCents)}</dd></div></dl>
   <p><strong>Justificativa:</strong> {r.justification||'Não registrada.'}</p>
   {!r.justification&&r.premises&&<p><strong>Premissas da revisão:</strong> {r.premises}</p>}
   {r.legacy&&<p>Registro antigo: apresenta apenas as informações disponíveis na revisão original.</p>}
   {r.basisCurrent===false&&<p>Esta decisão se refere a uma base anterior aos valores desta revisão; exige nova conferência.</p>}
  </li>)}</ol>}
  {filtered.length>10&&<nav aria-label="Páginas do histórico de conferências"><Button variant="outline" disabled={page===0} onClick={()=>setPage(page-1)}>Conferências anteriores</Button><span role="status">Página {page+1} de {Math.ceil(filtered.length/10)} · {filtered.length} registros</span><Button variant="outline" disabled={(page+1)*10>=filtered.length} onClick={()=>setPage(page+1)}>Próximas conferências</Button></nav>}
 </section>;
}
