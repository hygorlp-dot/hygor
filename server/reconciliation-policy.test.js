import { describe,expect,it } from "vitest";
import { RECONCILIATION_COMMAND } from "./reconciliation-command.js";
import { authorizeReconciliationCommand } from "./reconciliation-policy.js";

const data={
  obras:[{id:"o1"},{id:"o2"}],
  employees:[{id:"e1",obra:"o1"}],
  titulosFolha:[{id:"f1",employeeId:"e1"}],
  transacoes:[{id:"pix",valor:-1000,status:"pendente"},{id:"entrada",valor:1000,status:"pendente"}],
};
const rh={id:"rh",role:"rh"};

describe("política de conciliação do RH",()=>{
  it("permite pagamento de mão de obra vinculado a funcionário e obra",()=>{
    const result=authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,
      payload:{transactionId:"pix",worker:{employeeId:"e1"},allocations:[{destination:"obra",obraId:"o1",category:"mao_obra",value:1000}]},
    },rh);
    expect(result).toEqual({ok:true});
  });

  it("bloqueia entrada, despesa empresarial e obra fora do escopo",()=>{
    expect(authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,
      payload:{transactionId:"entrada",worker:{employeeId:"e1"},allocations:[{destination:"obra",obraId:"o1",category:"mao_obra",value:1000}]},
    },rh).ok).toBe(false);
    expect(authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,
      payload:{transactionId:"pix",worker:{employeeId:"e1"},allocations:[{destination:"empresa",category:"outros",value:1000}]},
    },rh).ok).toBe(false);
    expect(authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_ALLOCATION,
      payload:{transactionId:"pix",worker:{employeeId:"e1"},allocations:[{destination:"obra",obraId:"o1",category:"mao_obra",value:1000}]},
    },{...rh,obraId:"o2"}).ok).toBe(false);
  });

  it("permite títulos de folha e nega fornecedores e estornos",()=>{
    expect(authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"pix",targetType:"tituloFolha",targetId:"f1"},
    },rh).ok).toBe(true);
    expect(authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_PAYMENT,payload:{transactionId:"pix",targetType:"pedido",targetId:"p1"},
    },rh).ok).toBe(false);
    expect(authorizeReconciliationCommand(data,{
      type:RECONCILIATION_COMMAND.CONFIRM_REVERSAL,payload:{transactionId:"pix"},
    },rh).ok).toBe(false);
  });
});
