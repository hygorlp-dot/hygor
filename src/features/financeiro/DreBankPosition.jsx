import {useMemo} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {PageHeader} from '../../design-system/patterns/PageHeader.jsx';
import {Select} from '../../design-system/primitives/Select.jsx';
import {contar} from '../../design-system/copy.js';
import {dreBankPeriod,dreAccountPosition,dreOfxPosition} from '../../domains/financeiro/dre-bank-position.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {fmt} from '../../legacy/format.js';
import './dre-bank-position.css';

const amount=value=>value==null?'Indisponível':fmt(value/100);
const date=value=>financialDateLabel(value);

export default function DreBankPosition({data,year,month,today,selectedAccount,onAccountChange,onReconcile}){
  const source=data.dreBankSource||data;
  const period=useMemo(()=>dreBankPeriod(year,month,today),[year,month,today]);
  const accounts=(source.contasBancarias||[]).filter(account=>account.id);
  const statements=(data.dreOfxEvidence||[]).filter(item=>!item.accountId&&period.start<=period.end&&item.start<=period.start&&period.start<=item.end)
    .sort((a,b)=>b.end.localeCompare(a.end));
  const options=[...statements.map(statement=>({id:`ofx:${statement.id}`,nome:`OFX sem conta · ${date(statement.end)}`,statement})),...accounts];
  const account=options.find(item=>String(item.id)===selectedAccount)||options.find(item=>item.ativa!==false)||options[0];
  const accountId=account?String(account.id):'';
  const statement=account?.statement;
  const position=useMemo(()=>{
    if(!accountId)return null;
    const inputs={...source,transacoes:data.transacoes,caixaObra:data.caixaObra};
    return statement?dreOfxPosition(inputs,statement,period):dreAccountPosition(inputs,accountId,period,data.dreOfxEvidence);
  },[source,data.transacoes,data.caixaObra,data.dreOfxEvidence,period,accountId,statement]);
  const hasPeriod=position&&position.state!=='future';
  const end=position?.reference||period.end;
  const note=position&&{
    missing:'Falta um fechamento com saldo informado pelo banco. Confira o extrato na Conciliação.',
    future:'Ainda não há movimentação bancária para este mês.',
    invalid:'Há movimentos com dados inválidos ou repetidos. Confira o extrato na Conciliação.',
    divergent:'O saldo do fechamento diverge dos movimentos ou de outro fechamento. Confira o extrato na Conciliação.',
    checked:`Saldo final conferido com o valor bancário informado no fechamento de ${date(position.asOf)}.`,
    estimated:`Posição calculada a partir do fechamento de ${date(position.asOf)} e dos movimentos importados. Confira a cobertura do extrato.`,
    statement:`Saldo final informado pelo banco no OFX de ${date(position.asOf)}. Saldo inicial calculado pelos movimentos do extrato.`,
    'statement-calculated':`Saldos calculados pelos movimentos e pelo saldo informado no OFX de ${date(position.asOf)}.`,
  }[position.state];
  const figures=hasPeriod?[
    ['Saldo inicial',position.opening],['Entradas',position.incoming],['Aportes de sócios',position.contributions],
    ['Saídas',position.outgoing],['Saldo final',position.ending],
  ]:[];
  const title=account?`${account.nome} · ${date(period.start)} a ${date(end)}`:'Saldo em conta';
  return <section className="dre-bank-position" aria-label="Saldo em conta">
    <PageHeader title="Saldo em conta" headingLevel={2} description="Movimentação bancária do mês selecionado." secondaryActions={onReconcile&&<Button variant="outline" onClick={()=>onReconcile(hasPeriod?{accountId:statement?'unassigned':accountId,statementId:statement?.id,start:period.start,end,label:title}:null)}>Abrir Conciliação</Button>}/>
    {account?<>
      <div className="dre-bank-position__scope">
        <Select label={statements.length?'Conta ou extrato':'Conta bancária'} value={accountId} onChange={event=>onAccountChange(event.target.value)} options={options.map(item=>({value:String(item.id),label:`${item.nome}${item.ativa===false?' (inativa)':''}`}))}/>
        {hasPeriod&&<p>{date(period.start)} a {date(end)}</p>}
      </div>
      {hasPeriod&&<dl className="dre-bank-position__figures">
        {figures.map(([label,value])=><div key={label}><dt>{label}{label==='Aportes de sócios'&&<small>Já incluídos nas entradas</small>}</dt><dd data-negative={value<0}>{amount(value)}</dd></div>)}
      </dl>}
      <div className="dre-bank-position__note" role="status">
        <p>{note}</p>
        {hasPeriod&&position.pending>0&&<p>{contar(position.pending,'movimento pendente de conciliação','movimentos pendentes de conciliação')}.</p>}
        {hasPeriod&&position.archived>0&&<p>{contar(position.archived,'movimento de extrato arquivado','movimentos de extratos arquivados')} no saldo. Confira a origem em Extratos na Conciliação.</p>}
        {hasPeriod&&position.incoming!==null&&position.movements===0&&<p>Sem movimentos importados neste período.</p>}
        {hasPeriod&&position.incoming!==null&&position.contributions===null&&<p>Os valores classificados como aporte precisam de conferência.</p>}
      </div>
    </>:<p className="dre-bank-position__note">Saldo indisponível. Vincule uma conta na Conciliação ou confira se há um OFX com saldo bancário que cubra o período.</p>}
  </section>;
}
