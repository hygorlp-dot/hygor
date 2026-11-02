import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {accountCashPosition,accountMoneyCents,accountMovementEntries} from '../../domains/financeiro/account-cash.js';
import BankFreshness from './BankFreshness.jsx';

const money=value=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>value?.split('-').reverse().join('/')||'Não informada';

export default function AccountCashPosition({data,ledger,today,account,obraId,state,onChange,onOpen,localPreview=false,showFreshness=true}){
 const bank=(data.contasBancarias||[]).find(b=>String(b.id)===account);
 if(!bank)return <section className="account-cash"><h3>Caixa por conta</h3>{!(data.contasBancarias||[]).length?<p>Nenhuma conta bancária está cadastrada na base carregada. Consulte o cadastro de contas na Conciliação para preparar a abertura e a posição por conta. Os lançamentos existentes continuam disponíveis na previsão.</p>:<p>Selecione uma conta bancária acima para informar a abertura, consultar a posição em uma data e conferir as pendências. Títulos sem conta prevista continuam na fila de conferência.</p>}</section>;
 const draft=state.accountPositions?.[account]||{};
 const {opening='',openingDate='',referenceDate=today}=draft;
 const update=patch=>onChange({accountPositions:{...state.accountPositions,[account]:{...draft,...patch}}});
 const position=accountCashPosition(data,{accountId:account,opening,openingDate,referenceDate});
 const registered=accountMoneyCents(bank.saldoInicial);
 const context=`Caixa da conta ${bank.nome} · empresa inteira · abertura no início de ${date(openingDate)} · posição ao final de ${date(referenceDate)} · apenas movimentos bancários importados · cenário local`;
 const open=(title,items)=>onOpen({title:`${title} · ${bank.nome}`,items:accountMovementEntries(data,ledger,items),context});
 return <section className="account-cash" aria-label={`Caixa por conta · ${bank.nome}`}><h3>{localPreview?'Prévia local · ':''}Caixa por conta · {bank.nome}</h3>
 <p>Posição da conta da empresa inteira{obraId!=='all'?' — inclui movimentos de outras obras':''}. O filtro de obra continua aplicado aos títulos previstos abaixo.</p>
 {showFreshness&&<BankFreshness data={data} accountId={account} referenceDate={referenceDate||today}/>}
 <div className="cash-forecast__controls">
  <label>Saldo de abertura da conta (R$)<Input type="number" step="0.01" value={opening} onChange={e=>update({opening:e.target.value})} aria-invalid={opening!==''&&accountMoneyCents(opening)===null} /></label>
  <label>Data de abertura<Input type="date" value={openingDate} onChange={e=>update({openingDate:e.target.value})} aria-describedby="account-cash-basis" /></label>
  <label>Data de referência do caixa<Input type="date" value={referenceDate} onChange={e=>update({referenceDate:e.target.value})} aria-invalid={!position.validRange&&Boolean(openingDate)} /></label>
 </div>
 <p>Abertura no início do dia; posição ao final da data de referência.</p>
 {registered!==null&&<p>Valor do cadastro: <strong>{money(registered)}</strong>, sem data de saldo registrada. <Button variant="link" onClick={()=>update({opening:String(registered/100)})}>Usar valor cadastrado como abertura</Button></p>}
 <div role="status"><strong>{position.canCalculate?`Posição calculada: ${money(position.balanceCents)}`:'Posição ainda não calculada'}</strong>
 {!position.validRange?<p>Informe datas válidas; a abertura deve ocorrer até a data de referência.</p>:position.openingCents===null?<p>Informe o saldo de abertura, inclusive zero quando for o caso.</p>:position.issues.length?<p>Resolva os movimentos sem data, valor ou identificação válida para calcular a posição.</p>:!position.canCalculate?<p>O valor calculado excede o limite permitido. Confira os valores informados.</p>:<p>Hipótese local baseada nos movimentos disponíveis. Não representa saldo bancário certificado.</p>}</div>
 {position.validRange&&<><dl className="account-cash__totals"><div><dt>Entradas importadas</dt><dd>{money(position.incoming)}</dd></div><div><dt>Saídas importadas</dt><dd>{money(position.outgoing)}</dd></div><div><dt>Referência ao final de</dt><dd>{date(referenceDate)}</dd></div></dl>
 <div className="cash-forecast__actions"><Button variant="outline" onClick={()=>open('Movimentos do período',position.movements)}>Movimentos: {position.movements.length}</Button><Button variant="outline" onClick={()=>open('Pendências de conciliação',position.pending)}>Pendentes de conciliação: {position.pending.length}</Button><Button variant="outline" onClick={()=>open('Vínculos parciais',position.partial)}>Parciais: {position.partial.length}</Button><Button variant="outline" onClick={()=>open('Movimentos ignorados na conciliação',position.ignored)}>Ignorados: {position.ignored.length}</Button></div></>}
 {position.issues.length>0&&<Button variant="outline" onClick={()=>open('Movimentos para conferir',position.issues)}>Conferir dados bancários: {position.issues.length}</Button>}
 <details className="cash-forecast__options"><summary>Base de cálculo e limites</summary><p id="account-cash-basis">Abertura no início do dia informado + entradas − saídas até o final da data de referência, incluindo os dois dias. Não soma títulos pagos novamente. Transferências entram pelo movimento de cada conta. Lacunas nos extratos podem alterar o resultado.</p><p>Parciais estão incluídos nas pendências. Ignorar uma transação na conciliação não elimina seu movimento de caixa. Saldo e datas ficam neste cenário da sessão, sem alterar o cadastro, os extratos ou a simulação de vencimentos.</p></details>
 </section>;
}
