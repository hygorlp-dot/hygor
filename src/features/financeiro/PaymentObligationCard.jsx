import {Button} from '../../components/ui/button.jsx';
import {TaskDisclosure} from '../../design-system/patterns/TaskDisclosure.jsx';
import {contar} from '../../design-system/copy.js';
import {fmt} from '../../legacy/format.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {documentEvidenceInfo} from '../../domains/financeiro/document-evidence.js';
import {awaitingBankReconciliation,paymentEvidence,requiresBankReconciliation} from '../../domains/financeiro/payment-evidence.js';
import {invoiceFiscalPending} from '../../domains/financeiro/payables.js';
import FinancialDocumentLink from './FinancialDocumentLink.jsx';

const origin={empresa:'Conta da empresa',caixa_obra:'Caixa da obra',cliente_direto:'Cliente pagou diretamente',banco:'Movimento bancário'};
const state={vencida:'Vencida',autorizada:'Autorizada a pagar',parcial:'Pagamento parcial',conferencia:'Em conferência',sem_nota:'Aguardando nota fiscal',paga:'Paga'};
const date=value=>financialDateLabel(String(value||'').slice(0,10),'Não informada');
const attribution=(actor,value)=>[actor,date(value)].filter(Boolean).join(' · ');

function EvidenceLink({proof,label}){
 const href=proof.url||(proof.reference?`/api/microsoft/onedrive?action=file&${new URLSearchParams(proof.reference)}`:null);
 return href?<FinancialDocumentLink href={href} reference={proof.reference}>{label}</FinancialDocumentLink>:<span>Referência indisponível</span>;
}

export default function PaymentObligationCard({item,work,canPay,onPay,onReview,onBank,onReceive,onMemorial}){
 const isNote=item.tipo==='nota',record=item.registro;
 const fiscalPending=isNote&&invoiceFiscalPending(record);
 const needsBank=item.pagamentos.some(awaitingBankReconciliation);
 const hasBalance=item.saldo>.01;
 const paid=item.pagamentos.reduce((sum,payment)=>sum+Number(payment.valor||0),0);
 const primary=fiscalPending&&onReview?{label:'Conferir documento',action:onReview}:
  !isNote&&onReceive?{label:'Receber documento fiscal',action:onReceive}:
  hasBalance&&canPay?{label:'Registrar pagamento',action:onPay}:null;

 return <article className="payment-obligation" data-overdue={item.estado==='vencida'||undefined}>
  <header className="payment-obligation__summary">
   <div><h3>{item.numero}</h3><p>{item.fornecedor} · {work}</p><p><strong>{state[item.estado]||'Em conferência'}</strong>{needsBank?' · A conciliar':''}</p></div>
   <div className="payment-obligation__balance"><span>{hasBalance?'Saldo a pagar':'Total pago'}</span><strong>{fmt(hasBalance?item.saldo:paid)}</strong>{paid>0&&hasBalance&&<small>{fmt(paid)} já pagos</small>}</div>
  </header>
  <p>Vencimento {date(item.vencimento)}{fiscalPending&&item.estado!=='conferencia'?' · Conferência fiscal pendente':''}</p>
  <div className="financial-record-flow__actions">
   {primary&&<Button onClick={primary.action}>{primary.label}</Button>}
   {onBank&&<Button variant="outline" onClick={onBank}>Revisar conciliação</Button>}
  </div>
  <TaskDisclosure summary={`Histórico e evidências · ${contar(item.pagamentos.length,'pagamento','pagamentos')}`}>
   <dl className="document-evidence__metadata">
    <div><dt>Lançamento</dt><dd>{attribution(record.criadoPor||record.recebidoPor,record.criadoEm||item.emissao)}</dd></div>
    <div><dt>{isNote?'Aprovação fiscal':'Aprovação do pedido'}</dt><dd>{fiscalPending?'Pendente':record.aprovadoPor||record.aprovadoEm?attribution(record.aprovadoPor,record.aprovadoEm):'Sem autoria registrada'}</dd></div>
   </dl>
   {item.documentos.length>0?<ul aria-label="Documentos da obrigação">{item.documentos.map((document,index)=><li key={document.id||index}><EvidenceLink proof={documentEvidenceInfo(document)} label={document.legenda||document.nome||'Abrir documento'}/></li>)}</ul>:<p>Sem anexo no documento da obrigação.</p>}
   {item.pagamentos.length>0&&<ol className="payment-obligation__history" aria-label="Baixas registradas">{item.pagamentos.map((payment,index)=>{
    const evidence=paymentEvidence(payment);
    return <li key={payment.id||index}>
     <strong>{fmt(payment.valor)} · {date(payment.data)}</strong>
     <p>{origin[payment.origem]||'Origem não informada'} · {requiresBankReconciliation(payment)?payment.conciliado?'Conciliado':'A conciliar':'Conciliação bancária não se aplica'}</p>
     <p>Registrado por {payment.registradoPor||'responsável não informado'}{payment.registradoEm?` · ${date(payment.registradoEm)}`:''}</p>
     {evidence.bankReference&&<p>Movimento vinculado: {evidence.bankReference}</p>}
     {!evidence.hasProof&&<p>Sem comprovante disponível.</p>}
     {evidence.proofs.filter(proof=>proof.resolvable).map(({document,...proof},i)=><p key={document.id||i}><EvidenceLink proof={proof} label={document.legenda||document.nome||'Abrir comprovante'}/></p>)}
    </li>;
   })}</ol>}
   <div className="financial-record-flow__actions">
    {onMemorial&&<Button variant="link" onClick={onMemorial}>Ver memorial</Button>}
    {hasBalance&&canPay&&primary?.action!==onPay&&<Button variant="outline" onClick={onPay}>Registrar pagamento</Button>}
   </div>
  </TaskDisclosure>
 </article>;
}
