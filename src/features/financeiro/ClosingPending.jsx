import {documentRegister,documentIssueLabels} from '../../domains/financeiro/document-register.js';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertTitle,AlertDescription} from '../../components/ui/alert.jsx';
import {closingBlocker} from './closing-blockers.js';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import './record-continuity.css';
export default function ClosingPending({data,competence,conference,onOpen,onDocuments,onCorrect,onBank}){
 const sources=documentRegister(data);
 const rows=sources.filter(r=>(!competence||r.period===competence)&&r.issues.length);
 const errors=conference?.errors||[];
 const transactions=(data.transacoes||[]).filter(t=>String(t.data||'').slice(0,7)===competence&&['pendente','parcial'].includes(t.status));
 return <section className="document-center" aria-labelledby="closing-pending-heading"><h2 id="closing-pending-heading">Pendências para conferência do fechamento</h2>
 <p>Escopo: empresa inteira · {competence}. A competência do registro é usada quando disponível; caso contrário, o mês de emissão. As pendências abaixo são alertas operacionais; os bloqueios financeiros são os retornados pelo motor.</p>
 <h3>Bloqueios financeiros · {errors.length}</h3>
 {errors.length>0&&<p>Confira cada origem antes de corrigir. Alguns avisos resumem a mesma diferença: não some os valores nem registre outro pagamento ou custo para compensá-los.</p>}
 {errors.map((error,i)=>{const blocker=closingBlocker(data,error,sources);return <Alert variant="destructive" key={i}>
  <AlertTitle>{blocker.title}</AlertTitle>
  <AlertDescription>
   <p>{blocker.reason}</p>
   {blocker.differenceCents!=null&&<p>Diferença a conferir: <strong>{(blocker.differenceCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></p>}
   <p>Responsável: {blocker.owner}.</p>
   {blocker.origin?<p>Origem: {blocker.origin.description} · {blocker.origin.obra}</p>:<p>A conferência não identificou um registro individual para este aviso.</p>}
   <p>{blocker.next}</p>
   {blocker.origin&&onOpen&&<div className="closing-pending__actions"><Button variant="outline" onClick={()=>onOpen({title:`Origem do bloqueio · ${blocker.origin.description}`,items:[blocker.origin],context:`Conferência de fechamento · ${competence}. O memorial apresenta o valor do documento de origem. A diferença do bloqueio é informada separadamente; consultar não altera o fechamento.`})}>Consultar origem do bloqueio</Button></div>}
   <TaskDisclosure summary="Diagnóstico para suporte">{blocker.code&&<p>Referência: {blocker.code}</p>}<p>{blocker.diagnostic}</p></TaskDisclosure>
  </AlertDescription>
 </Alert>;})}
 {!errors.length&&<p>Nenhum bloqueio retornado pela conferência financeira.</p>}
 <h3>Documentação e classificação · {rows.length} {rows.length===1?'registro':'registros'}</h3><div className="closing-pending__actions"><Button variant="outline" onClick={onDocuments}>Abrir central deste mês</Button></div>
 {rows.map(row=><article key={row.id}><strong>{row.label} · {row.entry.description}</strong><p>{row.entry.obra} · {row.issues.map(id=>documentIssueLabels[id]).join(' · ')}</p><div className="closing-pending__actions">{onCorrect&&<Button variant="outline" onClick={()=>onCorrect(row)}>{row.type==='nota_fiscal'?'Corrigir ficha fiscal':'Corrigir origem'}</Button>}<Button variant="link" onClick={()=>onOpen({title:row.entry.description,items:[row.entry],context:`Pendência de fechamento · ${competence}`})}>Consultar origem da pendência</Button></div></article>)}{!rows.length&&<p>Sem alertas documentais nos registros verificados. Isso não certifica a completude dos dados.</p>}
 <h3>Movimentos bancários a revisar · {transactions.length}</h3><p>Confira na Conciliação os movimentos pendentes ou parcialmente vinculados deste mês. Registros sem data não entram neste recorte.</p>
 <details><summary>Ver movimentos pendentes</summary>{transactions.map(t=><article key={t.id}><p>{t.data} · {t.descricao} · {Number(t.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · {t.status}</p>{onBank&&<Button variant="outline" onClick={()=>onBank(t)}>Revisar movimento na conciliação</Button>}</article>)}</details>
 </section>;
}
