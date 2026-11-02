import {buildPurchaseWorkspace} from './domains/compras/workspace.js';
import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const suporteCompras=readFileSync(`${process.cwd()}/src/domains/compras/LegacySupport.jsx`,"utf8");
const legacy=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
const compras=readFileSync(`${process.cwd()}/src/domains/compras/components/ComprasView.jsx`,"utf8");
const contratosWorkspace=readFileSync(`${process.cwd()}/src/domains/compras/components/PurchaseContractsWorkspace.jsx`,"utf8");
const recebimento=readFileSync(`${process.cwd()}/src/domains/compras/receipt.js`,"utf8");
const modalRecebimento=readFileSync(`${process.cwd()}/src/domains/compras/components/ReceiptModal.jsx`,"utf8");
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

  it("solicitação com decisão pendente ou recusada avisa e permite gerar pedido",()=>{
    const gerar=trecho(compras,"const gerarPedidoSolicitacao=","const abrirCotacaoDaSolicitacao=");
    // Pendência processual avisa; os comandos do domínio validam a integridade.
    expect(gerar).toMatch(/instanciaApr&&instanciaApr\.status!=="aprovada"/);
    const aviso=trecho(gerar,"if(instanciaApr","const itens");
    expect(aviso).toMatch(/O pedido pode seguir/);
    expect(aviso).not.toMatch(/return/);
  });

  it("confirmação de chegada converte para a unidade do estoque",()=>{
    // R6: a conversão mora na regra única de recebimento (receipt.js), usada
    // pelo "Chegou" da obra e pelo "Receber" de Compras.
    const chegada=trecho(legacy,"const confirmarChegada = async","const atividade = useMemo");
    expect(chegada).toMatch(/montarRecebimento\(pedido, recebidos,/);
    expect(chegada).toMatch(/receivedQuantities:montado\.receivedQuantities,\s*stockEntries:montado\.stockEntries,/);
    expect(recebimento).toMatch(/qtd: referenceQuantityOf\(item, chegou\), valorUnit: referenceUnitCostOf\(item\)/);
    expect(compras).toMatch(/montarRecebimento\(pedido,recebidos,/);
  });

  it("D-A: Central de Pagamentos e obrigações do DRE ignoram nota rejeitada",()=>{
    expect(legacy).toMatch(/const notasAtivas=useMemo\(\(\)=>notas\.filter\(n=>!notaSemEfeito\(n\)\),\[notas\]\);/);
    expect(legacy).toMatch(/const notasAbertas=notas\.filter\(n=>n\.status!=="paga"&&!notaSemEfeito\(n\)\);/);
  });

  it("C8: confirmação de chegada mostra a unidade de compra e bloqueia clique duplo",()=>{
    const modal=trecho(legacy,"{chegadaModal && (","{/* ==== SECOES EM ACORDEAO");
    // R6: o "Chegou" abre o mesmo modal de recebimento de Compras.
    expect(modal).toMatch(/<ModalRecebimentoCompras pedido=\{chegadaModal\}/);
    expect(modal).toMatch(/onReceber=\{confirmarChegada\}/);
    // a quantidade do pedido está na embalagem comprada (SC), não na unidade do cadastro (KG)
    expect(modalRecebimento).toMatch(/label=\{`Chegou agora \(\$\{purchaseUnitOf\(l\)\}\)`\}/);
    // o modal trava o segundo clique enquanto confirma
    expect(modalRecebimento).toMatch(/const confirmar=async\(\)=>\{if\(salvando\)return;setSalvando\(true\)/);
    const chegada=trecho(legacy,"const confirmarChegada = async","const atividade = useMemo");
    expect(chegada).toMatch(/if \(chegadaEnviando\) return;/);
    expect(chegada).toMatch(/setChegadaEnviando\(true\);[\s\S]*finally\{\s*setChegadaEnviando\(false\);/);
  });

  it("C1.4: pagamento mostra o conferido e manda adiantamento com motivo ao servidor",()=>{
    const pagar=trecho(compras,"const registrarPagamento=async","const reclassificarOrigemPagamento=");
    expect(pagar).toMatch(/conferenciaPagamentoPedido\(data,pedido\.id\)/);
    expect(pagar).toMatch(/adiantamento:!!f\.adiantamento,motivoAdiantamento:/);
    expect(compras).toMatch(/Motivo do adiantamento \(recomendado\)/);
  });

  it("C1.2: fila e quadro separam entrega e pagamento",()=>{
    const pending={id:'paid-not-delivered',obraId:'a',status:'enviado',itens:[{qtd:10,qtdRecebida:0,precoUnit:10}],pagamentos:[{id:'payment',valor:100}]};
    const received={...pending,id:'received-unpaid',itens:[{qtd:10,qtdRecebida:10,precoUnit:10}],pagamentos:[]};
    const model=buildPurchaseWorkspace({pedidos:[pending,received]},['a'],'2026-11-01');
    expect(model.rows.map(row=>row.id)).toEqual(['paid-not-delivered']);expect(model.rows[0]).toMatchObject({stage:'recebimentos',action:'Receber materiais'});expect(model.rows[0].detail).toContain('Pago');
  });
});


describe("contratos de fornecimento (C2.4)",()=>{
  const contratos=readFileSync(`${process.cwd()}/src/domains/compras/components/ContratosFornecimentoView.jsx`,"utf8");
  it("a aba grava pelo servidor e o pedido leva o vínculo do contrato",()=>{
    expect(contratos).toMatch(/type:OPERATIONAL_COMMAND\.SUPPLY_CONTRACT_SAVED/);
    expect(contratos).toMatch(/type:OPERATIONAL_COMMAND\.SUPPLY_CONTRACT_CLOSED/);
    expect(compras).toMatch(/\["contratos","Contratos e medições"\]/);
    expect(compras).toMatch(/<PurchaseContractsWorkspace/);
    expect(contratosWorkspace).toMatch(/<ContratosFornecimentoView/);
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
    expect(suporteCompras).toMatch(/export const pedidosEmAtraso = \(data, hoje\) => pedidosComItensAtrasados\(data, hoje\);/);
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
