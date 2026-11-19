import {describe,expect,it} from "vitest";
import {applyReconciliationCommand,RECONCILIATION_COMMAND as RC} from "../../../server/reconciliation-command.js";
import {authorizeReconciliationCommand} from "../../../server/reconciliation-policy.js";
import {accountCashPosition} from "./account-cash.js";
import {buildFinancialLedger,selectCashFlow,selectDRE} from "./ledger.js";
import {calculateWorkCash} from "./work-cash.js";
import {applyWorkCashCommand,WORK_CASH_COMMAND as WC} from "./work-cash-commands.js";

const actor={id:"finance",nome:"Financeiro QA",role:"financeiro",active:true};
const openingDate="2026-11-01",referenceDate="2026-11-19";
const initial=()=>({
  obras:[{id:"work",hasCaixa:true},{id:"other",hasCaixa:true},{id:"off",hasCaixa:false}],
  transacoes:[
    {id:"fund",data:"2026-11-16",descricao:"Envio à obra",valor:-1000,contaBancariaId:"bank",status:"pendente"},
    {id:"return",data:"2026-11-19",descricao:"Devolução da obra",valor:100,contaBancariaId:"bank",status:"pendente"},
  ],
});
const transfer=(transactionId,workCashObraId="work")=>({type:RC.CONFIRM_TRANSFER,payload:{transactionId,workCashObraId}});
const run=(data,command)=>applyReconciliationCommand(data,command,actor);
const expense=data=>applyWorkCashCommand(data,{
  actorId:actor.id,actorName:actor.nome,type:WC.WORK_CASH_MOVEMENT_CREATED,
  payload:{movement:{id:"expense",obraId:"work",tipo:"despesa",data:"2026-11-18",valor:250,comprovante:"NF QA-1"}},
});

describe("do banco ao caixa da obra e ao DRE",()=>{
  it("registra o repasse e a devolução nos dois extratos e apropria apenas a despesa",()=>{
    const base=initial();
    const bank=run(base,transfer("fund"));
    expect(bank.resumo.ok).toBe(true);
    const funded=bank.data;
    expect(base.transacoes[0].status).toBe("pendente");
    expect(funded.transacoes[0]).toMatchObject({status:"conciliado",vinculo:{tipo:"transferencia_caixa_obra",id:funded.caixaObra[0].id,obraId:"work"}});
    expect(funded.caixaObra[0]).toMatchObject({transacaoId:"fund",tipo:"aporte",naturezaEntrada:"transferencia_empresa",valor:1000});
    expect(run(funded,transfer("fund")).resumo.ok).toBe(false);
    expect(calculateWorkCash(funded,"work").saldo).toBe(1000);
    expect(selectDRE(buildFinancialLedger(funded))).toMatchObject({revenueCents:0,costCents:0});

    const spent=expense(funded).data;
    const returned=run(spent,transfer("return")).data;
    expect(calculateWorkCash(returned,"work")).toMatchObject({saldo:650,totalAportes:1000,totalDespesas:250,totalDevolucoes:100});
    expect(calculateWorkCash(returned,"other").saldo).toBe(0);
    expect(accountCashPosition(returned,{accountId:"bank",opening:1500,openingDate,referenceDate})).toMatchObject({
      outgoing:100000,incoming:10000,balanceCents:60000,
    });
    const ledger=buildFinancialLedger(returned);
    const dre=selectDRE(ledger,{obraId:"work",competence:"2026-11"});
    expect(dre).toMatchObject({revenueCents:0,costCents:25000});
    expect(dre.events.map(event=>event.sourceId)).toEqual(["expense"]);
    expect(selectCashFlow(ledger,{obraId:"work"})).toMatchObject({cashInCents:100000,cashOutCents:35000,balanceCents:65000});
    expect(selectCashFlow(ledger)).toMatchObject({cashInCents:0,cashOutCents:25000});

    const reverse={type:RC.REVERSE_RECONCILIATION,payload:{transactionId:"fund",reason:"Conferência QA"}};
    expect(run(returned,reverse).resumo).toMatchObject({ok:false,motivo:expect.stringContaining("negativo")});
    const undone=run(returned,{...reverse,payload:{...reverse.payload,transactionId:"return"}});
    expect(undone.data.caixaObra.find(row=>row.transacaoId==="return")).toMatchObject({status:"estornado"});
    expect(calculateWorkCash(undone.data,"work").saldo).toBe(750);
    expect(selectDRE(buildFinancialLedger(undone.data))).toMatchObject({costCents:25000});
  });

  it("valida perfil, escopo, caixa ativo e valor da devolução",()=>{
    const data=initial();
    expect(authorizeReconciliationCommand(data,transfer("fund"),actor)).toMatchObject({ok:true});
    expect(authorizeReconciliationCommand(data,transfer("fund"),{...actor,obraId:"other"})).toMatchObject({ok:false});
    expect(authorizeReconciliationCommand(data,transfer("fund"),{...actor,role:"engenheiro"})).toMatchObject({ok:false});
    expect(run(data,transfer("fund","off")).resumo.ok).toBe(false);
    expect(run(data,transfer("return")).resumo.ok).toBe(false);
  });
});
