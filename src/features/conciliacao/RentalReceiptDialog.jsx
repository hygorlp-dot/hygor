import {useUnsavedChanges} from '../workflow/useUnsavedChanges.js';
import UnsavedChangesPrompt from '../workflow/UnsavedChangesPrompt.jsx';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {useRef,useState} from 'react';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Sel} from '../../legacy/ui.jsx';

export default function RentalReceiptDialog({data,transaction={},fmt,onSave,onClose,onNew}){
  useHelpTopic('conc','conc_receitas_locacao',1);
  const [invoiceId,setInvoiceId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
  const guard=useUnsavedChanges({invoiceId},onClose,{busy,identity:transaction.id});
  const existing=(data.rentalInvoiceReceipts||[]).find(receipt=>receipt.transactionId===transaction.id&&receipt.status!=='cancelled');
  const invoices=(data.rentalInvoices||[]).filter(invoice=>['issued','partially_paid'].includes(invoice.status)||invoice.id===existing?.invoiceId);
  const invoice=invoices.find(row=>row.id===invoiceId),amountCents=Math.round(Number(transaction.valor)*100);
  const valid=invoice&&amountCents>0&&(existing?existing.invoiceId===invoice.id&&existing.amountCents===amountCents:amountCents<=Number(invoice.openAmountCents));
  const save=async()=>{if(lock.current||!valid)return;lock.current=true;setBusy(true);setError('');try{
    if(await onSave({transactionId:transaction.id,invoiceId,expectedInvoiceVersion:Number(invoice.version||0)}))onClose();
    else setError('O recebimento não foi confirmado. Confira o saldo e os avisos antes de tentar novamente.');
  }catch{setError('Não foi possível confirmar o recebimento. Tente novamente.');}finally{lock.current=false;setBusy(false);}};
  return <><Dialog open onOpenChange={open=>{if(!open)guard.requestClose();}} title="Vincular recebimento de locação"
    footer={<><Button variant="outline" disabled={busy} onClick={guard.requestClose}>Cancelar</Button><Button disabled={busy||!valid} onClick={save}>{busy?'Vinculando…':'Vincular recebimento'}</Button></>}>
    <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
      <p>Entrada do banco: {fmt(Number(transaction.valor))} · {financialDateLabel(transaction.data)}</p>
      <p>A fatura e a locação cadastradas são a origem. A confirmação baixa o saldo da fatura e registra o caixa, sem reconhecer faturamento novamente no DRE.</p>
      <Sel label="Fatura de locação" value={invoiceId} onChange={setInvoiceId} options={[{v:'',l:'Selecione a fatura'},...invoices.map(row=>({v:row.id,l:`${row.number||row.id} · ${row.competence||'Competência não informada'} · saldo ${fmt(Number(row.openAmountCents||0)/100)}`}))]}/>
      {invoice&&<p>Valor do recebimento: {fmt(amountCents/100)}. Saldo da fatura após o vínculo: {fmt(Math.max(0,Number(invoice.openAmountCents||0)-(existing?0:amountCents))/100)}.</p>}
      {!invoices.length&&<p>Nenhuma fatura recebível nesta empresa. Confira a emissão na Central de locações. Para aluguel ainda não registrado, use Receita nova de locação na conciliação.</p>}
      <p>O aluguel ainda não foi cadastrado nem reconhecido no DRE?</p>
      <Button variant="outline" disabled={busy} onClick={onNew}>Registrar receita nova de locação</Button>
      {invoice&&!valid&&<p role="alert">O movimento não corresponde ao recebimento existente ou supera o saldo da fatura. Confira a origem antes de vincular.</p>}
      {error&&<p role="alert">{error}</p>}
    </fieldset>
  </Dialog><UnsavedChangesPrompt guard={guard}/></>;
}
