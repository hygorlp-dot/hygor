import { describe, expect, it } from "vitest";
import { analisarMovimentoConciliacao, comandoConciliacaoAutomatica, priorizarFilaConciliacao, resumoQuinzenaConciliacao } from "./engine.js";

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
    const summary=resumoQuinzenaConciliacao({...data,employees:[data.employees[0]],titulosFolha:[{id:"f1",employeeId:"e1",liquido:1000,periodoFim:"2026-07-20",liquidacoes:[{valor:400},{valor:600,status:"ESTORNADA"}]}]},{inicio:"2026-07-06",fim:"2026-07-20"});
    expect(summary.totalPrevisto).toBe(1000);expect(summary.totalPago).toBe(400);expect(summary.pagamentosParciais).toHaveLength(1);
  });
});

// Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): a
// confirmação em lote da fila "pronta" precisa traduzir a recomendação do
// motor para o comando real do servidor - esta função é essa tradução,
// testada isolada da classificação (já coberta acima).
describe("comandoConciliacaoAutomatica · tradução para o comando do servidor",()=>{
  it("mapeia pagamento já registrado para vincular (LINK_EXISTING_PAYMENT)",()=>{
    const analise={transacaoId:"t1",classificacaoOperacional:"pronta",acaoRecomendada:"VINCULAR_PAGAMENTO_EXISTENTE",
      melhorCandidata:{tipo:"pagamentoNota",entidadeId:"n1",pagamentoId:"pg1"}};
    expect(comandoConciliacaoAutomatica(analise)).toMatchObject({type:"LINK_EXISTING_PAYMENT",
      payload:{transactionId:"t1",targetType:"pagamentoNota",targetId:"n1",paymentId:"pg1"}});
  });
  it("mapeia obrigação sem pagamento registrado para confirmar pagamento (CONFIRM_PAYMENT)",()=>{
    const analise={transacaoId:"t2",classificacaoOperacional:"pronta",acaoRecomendada:"REGISTRAR_PAGAMENTO_E_CONCILIAR",
      melhorCandidata:{tipo:"nota",entidadeId:"n2"}};
    expect(comandoConciliacaoAutomatica(analise)).toMatchObject({type:"CONFIRM_PAYMENT",
      payload:{transactionId:"t2",targetType:"nota",targetId:"n2"}});
  });
  it("mapeia recebimento de medição/entrada de contrato para confirmar recebimento (CONFIRM_RECEIPT)",()=>{
    const analise={transacaoId:"t3",classificacaoOperacional:"pronta",acaoRecomendada:"REGISTRAR_RECEBIMENTO_E_CONCILIAR",
      melhorCandidata:{tipo:"medicao",entidadeId:"m1"}};
    expect(comandoConciliacaoAutomatica(analise)).toMatchObject({type:"CONFIRM_RECEIPT",
      payload:{transactionId:"t3",targetType:"medicao",targetId:"m1"}});
  });
  it("devolve null quando não há candidata",()=>{
    expect(comandoConciliacaoAutomatica({transacaoId:"t4",classificacaoOperacional:"sem_correspondencia",acaoRecomendada:"SEM_CORRESPONDENCIA",melhorCandidata:null})).toBeNull();
  });
  it("nunca inventa um comando para transferência interna ou lançamento novo",()=>{
    expect(comandoConciliacaoAutomatica({transacaoId:"t5",classificacaoOperacional:"pronta",acaoRecomendada:"MARCAR_TRANSFERENCIA_INTERNA",melhorCandidata:{tipo:"pixRegistrado",entidadeId:"emp1"}})).toBeNull();
    expect(comandoConciliacaoAutomatica({transacaoId:"t6",classificacaoOperacional:"pronta",acaoRecomendada:"CRIAR_LANCAMENTO_NOVO_COM_REVISAO",melhorCandidata:{tipo:"outro",entidadeId:"x"}})).toBeNull();
  });
  it("registra na observação que a origem foi a confirmação em lote",()=>{
    const analise={transacaoId:"t7",classificacaoOperacional:"pronta",acaoRecomendada:"REGISTRAR_PAGAMENTO_E_CONCILIAR",melhorCandidata:{tipo:"pedido",entidadeId:"p1"}};
    expect(comandoConciliacaoAutomatica(analise).payload.observacao).toMatch(/lote/i);
  });
});
