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

  it("numera pedido pelo maior número existente, não pela contagem",()=>{
    expect(compras).not.toMatch(/PC-\$\{String\(\(data\.pedidos\|\|\[\]\)\.length \+ 1\)/);
    expect(compras.match(/proximoNumeroPedido\(data\.pedidos\)/g)).toHaveLength(2);
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

  it("C1.2: o kanban separa pedidos pela entrega, não pelo pagamento",()=>{
    expect(compras).not.toMatch(/Pedidos a pagar/);
    expect(compras).toMatch(/const coluna=concluido\?"concluido":status==="rascunho"\?"pedido":"entrega";/);
    expect(compras).not.toMatch(/liberado para recebimento/);
    const mover=trecho(compras,"const moverCardKanban=","const comprasAbas=");
    expect(mover).toMatch(/status:"enviado",motivoAjuste:"Pedido enviado ao fornecedor\."/);
  });
});

