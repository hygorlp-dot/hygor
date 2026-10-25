// Plano e conferência locais do ensaio financeiro remoto. Este módulo não faz
// rede, não lê credenciais, não altera relógio e não grava dados da aplicação.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {SIMULATION_IDS as IDS,SIMULATION_PROJECT,SIMULATION_VERSION} from './fulano-siclano.mjs';
import {advancePaymentStatus} from '../../src/domains/rh/advance-settlements.js';
import {advanceDeductionForPeriod} from '../../src/domains/rh/advance-commands.js';
import {latestClosedPayrollDate} from '../../src/domains/rh/attendance-pay-mode.js';
import {isDateInClosedPeriod} from '../../src/domains/financeiro/workflows.js';
import {buildFinancialLedger,selectAccountsPayable,selectCashFlow} from '../../src/domains/financeiro/ledger.js';
import {buildRequestedDreProjectionRows} from '../../server/dre-projection.js';

export const SCENARIO='qa_adiantamentos_202610_v1';
export const ENDPOINT='https://ponto-homologacao.vercel.app/api/data';
const DATE='2026-10-20',DUE='2026-10-31',MONTH='2026-10';
const BANK='BANCO QA FICTÍCIO — SEM TRANSFERÊNCIA';
const ACCOUNT='CONTA-QA-SIMULACAO-SEM-VALOR';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cents=value=>Math.round(Number(value||0)*100);
const assert=(value,message)=>{if(!value)throw new Error(message);};
const one=(rows,id)=>{
  const matches=(rows||[]).filter(row=>row.id===id);
  assert(matches.length<=1,`Identificador duplicado: ${id}.`);
  return matches[0]||null;
};
const operational=(type,key,payload)=>({action:'operational-command',command:{type,idempotencyKey:key,expectedVersion:0,payload}});

export function remoteAdvancePlan(){
  const people=[{employeeId:IDS.fulano,label:'Fulano',amount:1320},{employeeId:IDS.siclano,label:'Siclano',amount:600}]
    .map(person=>{
      const id=`${SCENARIO}_${person.label.toLowerCase()}`;
      const titleId=`advance:${person.employeeId}:${id}`;
      const parts=['parcial','restante'].map(part=>({
        id:`${id}_${part}`,chave:`${id}_${part}`,data:DATE,
        descricao:`SIMULAÇÃO SEM VALIDADE — ${person.label} — adiantamento ${part}`,
        valor:-person.amount/2,banco:BANK,conta:ACCOUNT,testData:true,simulationScenario:SCENARIO,
      }));
      return {...person,id,titleId,parts,create:operational('ADIANTAMENTO_FOLHA_CRIADO',`${id}_criar`,{advance:{
        id,empId:person.employeeId,date:DATE,firstDueDate:DUE,amount:person.amount,installmentCount:1,frequency:'mensal',
        description:`ADIANTAMENTO FICTÍCIO — ${person.label} — SIMULAÇÃO SEM VALIDADE`,testData:true,simulationScenario:SCENARIO,
      }}),payments:parts.map(part=>({action:'reconciliation-command',command:{type:'CONFIRM_PAYMENT',
        idempotencyKey:`${part.id}_baixar`,payload:{transactionId:part.id,targetType:'tituloFolha',targetId:titleId,
          observacao:'SIMULAÇÃO SEM VALIDADE. Extrato sintético; nenhuma transferência bancária.'}}}))};
    });
  const transactions=people.flatMap(person=>person.parts);
  const statement={id:`${SCENARIO}_extrato`,arquivo:'EXTRATO-FICTICIO-ADIANTAMENTOS-2026-10-20.json',
    banco:BANK,conta:ACCOUNT,hashArquivo:hash(transactions),testData:true,simulationScenario:SCENARIO};
  return {scenario:SCENARIO,endpoint:ENDPOINT,projectId:SIMULATION_PROJECT,environment:'homologacao',
    businessDate:DATE,deductionDate:DUE,competence:MONTH,realTransfer:false,closePayroll:false,
    people,statement,import:operational('TRANSACOES_BANCARIAS_IMPORTADAS',`${SCENARIO}_importar`,{statement,transactions})};
}

const todayInRecife=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function inspectRemoteAdvanceState(data,{today=todayInRecife()}={}){
  const plan=remoteAdvancePlan();
  assert(today>=DATE&&today<=DUE,'Este ensaio exige data real entre 20 e 31/10/2026. Não ajuste o relógio.');
  assert(!isDateInClosedPeriod(data,DATE)&&!isDateInClosedPeriod(data,DUE),'Outubro possui fechamento financeiro; ensaio recusado.');
  const work=one(data.obras,IDS.obraA);
  assert(work?.testData===true,'A obra piloto precisa estar identificada como teste.');
  for(const person of plan.people){
    const employee=one(data.employees,person.employeeId);
    assert(employee?.testData===true&&employee?.simulation?.version===SIMULATION_VERSION,
      `Cadastro de teste ainda não preparado: ${person.employeeId}.`);
    assert(employee.active!==false&&employee.obra===IDS.obraA&&(!employee.endDate||employee.endDate>=today),
      `Cadastro não está ativo na obra de teste: ${person.employeeId}.`);
    assert(employee.employmentRelationship==='clt'&&employee.startDate<=DATE,'Vínculo ou admissão divergente da massa.');
    assert(person.employeeId===IDS.fulano
      ?employee.remunerationMode==='clt'&&cents(employee.monthlySalary)===330000
      :employee.remunerationMode==='daily'&&cents(employee.dailyRate)===12000,'Remuneração divergente da massa preparada.');
    assert(!employee.cltPayroll?.drafts?.[MONTH]?.confirmed,'A competência já possui demonstrativo confirmado.');
    assert(latestClosedPayrollDate(data,employee)<`${MONTH}-01`,'A competência já possui folha fechada ou arquivada.');
  }
  const advanceIds=new Set(plan.people.map(person=>person.id));
  const titleIds=new Set(plan.people.map(person=>person.titleId));
  const transactionIds=new Set(plan.people.flatMap(person=>person.parts.map(part=>part.id)));
  const expectedTransactions=new Map(plan.people.flatMap(person=>person.parts.map(part=>[part.id,part])));
  const expectedKeys=new Set([...expectedTransactions.values()].map(part=>part.chave));
  assert(!(data.transacoes||[]).some(row=>expectedKeys.has(row.chave)&&!transactionIds.has(row.id)),
    'Uma chave bancária deste ensaio já pertence a outro registro.');
  assert(!(data.advances||[]).some(row=>plan.people.some(person=>person.employeeId===row.empId)
    &&row.date===DATE&&!advanceIds.has(row.id)&&!['cancelado','cancelada'].includes(row.status)),
    'Há outro adiantamento na mesma data para a dupla; revise antes de duplicar a simulação.');
  const statement=one(data.extratos,plan.statement.id);
  if(statement)for(const key of ['banco','conta','hashArquivo','testData','simulationScenario']){
    assert(statement[key]===plan.statement[key],`Extrato existente diverge em ${key}.`);
  }
  if(statement)assert(statement.status==='ativo'&&statement.arquivo===plan.statement.arquivo&&statement.qtd===4,'Extrato existente foi alterado.');
  const transactions=[...transactionIds].map(id=>one(data.transacoes,id)).filter(Boolean);
  assert(transactions.length===(statement?4:0),'Extrato incompleto ou transações sem origem identificada.');
  for(const transaction of transactions){
    const expected=expectedTransactions.get(transaction.id);
    for(const key of ['chave','data','descricao','valor','banco','conta','testData','simulationScenario']){
      assert(transaction[key]===expected[key],`Transação existente diverge em ${key}: ${transaction.id}.`);
    }
    assert(transaction.extratoId===plan.statement.id&&['pendente','conciliado'].includes(transaction.status),'Transação foi alterada ou ignorada.');
  }
  const advances=plan.people.map(person=>{
    const advance=one(data.advances,person.id),title=one(data.titulosFolha,person.titleId);
    assert(Boolean(advance)===Boolean(title),'Adiantamento e obrigação financeira estão inconsistentes.');
    if(!advance)return {employeeId:person.employeeId,id:person.id,titleId:person.titleId,exists:false,paidCents:0,balanceCents:cents(person.amount),status:'absent',paidTransactionIds:[],liquidationCount:0};
    for(const key of ['empId','date','firstDueDate','amount','installmentCount','frequency','description','testData','simulationScenario']){
      assert(advance[key]===person.create.command.payload.advance[key],`Adiantamento existente diverge em ${key}.`);
    }
    assert(advance.status==='ativo'&&advance.paymentTitleId===person.titleId,'Adiantamento foi cancelado ou perdeu sua obrigação.');
    assert(advance.installments?.length===1&&advance.installments[0].dueDate===DUE&&cents(advance.installments[0].amount)===cents(person.amount),'Parcelamento divergente da simulação.');
    assert(title.employeeId===person.employeeId&&title.snapshotCalculo?.kind==='advance'&&title.snapshotCalculo.advanceId===person.id,
      'O título existente não corresponde ao adiantamento fictício.');
    assert(title.periodoInicio===DATE&&title.periodoFim===DATE&&title.competencia===MONTH&&cents(title.liquido)===cents(person.amount),'Período ou valor do título divergente.');
    const settlements=title.liquidacoes||[],paidTransactionIds=[];
    for(const settlement of settlements){
      const expected=person.parts.find(part=>part.id===settlement.transacaoId);
      assert(expected&&!paidTransactionIds.includes(expected.id)&&settlement.data===DATE&&cents(settlement.valor)===cents(-expected.valor),
        'Liquidação duplicada, de outra origem ou com data/valor divergente.');
      assert(!['cancelado','cancelada','estornado','estornada','desfeito','reversed'].includes(settlement.status),'Liquidação foi revertida; ensaio não altera histórico.');
      const transaction=one(data.transacoes,expected.id);
      assert(transaction?.status==='conciliado'&&transaction.vinculo?.tipo==='tituloFolha'&&transaction.vinculo.id===title.id,'Liquidação sem vínculo bancário correspondente.');
      const links=(data.reconciliationLinks||[]).filter(link=>link.transacaoId===expected.id);
      assert(links.length===1&&links[0].status==='confirmado'&&links[0].entidadeId===title.id
        &&cents(links[0].valorVinculado)===cents(settlement.valor),'Vínculo de conciliação ausente, alterado ou duplicado.');
      paidTransactionIds.push(expected.id);
    }
    const status=advancePaymentStatus(advance,data),expectedTitleStatus={pending:'em_aberto',partial:'parcial',paid:'pago'}[status.status];
    assert(title.status===expectedTitleStatus&&cents(title.saldo)===cents(status.balance)&&cents(title.valorPago)===cents(status.paid),'Saldo ou situação do título diverge das liquidações.');
    const deduction=advanceDeductionForPeriod(advance,`${MONTH}-01`,DUE,data);
    assert(cents(deduction)===cents(status.paid),'Desconto elegível diverge do valor efetivamente liquidado.');
    return {employeeId:person.employeeId,id:person.id,titleId:person.titleId,exists:true,paidCents:cents(status.paid),balanceCents:cents(status.balance),
      status:status.status,paidTransactionIds,liquidationCount:settlements.length,eligibleDeductionCents:cents(deduction)};
  });
  for(const transaction of transactions.filter(item=>item.status==='conciliado')){
    assert(advances.some(advance=>advance.paidTransactionIds.includes(transaction.id)),'Transação conciliada sem a liquidação esperada.');
  }
  const ledger=buildFinancialLedger(data);
  const scoped={...ledger,events:ledger.events.filter(event=>titleIds.has(event.sourceId)||titleIds.has(event.settlesSourceId))};
  const cash=selectCashFlow(scoped,{}),payable=selectAccountsPayable(scoped,{});
  const paidCents=advances.reduce((sum,advance)=>sum+advance.paidCents,0);
  const balanceCents=advances.filter(advance=>advance.exists).reduce((sum,advance)=>sum+advance.balanceCents,0);
  assert(cash.cashOutCents===paidCents&&payable.balanceCents===balanceCents,'Caixa ou contas a pagar divergem dos adiantamentos.');
  const protectedFields=['employees','attendance','attendanceLocks','rescisoes','fechamentosFinanceiros','folhaArquivos','config'];
  const protectedData=Object.fromEntries(protectedFields.map(key=>[key,data[key]??null]));
  const outsideFinancial={advances:(data.advances||[]).filter(row=>!advanceIds.has(row.id)),titulosFolha:(data.titulosFolha||[]).filter(row=>!titleIds.has(row.id)),
    transacoes:(data.transacoes||[]).filter(row=>!transactionIds.has(row.id)),extratos:(data.extratos||[]).filter(row=>row.id!==plan.statement.id),
    reconciliationLinks:(data.reconciliationLinks||[]).filter(row=>!transactionIds.has(row.transacaoId)),
    ...Object.fromEntries(['pagamentosFolha','payments','outrasDesp','despesasEmpresa','pagsTerceiros','medicoes','pedidos','notasFiscais'].map(key=>[key,data[key]??null]))};
  const costs=buildRequestedDreProjectionRows(data,[{year:2026,month:9,scope:IDS.obraA}])
    .map(row=>({scope:row.scope,total:row.payload.totalCustos,labor:row.payload.moData?.laborCost,benefits:row.payload.moData?.benefitCost}));
  const scopedState={advances:(data.advances||[]).filter(row=>advanceIds.has(row.id)),titulosFolha:(data.titulosFolha||[]).filter(row=>titleIds.has(row.id)),
    transactions,statement:statement||null,reconciliationLinks:(data.reconciliationLinks||[]).filter(row=>transactionIds.has(row.transacaoId))};
  return {today,advances,statementExists:Boolean(statement),transactionCount:transactions.length,cashOutCents:cash.cashOutCents,payableCents:payable.balanceCents,
    protectedHash:hash(protectedData),outsideFinancialHash:hash(outsideFinancial),costs,scopedHash:hash(scopedState),
    operationalKeys:(data.operationalCommandReceipts||[]).map(row=>row.idempotencyKey).filter(key=>String(key).startsWith(SCENARIO)),
    reconciliationKeys:(data.reconciliationCommandLog||[]).map(row=>row.idempotencyKey).filter(key=>String(key).startsWith(SCENARIO))};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const mode=process.argv[2]||'plan';
    if(mode==='plan')process.stdout.write(JSON.stringify(remoteAdvancePlan()));
    else if(mode==='inspect')process.stdout.write(JSON.stringify(inspectRemoteAdvanceState(JSON.parse(readFileSync(0,'utf8')))));
    else throw new Error('Use plan ou inspect.');
  }catch(error){process.stderr.write(String(error.message)+'\n');process.exitCode=1;}
}
