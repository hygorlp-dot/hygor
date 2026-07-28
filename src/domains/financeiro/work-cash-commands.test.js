import { describe, expect, it } from "vitest";
import { applyWorkCashCommand, WORK_CASH_COMMAND, workCashCommandObraId } from "./work-cash-commands.js";

const now="2026-07-28T12:00:00.000Z";
const command=(type,payload,expectedVersion)=>({
  type,payload,expectedVersion,actorId:"u-1",actorName:"Financeiro",now,
});
const base=()=>({obras:[{id:"o-1",hasCaixa:true}],caixaObra:[]});

describe("comandos do caixa de obra",()=>{
  it("registra aporte e despesa com autoria e versão",()=>{
    const aporte=applyWorkCashCommand(base(),command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      {movement:{id:"m-1",obraId:"o-1",data:"2026-07-28",tipo:"aporte",valor:1000,descricao:"Aporte"}},
      0,
    ),now);
    expect(aporte.data.caixaObra[0]).toMatchObject({
      id:"m-1",efeitoDRE:"sem_efeito",version:1,registradoPorId:"u-1",
    });
    const despesa=applyWorkCashCommand(aporte.data,command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      {movement:{id:"m-2",obraId:"o-1",data:"2026-07-28",tipo:"despesa",valor:400,descricao:"Material"}},
      0,
    ),now);
    expect(despesa.data.caixaObra[1]).toMatchObject({
      id:"m-2",efeitoDRE:"custo_obra",version:1,
    });
    expect(workCashCommandObraId(despesa.data,command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,{movementId:"m-2"},1,
    ))).toBe("o-1");
  });

  it("bloqueia caixa desativado, saldo negativo e cancelamento conciliado",()=>{
    const disabled=base();disabled.obras[0].hasCaixa=false;
    expect(applyWorkCashCommand(disabled,command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      {movement:{id:"m-1",obraId:"o-1",data:"2026-07-28",tipo:"aporte",valor:100}},
    ),now).reason).toMatch(/não está ativado/);
    expect(applyWorkCashCommand(base(),command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CREATED,
      {movement:{id:"m-1",obraId:"o-1",data:"2026-07-28",tipo:"despesa",valor:100}},
    ),now).reason).toMatch(/saldo suficiente/);
    const linked={...base(),caixaObra:[{
      id:"m-1",obraId:"o-1",data:"2026-07-28",tipo:"aporte",valor:100,
      status:"ativo",version:1,transacaoId:"tx-1",
    }]};
    expect(applyWorkCashCommand(linked,command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,{movementId:"m-1",reason:"Erro"},1,
    ),now).reason).toMatch(/Desfaça a conciliação/);
  });

  it("cancela sem apagar e rejeita versão obsoleta",()=>{
    const initial={...base(),caixaObra:[{
      id:"m-1",obraId:"o-1",data:"2026-07-28",tipo:"aporte",valor:100,
      status:"ativo",version:2,
    }]};
    expect(applyWorkCashCommand(initial,command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,{movementId:"m-1",reason:"Erro"},1,
    ),now).reason).toMatch(/alterado por outra pessoa/);
    const cancelled=applyWorkCashCommand(initial,command(
      WORK_CASH_COMMAND.WORK_CASH_MOVEMENT_CANCELLED,{movementId:"m-1",reason:"Erro"},2,
    ),now);
    expect(cancelled.data.caixaObra[0]).toMatchObject({
      status:"cancelado",version:3,motivoCancelamento:"Erro",canceladoPorId:"u-1",
    });
  });
});
