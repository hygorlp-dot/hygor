import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const legacy=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
const compras=readFileSync(`${process.cwd()}/src/domains/compras/components/ComprasView.jsx`,"utf8");
const trecho=(source,inicio,fim)=>source.slice(source.indexOf(inicio),source.indexOf(fim,source.indexOf(inicio)));

describe("correções do fluxo de compras (auditoria de 22/10/2026)",()=>{
  it("mostra o motivo do servidor quando a solicitação é recusada",()=>{
    const salvar=trecho(compras,"const salvarSolicitacao=async","// Instância de aprovação vinculada");
    expect(salvar).toMatch(/:result\?\.reason\|\|"O servidor não confirmou a solicitação/);
  });

  it("limite de ajuste do pedido conta só pagamentos ativos (estorno não trava)",()=>{
    const salvar=trecho(compras,"const salvarPedido = async","const abrirPagamento=");
    expect(salvar).toMatch(/pagamentos\|\|\[\]\)\.filter\(active\)\.reduce/);
  });

  it("numeração de pedido e solicitação fica com o servidor (C2.1)",()=>{
    expect(compras).not.toMatch(/PC-\$\{String\(\(data\.pedidos\|\|\[\]\)\.length \+ 1\)/);
    expect(compras).not.toMatch(/proximoNumeroPedido\(/);
    expect(compras).not.toMatch(/proximaSequencia/);
    expect(compras).toMatch(/numero: f\.numero\?\.trim\(\) \|\| "",/);
  });

  it("kanban não compra nem finge liberar entrega ao arrastar",()=>{
    const mover=trecho(compras,"const moverCardKanban=","const comprasAbas=");
    expect(mover).not.toMatch(/gerarPedidoDaCotacao\(/);
    expect(mover).toMatch(/setCotDecisao\(\{cotacaoId:card\.registro\.id/);
    expect(mover).not.toMatch(/Pedido liberado para entrega/);
    // C1.2: "Aguardando entrega" não depende de pagamento; arrastar envia o rascunho.
    expect(mover).not.toMatch(/abrirPagamento\(card\.registro\)/);
  });

  it("solicitação reprovada não vira pedido",()=>{
    const gerar=trecho(compras,"const gerarPedidoSolicitacao=","const abrirCotacaoDaSolicitacao=");
    // Desde a C1.1, qualquer status diferente de "aprovada" bloqueia.
    expect(gerar).toMatch(/instanciaApr&&instanciaApr\.status!=="aprovada"/);
    expect(gerar).toMatch(/foi reprovada na aprovação/);
  });

  it("confirmação de chegada converte para a unidade do estoque",()=>{
    const chegada=trecho(legacy,"const confirmarChegada = async","setChegadaModal(null);\n      return;");
    expect(chegada).toMatch(/qtd: referenceQuantityOf\(i,i\.falta\)/);
    expect(chegada).toMatch(/valorUnit: referenceUnitCostOf\(i\)/);
    expect(legacy).toMatch(/receivedQuantities:Object\.fromEntries\(entradas\.map\(item=>\[item\.pedidoItemId,item\.qtdCompra\]\)\)/);
  });

  it("C1.4: pagamento mostra o conferido e manda adiantamento com motivo ao servidor",()=>{
    const pagar=trecho(compras,"const registrarPagamento=async","const reclassificarOrigemPagamento=");
    expect(pagar).toMatch(/conferenciaPagamentoPedido\(data,pedido\.id\)/);
    expect(pagar).toMatch(/adiantamento:!!f\.adiantamento,motivoAdiantamento:/);
    expect(compras).toMatch(/Motivo do adiantamento \*/);
  });

  it("C1.2: o kanban separa pedidos pela entrega, não pelo pagamento",()=>{
    expect(compras).not.toMatch(/Pedidos a pagar/);
    expect(compras).toMatch(/const coluna=concluido\?"concluido":status==="rascunho"\?"pedido":"entrega";/);
    expect(compras).not.toMatch(/liberado para recebimento/);
    const mover=trecho(compras,"const moverCardKanban=","const comprasAbas=");
    expect(mover).toMatch(/status:"enviado",motivoAjuste:"Pedido enviado ao fornecedor\."/);
  });
});


describe("contratos de fornecimento (C2.4)",()=>{
  const contratos=readFileSync(`${process.cwd()}/src/domains/compras/components/ContratosFornecimentoView.jsx`,"utf8");
  it("a aba grava pelo servidor e o pedido leva o vínculo do contrato",()=>{
    expect(contratos).toMatch(/type:OPERATIONAL_COMMAND\.SUPPLY_CONTRACT_SAVED/);
    expect(contratos).toMatch(/type:OPERATIONAL_COMMAND\.SUPPLY_CONTRACT_CLOSED/);
    expect(compras).toMatch(/\["contratos","Contratos de fornecimento"\]/);
    expect(compras).toMatch(/contratosDisponiveis\(data,\{fornecedorId:form\.fornecedorId,obraId:form\.obraId,dataPedido:form\.data\}\)/);
    const salvar=trecho(compras,"const salvarPedido = async","const abrirPagamento=");
    expect(salvar).toMatch(/contratoId:i\.contratoId\|\|"",contratoItemId:i\.contratoItemId\|\|""/);
  });
});

describe("entrega programada por item (C2.2)",()=>{
  it("o pedido grava data e remessas do item e o cartão mostra o atraso do item",()=>{
    const salvar=trecho(compras,"const salvarPedido = async","const abrirPagamento=");
    expect(salvar).toMatch(/previsao:i\.previsao\|\|"",/);
    expect(salvar).toMatch(/remessas:\(i\.remessas\|\|\[\]\)/);
    expect(compras).toMatch(/Programar remessas/);
    expect(compras).toMatch(/atrasoDoItem\(i,p,today\(\)\)/);
    expect(legacy).toMatch(/export const pedidosEmAtraso = \(data, hoje\) => pedidosComItensAtrasados\(data, hoje\);/);
  });
});

describe("orçado × comprometido × realizado (C3.2)",()=>{
  it("a tela mostra comprometido e recebido e o pedido avisa antes de salvar",()=>{
    expect(compras).toMatch(/\["Comprometido",fmt\(totComp\),C\.blue\],\["Recebido",fmt\(totRec\),C\.purple\]/);
    expect(compras).toMatch(/Atenção: \{l\.pct\.toFixed\(0\)\}% do orçado já comprometido/);
    expect(compras).toMatch(/alertasOrcamentoDoPedido\(data,pedidoDoFormulario\(form\)\)/);
    const salvar=trecho(compras,"const salvarPedido = async","const abrirPagamento=");
    expect(salvar).toMatch(/window\.confirm\(`Este pedido estoura o orçamento de/);
    expect(legacy).toMatch(/export \{ calcOrcadoComprado \};/);
  });
});
