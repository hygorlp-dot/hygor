import {useMemo,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {previewImportedAccount} from '../../domains/financeiro/account-cash-preview.js';
import {accountMovementEntries,accountMoneyCents} from '../../domains/financeiro/account-cash.js';
import AccountCashPosition from './AccountCashPosition.jsx';
import BankFreshness from './BankFreshness.jsx';

export default function LocalAccountCashPreview({data,ledger,today,obraId,onOpen,state:controlledState,onStateChange}){
 const preview=useMemo(()=>previewImportedAccount(data),[data]);
 const [localState,setLocalState]=useState({accountPositions:{}});
 const state=controlledState??localState,setState=onStateChange??setLocalState;
 if(preview.error)return <section className="local-account-preview" role="status"><h3>Prévia local indisponível</h3><p>{preview.error}</p><p>Os dados originais foram preservados.</p></section>;
 const {account}=preview;
 const viewState={accountPositions:{[account.id]:{opening:'',openingDate:'',referenceDate:'',...state.accountPositions[account.id]}}};
 const open=(title,transactions)=>onOpen({title:`${title} · prévia da conta final 9896`,context:'Prévia local, não aplicada · banco e conta identificados nos metadados dos extratos · todos os períodos importados, independente das datas da simulação · situações e valores originais preservados',items:accountMovementEntries(preview.data,ledger,transactions.map(transaction=>({transaction,cents:accountMoneyCents(transaction.valor)})))});
 return <section className="local-account-preview" aria-label="Prévia local da conta final 9896" data-movement-count={preview.movements.length}>
  <header><h3>Prévia local · conta final 9896</h3><p role="status">Cadastro e vínculos simulados somente nesta tela. Nada foi gravado na empresa.</p></header>
  <BankFreshness data={preview.data} accountId={account.id} referenceDate={viewState.accountPositions[account.id].referenceDate||today}/>
  <details className="cash-forecast__options"><summary>Identificação e campos não confirmados</summary><div className="cash-forecast__controls">
   {[['Banco',account.banco],['Conta de origem',account.conta],['Agência',''],['Titular',''],['CPF/CNPJ do titular',''],['Tipo de conta',''],['Situação da conta',''],['Chave PIX','']].map(([label,value])=><label key={label}>{label}<Input value={value} readOnly/></label>)}
  </div><p>Banco e número da conta foram preservados na importação. Agência, titularidade, tipo, situação e PIX ainda precisam de confirmação; permanecem em branco. Os OFX originais não foram reinspecionados.</p></details>
  <p>{preview.statements.length} extratos · {preview.statements.filter(s=>s.status==='arquivado').length} arquivados · {preview.movements.length} movimentos com vínculo simulado. Os títulos da previsão não receberam conta prevista.</p>
  <div className="cash-forecast__actions"><Button variant="outline" onClick={()=>open('Movimentos dos extratos',preview.movements)}>Revisar {preview.movements.length} movimentos</Button><Button variant="outline" onClick={()=>open('Pendências de conciliação',preview.pending)}>Pendentes na prévia: {preview.pending.length}</Button><Button variant="outline" onClick={()=>open('Movimentos conciliados',preview.reconciled)}>Conciliados: {preview.reconciled.length}</Button><Button variant="outline" onClick={()=>open('Movimentos ignorados',preview.ignored)}>Ignorados na prévia: {preview.ignored.length}</Button></div>
  <details className="cash-forecast__options"><summary>Extratos usados e conferência de repetições</summary><ul>{preview.statements.map(s=><li key={s.id}>{s.arquivo} · {s.dataInicio} a {s.dataFim} · {s.status}</li>)}</ul><p>{preview.repeatedGroups.length} grupos com data, valor e descrição iguais. São alertas de conferência; nenhum movimento foi excluído ou conciliado.</p><Button variant="outline" onClick={()=>open('Conferência de movimentos semelhantes',preview.repeatedGroups.flat())}>Revisar movimentos semelhantes</Button></details>
  <AccountCashPosition localPreview showFreshness={false} data={preview.data} ledger={ledger} today={today} account={account.id} obraId={obraId} state={viewState} onChange={patch=>setState(previous=>({...previous,...patch}))} onOpen={detail=>onOpen({...detail,context:`Prévia local, não aplicada · ${detail.context}`})}/>
  <Button variant="outline" onClick={()=>setState({accountPositions:{}})}>Limpar saldo e datas da prévia</Button>
 </section>;
}
