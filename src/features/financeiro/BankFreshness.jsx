import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import {bankFreshness} from '../../domains/financeiro/bank-freshness.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
const importLabel=value=>!value?'Não informada':value.length===10?financialDateLabel(value):new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Bahia'}).format(new Date(value))+' (Bahia)';
export default function BankFreshness({data,accountId,referenceDate}){
 const info=bankFreshness(data,accountId,referenceDate);
 return <section className="bank-freshness" aria-label="Atualização bancária">
  <dl className="account-cash__totals"><div><dt>Último movimento bancário conhecido</dt><dd>{financialDateLabel(info.latestMovement,'Não informado')}</dd></div><div><dt>Última importação registrada</dt><dd>{importLabel(info.latestImport)}</dd></div></dl>
  {(!info.latestMovement||info.referenceAfterLatest)&&<Alert variant="warning" role="status"><AlertDescription>{info.latestMovement?`A referência consultada é posterior ao último movimento conhecido (${financialDateLabel(info.latestMovement)}). A cobertura bancária após essa data não está comprovada.`:'Não há movimentos bancários com data válida disponíveis nesta conta.'} Ausência de dados importados não significa ausência de movimentação.</AlertDescription></Alert>}
  <p>Essas datas indicam os registros disponíveis; não comprovam cobertura contínua dos extratos nem saldo conferido com o banco.</p>
 </section>;
}
