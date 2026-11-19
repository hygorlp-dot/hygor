import {useRef,useState} from 'react';
import {Dialog} from '../../design-system/primitives/Dialog.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {Button} from '../../components/ui/button.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {contar} from '../../design-system/copy.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {fmt} from '../../legacy/format.js';
import {BANK_TRANSACTION_COMMAND,matchesStatementAccount,planStatementAccountLink} from '../../domains/conciliacao/transaction-commands.js';
import {useHelpTopic} from '../help/HelpContext.jsx';
import {HelpButton} from '../help/HelpButton.jsx';

export default function BankStatementLink({data,statement,onClose,onCreate,onSave}){
  useHelpTopic('conc','conc_vincular_ofx',1);
  const [accountId,setAccountId]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const attempt=useRef(null);
  const accounts=(data.contasBancarias||[]).filter(account=>matchesStatementAccount(statement,account));
  const plan=accountId?planStatementAccountLink(data,statement.id,accountId):null;
  const proof=(data.dreOfxEvidence||[]).find(row=>row.id===String(statement.id));
  const rows=(data.transacoes||[]).filter(row=>row.extratoId===statement.id);
  const save=async()=>{
    if(!plan?.ok||busy)return;
    const payload={statementId:statement.id,accountId,expectedVersion:Number(statement.version||0),expectedCount:plan.rows.length};
    const signature=JSON.stringify(payload);
    if(attempt.current?.signature!==signature)attempt.current={signature,key:`bank-link-${crypto.randomUUID()}`};
    setBusy(true);setError('');
    try{
      const result=await onSave({type:BANK_TRANSACTION_COMMAND.BANK_STATEMENT_ACCOUNT_LINKED,idempotencyKey:attempt.current.key,payload});
      if(!result?.ok)throw new Error(result?.reason||result?.error||'O vínculo não foi confirmado. Atualize a tela e tente novamente.');
      onClose();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  };
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}} title="Vincular extrato à conta">
    <div className="grid gap-3">
      <HelpButton pageId="conc_vincular_ofx" allowedTabs={['conc']} label="Ajuda do vínculo"/>
      <div><strong className="break-words">{statement.arquivo}</strong><p>{contar(rows.length,'movimento importado','movimentos importados')}</p></div>
      {statement.dataInicio&&statement.dataFim&&<p>Datas dos movimentos · {financialDateLabel(statement.dataInicio)} a {financialDateLabel(statement.dataFim)}</p>}
      {proof?<div><p>Cobertura declarada no OFX · {financialDateLabel(proof.start)} a {financialDateLabel(proof.end)}</p>
        <p>Saldo informado pelo banco em {financialDateLabel(proof.end)} · <strong>{fmt(proof.balanceCents/100)}</strong></p>
      </div>:<p role="status">Saldo do banco indisponível para este lote. Compare com o extrato oficial antes de fechar o período.</p>}
      <p>O vínculo mantém os movimentos, as classificações e o histórico da importação.</p>
      {accounts.length>0?<Select label="Conta bancária" value={accountId} disabled={busy} onChange={event=>{setAccountId(event.target.value);setError('');}}
        options={[{value:'',label:'Selecione a conta conferida'},...accounts.map(row=>({value:String(row.id),label:row.nome}))]}/>
        :<p>Nenhuma conta ativa tem o mesmo banco e número informados no extrato.</p>}
      {(error||plan?.ok===false)&&<Alert variant="warning"><AlertDescription>{error||plan.reason}</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
        {accounts.length>0?<Button disabled={busy||!plan?.ok} onClick={()=>void save()}>{busy?'Vinculando…':'Confirmar vínculo'}</Button>
          :<Button onClick={onCreate} disabled={busy||!statement.conta||!statement.banco}>Cadastrar conta do extrato</Button>}
      </div>
    </div>
  </Dialog>;
}
