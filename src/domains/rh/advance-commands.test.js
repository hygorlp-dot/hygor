import { describe,expect,it } from "vitest";
import {
  ADVANCE_COMMAND,advanceDeductionForPeriod,applyAdvanceCommand,buildAdvanceInstallments,
} from "./advance-commands.js";

describe("adiantamentos parcelados",()=>{
  it("divide os centavos sem perder o total e alterna as quinzenas",()=>{
    const rows=buildAdvanceInstallments({
      advanceId:"a1",amount:1000,installmentCount:3,
      firstDueDate:"2026-08-05",frequency:"quinzenal",
    });
    expect(rows).toEqual([
      {id:"a1:parcela:1",number:1,dueDate:"2026-08-05",amount:333.33,status:"programada"},
      {id:"a1:parcela:2",number:2,dueDate:"2026-08-20",amount:333.33,status:"programada"},
      {id:"a1:parcela:3",number:3,dueDate:"2026-09-05",amount:333.34,status:"programada"},
    ]);
    expect(rows.reduce((sum,item)=>sum+item.amount,0)).toBe(1000);
  });

  it("aceita funcionário administrativo sem obra e desconta só a parcela do período",()=>{
    const command={
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,
      idempotencyKey:"advance-admin-0001",expectedVersion:0,
      actorId:"rh-1",actorName:"RH",
      payload:{advance:{
        id:"a1",empId:"e1",date:"2026-07-29",amount:600,
        installmentCount:3,firstDueDate:"2026-08-05",frequency:"quinzenal",
      }},
    };
    const result=applyAdvanceCommand({
      employees:[{id:"e1",name:"Administrativo",workArea:"administrativo",obra:"",active:true}],
      advances:[],
    },command,"2026-07-29T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.advances[0]).toMatchObject({
      empId:"e1",amount:600,installmentCount:3,status:"ativo",
    });
    expect(advanceDeductionForPeriod(result.data.advances[0],"2026-07-21","2026-08-05")).toBe(200);
    expect(advanceDeductionForPeriod(result.data.advances[0],"2026-08-06","2026-08-20")).toBe(200);
  });

  it("cancelamento preserva o registro e zera descontos futuros",()=>{
    const created=applyAdvanceCommand({
      employees:[{id:"e1",name:"Campo",obra:"o1",active:true}],advances:[],
    },{
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CREATED,actorId:"rh",actorName:"RH",
      payload:{advance:{id:"a1",empId:"e1",date:"2026-07-29",amount:100,
        installmentCount:1,firstDueDate:"2026-08-05"}},expectedVersion:0,
    },"2026-07-29T12:00:00.000Z");
    const cancelled=applyAdvanceCommand(created.data,{
      type:ADVANCE_COMMAND.PAYROLL_ADVANCE_CANCELLED,actorId:"rh",actorName:"RH",
      payload:{advanceId:"a1",reason:"Lançamento incorreto"},expectedVersion:1,
    },"2026-07-29T13:00:00.000Z");
    expect(cancelled.data.advances).toMatchObject([{
      id:"a1",status:"cancelado",motivoCancelamento:"Lançamento incorreto",
    }]);
    expect(advanceDeductionForPeriod(cancelled.data.advances[0],"2026-07-21","2026-08-05")).toBe(0);
  });
});
