import {documentRegister,documentIssueLabels} from '../../domains/financeiro/document-register.js';
import {Button} from '../../components/ui/button.jsx';
export default function ClosingPending({data,competence,conference,onOpen,onDocuments}){
 const rows=documentRegister(data,{competence}).filter(r=>r.issues.length);
 const errors=conference?.errors||[];
 const transactions=(data.transacoes||[]).filter(t=>String(t.data||'').slice(0,7)===competence&&['pendente','parcial'].includes(t.status));
 return <section className="document-center" aria-labelledby="closing-pending-heading"><h2 id="closing-pending-heading">Pendências para conferência do fechamento</h2>
 <p>Escopo: empresa inteira · {competence}. A competência do registro é usada quando disponível; caso contrário, o mês de emissão. As pendências abaixo são alertas operacionais; os bloqueios financeiros são os retornados pelo motor.</p>
 <h3>Bloqueios financeiros · {errors.length}</h3>{errors.map((error,i)=><p key={i} role="alert">{error.message||error.code||'Inconsistência financeira'}{error.differenceCents!=null?` · diferença ${(error.differenceCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`:''}</p>)}{!errors.length&&<p>Nenhum bloqueio retornado pela conferência financeira.</p>}
 <h3>Documentação e classificação · {rows.length} registro(s)</h3><Button variant="outline" onClick={onDocuments}>Abrir central deste mês</Button>
 {rows.map(row=><article key={row.id}><strong>{row.label} · {row.entry.description}</strong><p>{row.entry.obra} · {row.issues.map(id=>documentIssueLabels[id]).join(' · ')}</p><Button variant="link" onClick={()=>onOpen({title:row.entry.description,items:[row.entry],context:`Pendência de fechamento · ${competence}`})}>Consultar origem da pendência</Button></article>)}{!rows.length&&<p>Sem alertas documentais nos registros verificados. Isso não certifica a completude dos dados.</p>}
 <h3>Movimentos bancários a revisar · {transactions.length}</h3><p>Confira na Conciliação os movimentos pendentes ou parcialmente vinculados deste mês. Registros sem data não entram neste recorte.</p>
 <details><summary>Ver movimentos pendentes</summary>{transactions.map(t=><p key={t.id}>{t.data} · {t.descricao} · {Number(t.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · {t.status}</p>)}</details>
 </section>;
}
