import { describe, expect, it } from "vitest";
import { analisarMovimentoConciliacao, priorizarFilaConciliacao, resumoQuinzenaConciliacao } from "./engine.js";

const data={
  employees:[{id:"e1",name:"Ana Silva",pixKey:"pix-ana",cpf:"123.456.789-00",obra:"o1"},{id:"e2",name:"Ana Silva",pixKey:"pix-ana"}],
  notasFiscais:[{id:"n1",numero:"NF-1",valorLiquido:100,pagamentos:[],fornecedorNome:"Fornecedor"}],pedidos:[],medicoes:[],medicoesTerc:[],terceirizados:[],caixaObra:[],transacoes:[],titulosFolha:[],
};
describe("contrato canônico de conciliação",()=>{
  it("bloqueia uma chave PIX duplicada e retorna o contrato auditável",()=>{
    const result=analisarMovimentoConciliacao({id:"t1",valor:-100,data:"2026-07-20",chavePix:"pix-ana"},data);
    expect(result.classificacaoOperacional).toBe("bloqueada");
    expect(result.identidadeProvavel.conflito).toBe(true);
    expect(result.auditoria.versaoMotor).toBeTruthy();
  });
  it("prioriza revisão antes de movimento sem correspondência",()=>{
    const list=priorizarFilaConciliacao([{id:"a",valor:-100,data:"2026-07-20",contraparteNome:"Fornecedor"},{id:"b",valor:-1,data:"2026-07-19"}],{...data,employees:[]});
    expect(list[0].transaction.id).toBe("a");
  });
  it("resume título, liquidação parcial e saldo por pessoa",()=>{
    const summary=resumoQuinzenaConciliacao({...data,employees:[data.employees[0]],titulosFolha:[{id:"f1",employeeId:"e1",liquido:1000,periodoFim:"2026-07-20",liquidacoes:[{valor:400}]}]},{inicio:"2026-07-06",fim:"2026-07-20"});
    expect(summary.totalPrevisto).toBe(1000);expect(summary.totalPago).toBe(400);expect(summary.pagamentosParciais).toHaveLength(1);
  });
});
