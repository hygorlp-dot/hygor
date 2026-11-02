import {Button} from '../../components/ui/button.jsx';
import './record-continuity.css';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {active} from '../../domains/financeiro/ledger.js';
import {hasInvoiceBankPayment} from '../../domains/financeiro/record-continuity.js';

export default function FinancialRecordFlow({invoice,data,onPayments,onBank}){
 const payments=(invoice.pagamentos||[]).filter(active);
 const account=(data.contasBancarias||[]).find(a=>String(a.id)===String(invoice.contaBancariaId));
 return <section className="financial-record-flow" aria-label={`Continuidade do documento ${invoice.numero||invoice.id}`}>
  <p>{['aprovada','paga'].includes(invoice.status)?'Documento aprovado. Consulte a obrigação e os pagamentos antes de registrar outra saída.':'Confira e aprove o documento na ficha fiscal antes de pagar.'}</p>
  <p>Vencimento: {financialDateLabel(invoice.vencimento,'não informado')} · Conta do documento: {account?.nome||'não informada'} · Pagamentos registrados: {payments.length}</p>
  <div className="financial-record-flow__actions">{onPayments&&<Button variant="outline" onClick={()=>onPayments(invoice.id)}>Consultar pagamentos deste documento</Button>}{onBank&&hasInvoiceBankPayment(invoice)&&<Button variant="outline" onClick={()=>onBank(invoice.id)}>Revisar conciliação deste documento</Button>}</div>
 </section>;
}
