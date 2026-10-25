// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {createLocalSimulation} from '../../scripts/simulacao/fulano-siclano.mjs';
import {inspectRemoteAdvanceState,remoteAdvancePlan} from '../../scripts/simulacao/adiantamentos-homologacao.mjs';
import {applyOperationalCommand} from '../../src/domains/sync/operational-commands.js';
import {applyReconciliationCommand} from '../../server/reconciliation-command.js';

const inspect=data=>inspectRemoteAdvanceState(data,{today:'2026-10-25'});
const actor={id:'qa-admin',nome:'Administrador QA',role:'admin'};
const apply=(data,body)=>{
  if(body.action==='operational-command'){
    const result=applyOperationalCommand(data,{...body.command,actorId:actor.id,actorName:actor.nome});
    expect(result.ok,result.reason).toBe(true);
    const repeat=applyOperationalCommand(result.data,{...body.command,actorId:actor.id,actorName:actor.nome});
    expect(repeat.idempotent).toBe(true);expect(repeat.data).toEqual(result.data);
    return result.data;
  }
  const result=applyReconciliationCommand(data,body.command,actor);
  expect(result.resumo.ok,result.resumo.motivo).toBe(true);return result.data;
};
const prepare=()=>{
  const plan=remoteAdvancePlan();let data=createLocalSimulation();
  for(const person of plan.people)data=apply(data,person.create);
  data=apply(data,plan.import);return {data,plan};
};

describe('plano remoto de adiantamentos fictícios',()=>{
  it('limita o plano aos dois adiantamentos, quatro saídas sintéticas e nenhum fechamento',()=>{
    const plan=remoteAdvancePlan();
    expect(plan.people.map(person=>person.amount)).toEqual([1320,600]);
    expect(plan.import.command.payload.transactions.map(row=>row.valor)).toEqual([-660,-660,-300,-300]);
    expect(plan.businessDate).toBe('2026-10-20');expect(plan.deductionDate).toBe('2026-10-31');
    expect(plan.closePayroll).toBe(false);expect(plan.realTransfer).toBe(false);
    expect(plan.people.flatMap(person=>person.payments).every(body=>body.command.type==='CONFIRM_PAYMENT')).toBe(true);
  });
  it('aplica os comandos reais: obrigação sem pagamento, parcial, quitação e DRE preservado',()=>{
    const plan=remoteAdvancePlan();let data=createLocalSimulation();const baseline=inspect(data);
    for(const person of plan.people)data=apply(data,person.create);
    let state=inspect(data);expect(state.payableCents).toBe(192000);expect(state.cashOutCents).toBe(0);
    expect(state.advances.map(row=>row.eligibleDeductionCents)).toEqual([0,0]);
    data=apply(data,plan.import);expect(inspect(data).transactionCount).toBe(4);
    data=apply(data,plan.people[0].payments[0]);state=inspect(data);
    expect(state.advances[0]).toMatchObject({status:'partial',paidCents:66000,balanceCents:66000,liquidationCount:1});
    for(const payment of [plan.people[0].payments[1],...plan.people[1].payments])data=apply(data,payment);
    state=inspect(data);expect(state.cashOutCents).toBe(192000);expect(state.payableCents).toBe(0);
    expect(state.advances.map(row=>[row.status,row.liquidationCount])).toEqual([['paid',2],['paid',2]]);
    expect(state.costs).toEqual(baseline.costs);expect(state.protectedHash).toBe(baseline.protectedHash);
    expect(state.outsideFinancialHash).toBe(baseline.outsideFinancialHash);
  });
  it('recusa cadastro real, massa incompleta e remuneração alterada',()=>{
    const data=createLocalSimulation();data.employees[0].testData=false;
    expect(()=>inspect(data)).toThrow(/Cadastro de teste/);
    data.employees[0].testData=true;delete data.employees[0].simulation.version;
    expect(()=>inspect(data)).toThrow(/Cadastro de teste/);
    const changed=createLocalSimulation();changed.employees[1].dailyRate=130;
    expect(()=>inspect(changed)).toThrow(/Remuneração divergente/);
  });
  it('recusa execução fora da janela real e competência financeira fechada',()=>{
    const data=createLocalSimulation();
    for(const today of ['2026-10-19','2026-11-01'])expect(()=>inspectRemoteAdvanceState(data,{today})).toThrow(/data real/);
    data.fechamentosFinanceiros=[{dataInicio:'2026-10-01',dataFim:'2026-10-31',status:'fechado'}];
    expect(()=>inspect(data)).toThrow(/fechamento financeiro/);
  });
  it('recusa extrato com banco diferente, chave de outro registro e adiantamento concorrente',()=>{
    const {data,plan}=prepare();data.extratos[0].banco='Banco diferente';
    expect(()=>inspect(data)).toThrow(/diverge em banco/);
    const collision=createLocalSimulation();collision.transacoes=[{id:'fora-do-ensaio',chave:plan.people[0].parts[0].chave}];
    expect(()=>inspect(collision)).toThrow(/outro registro/);
    const other=createLocalSimulation();other.advances=[{id:'outro',empId:plan.people[0].employeeId,date:'2026-10-20',status:'ativo'}];
    expect(()=>inspect(other)).toThrow(/outro adiantamento/);
  });
  it('recusa duplicação de liquidação e divergência de saldo',()=>{
    let {data,plan}=prepare();data=apply(data,plan.people[0].payments[0]);
    const duplicate=structuredClone(data);duplicate.titulosFolha[0].liquidacoes.push({...duplicate.titulosFolha[0].liquidacoes[0],id:'duplicada'});
    expect(()=>inspect(duplicate)).toThrow(/Liquidação duplicada/);
    data.titulosFolha[0].saldo=0;expect(()=>inspect(data)).toThrow(/Saldo ou situação/);
  });
  it('modo padrão do cliente apenas prepara plano, mesmo com caminho de acesso inexistente',()=>{
    const result=spawnSync('python3',['scripts/simulacao/simular-adiantamentos-homologacao.py','--access','/nao-existe/credenciais.json'],{cwd:process.cwd(),encoding:'utf8'});
    expect(result.status,result.stderr).toBe(0);
    const output=JSON.parse(result.stdout);expect(output.mode).toBe('plan_only');expect(output.executed).toBe(false);
    expect(output.plan.people).toHaveLength(2);
  });
});
