import { describe, expect, it } from "vitest";
import {
  avaliarAcessoAceite, chaveLinkAceite, comandoAceitePorLink, gerarTokenAceite, linkAceiteDisponivel,
  podeGerarLinkAceite, verificarTokenAceite, visaoPublicaPedido,
} from "./supplier-acceptance-link.js";
import { applyOperationalCommand, OPERATIONAL_COMMAND } from "../src/domains/sync/operational-commands.js";

const key=chaveLinkAceite({SUPABASE_SERVICE_ROLE_KEY:"service-role-de-teste"});
const now=Date.parse("2026-10-23T12:00:00Z");
const pedido=(patch={})=>({id:"p-1",numero:"PC-0007",obraId:"o-1",fornecedorId:"f-1",status:"enviado",version:2,
  data:"2026-10-20",previsao:"2026-10-30",itens:[{id:"i-1",materialId:"m-1",qtd:10,precoUnit:35,unidadeCompra:"SC"}],
  pagamentos:[{id:"pg",valor:100}],...patch});
const base=(patch={})=>({obras:[{id:"o-1",name:"Alameda",address:"Rua A, 10"}],
  fornecedores:[{id:"f-1",nome:"Casa dos Materiais",cnpj:"12.345.678/0001-90"}],
  materiais:[{id:"m-1",descricao:"CIMENTO CP II",unidade:"SC"}],pedidos:[pedido(patch)]});

describe("link de aceite do pedido pelo fornecedor",()=>{
  it("a chave é derivada no servidor e o código não carrega segredo nem dado interno",()=>{
    expect(key).toHaveLength(32);
    expect(chaveLinkAceite({})).toBeNull();
    expect(chaveLinkAceite({PEDIDO_ACEITE_SECRET:"x".repeat(40),SUPABASE_SERVICE_ROLE_KEY:"a"}).toString()).toBe("x".repeat(40));
    const {token,expiraEm}=gerarTokenAceite({key,order:pedido(),now});
    expect(expiraEm).toBe("2026-11-07T12:00:00.000Z");
    const corpo=Buffer.from(token.split(".")[0],"base64url").toString();
    expect(Object.keys(JSON.parse(corpo)).sort()).toEqual(["e","f","o","v"]);
    expect(corpo).not.toContain("service-role");
    expect(verificarTokenAceite({key,token,now})).toMatchObject({ok:true,orderId:"p-1"});
  });

  it("recusa código adulterado, de outra chave e vencido",()=>{
    const {token}=gerarTokenAceite({key,order:pedido(),now});
    const [corpo,assinatura]=token.split(".");
    const outroCorpo=Buffer.from(JSON.stringify({v:1,o:"p-2",e:9999999999,f:"x"})).toString("base64url");
    expect(verificarTokenAceite({key,token:`${outroCorpo}.${assinatura}`,now}).motivo).toBe("invalido");
    expect(verificarTokenAceite({key:chaveLinkAceite({SUPABASE_SERVICE_ROLE_KEY:"outra"}),token,now}).motivo).toBe("invalido");
    expect(verificarTokenAceite({key,token:`${corpo}.`,now}).motivo).toBe("invalido");
    expect(verificarTokenAceite({key,token:"a".repeat(700),now}).motivo).toBe("invalido");
    expect(verificarTokenAceite({key,token,now:now+16*86400000}).motivo).toBe("expirado");
    expect(avaliarAcessoAceite({key,token,data:base(),now:now+16*86400000})).toMatchObject({status:404,falha:true});
  });

  it("o link perde a validade quando o pedido muda, é cancelado ou já foi aceito",()=>{
    const {token}=gerarTokenAceite({key,order:pedido(),now});
    expect(avaliarAcessoAceite({key,token,data:base(),now}).situacao).toBe("pendente");
    // Pagamento não muda o pedido para o fornecedor; preço sim.
    expect(avaliarAcessoAceite({key,token,data:base({pagamentos:[]}),now}).situacao).toBe("pendente");
    const alterado=avaliarAcessoAceite({key,token,data:base({itens:[{id:"i-1",materialId:"m-1",qtd:10,precoUnit:36}]}),now});
    expect(alterado.situacao).toBe("alterado");
    expect(comandoAceitePorLink({...alterado,body:{nome:"João"}}).status).toBe(409);
    expect(avaliarAcessoAceite({key,token,data:base({status:"cancelado"}),now})).toMatchObject({status:404,falha:true});
    expect(avaliarAcessoAceite({key,token,data:base({aceiteFornecedor:{nome:"Ana"}}),now}).situacao).toBe("aceito");
    expect(linkAceiteDisponivel(pedido())).toBe(true);
    expect(linkAceiteDisponivel(pedido({status:"rascunho"}))).toBe(false);
    expect(linkAceiteDisponivel(pedido({aceiteFornecedor:{nome:"Ana"}}))).toBe(false);
  });

  it("o fornecedor vê só o próprio pedido, sem pagamentos nem CNPJ",()=>{
    const visao=visaoPublicaPedido(base(),pedido());
    expect(visao).toMatchObject({numero:"PC-0007",fornecedor:"Casa dos Materiais",obra:"Alameda",enderecoEntrega:"Rua A, 10",total:350});
    expect(visao.itens[0]).toEqual({descricao:"CIMENTO CP II",unidade:"SC",qtd:10,precoUnit:35,total:350});
    expect(JSON.stringify(visao)).not.toContain("12.345.678");
    expect(JSON.stringify(visao)).not.toContain("pagamentos");
  });

  it("o aceite pelo link grava nome, data, canal link e o prazo confirmado",()=>{
    const {token}=gerarTokenAceite({key,order:pedido(),now});
    const acesso=avaliarAcessoAceite({key,token,data:base(),now});
    expect(comandoAceitePorLink({...acesso,body:{nome:"Jo"}}).status).toBe(400);
    expect(comandoAceitePorLink({...acesso,body:{nome:"João Vendas",previsao:"30/10"}}).status).toBe(400);
    const preparado=comandoAceitePorLink({...acesso,body:{nome:"João Vendas",previsao:"2026-11-02",observacao:"Entrega pela manhã"},now:new Date(now)});
    expect(preparado.actor.id).toBe("fornecedor:f-1");
    const result=applyOperationalCommand(base(),{type:OPERATIONAL_COMMAND.PURCHASE_ORDER_SUPPLIER_ACCEPTED,...preparado.command},"2026-10-23T12:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.pedidos[0]).toMatchObject({previsao:"2026-11-02",previsaoAnterior:"2026-10-30",version:3});
    expect(result.data.pedidos[0].aceiteFornecedor).toMatchObject({nome:"João Vendas",canal:"link",data:"2026-10-23",observacao:"Entrega pela manhã"});
    // Depois do aceite, o mesmo link não aceita de novo.
    expect(comandoAceitePorLink({...avaliarAcessoAceite({key,token,data:result.data,now}),body:{nome:"Outro nome"}}).status).toBe(409);
  });

  it("só Administração e Compras geram o link",()=>{
    expect(podeGerarLinkAceite("admin")).toBe(true);
    expect(podeGerarLinkAceite("compras")).toBe(true);
    for(const role of ["financeiro","engenheiro","rh","visitante",""])expect(podeGerarLinkAceite(role)).toBe(false);
  });
});
