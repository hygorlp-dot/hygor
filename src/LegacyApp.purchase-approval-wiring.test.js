import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const compras=readFileSync(`${process.cwd()}/src/domains/compras/components/ComprasView.jsx`,"utf8");
const pendentes=readFileSync(`${process.cwd()}/src/domains/aprovacoes/components/AprovacoesPendentesView.jsx`,"utf8");
const legacy=readFileSync(`${process.cwd()}/src/LegacyApp.jsx`,"utf8");
const api=readFileSync(`${process.cwd()}/api/data.js`,"utf8");
const trecho=(source,inicio,fim)=>source.slice(source.indexOf(inicio),source.indexOf(fim,source.indexOf(inicio)));

describe("aprovação de compras ligada ao servidor (C1.1)",()=>{
  it("a solicitação não monta nem envia instância de aprovação",()=>{
    const salvar=trecho(compras,"const salvarSolicitacao=async","// Instância de aprovação vinculada");
    expect(salvar).not.toMatch(/iniciarInstancia/);
    expect(salvar).not.toMatch(/approvalInstance/);
  });

  it("as duas telas decidem pelo comando do servidor, não pelo salvamento genérico",()=>{
    const decidirCompras=trecho(compras,"const decidirAprovacao=async","// Achado ao fechar a lacuna");
    expect(decidirCompras).toMatch(/APPROVAL_DECISION_RECORDED/);
    expect(decidirCompras).not.toMatch(/update\(/);
    expect(pendentes).toMatch(/APPROVAL_DECISION_RECORDED/);
    expect(pendentes).not.toMatch(/registrarDecisao/);
    expect(legacy).toMatch(/<AprovacoesPendentesView data=\{data\} showToast=\{showToast\} currentUser=\{currentUser\} dispatchCommand=\{dispatchOperationalCommand\}\/>/);
  });

  it("solicitação não aprovada não vira pedido nem com confirmação",()=>{
    const gerar=trecho(compras,"const gerarPedidoSolicitacao=","const abrirCotacaoDaSolicitacao=");
    expect(gerar).not.toMatch(/window\.confirm/);
    expect(gerar).toMatch(/instanciaApr&&instanciaApr\.status!=="aprovada"/);
  });

  it("o perfil do comando vem do usuário autenticado, nunca do navegador",()=>{
    expect(api.match(/actorId:usuario\.id,actorRole:usuario\.role\|\|""/g)).toHaveLength(2);
  });
});
