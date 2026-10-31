import {test,expect} from "@playwright/test";
import {selectWorkspaceArea} from './helpers/workspace-navigation.js';
import {quoteLinkKey,issueQuoteLink,verifyQuoteLink,quoteLinkAccess,publicQuoteView} from "../server/supplier-quote-link.js";
import {storeSupplierResponse} from "../src/domains/compras/supplier-quote-response.js";
import {applyOperationalCommand} from "../src/domains/sync/operational-commands.js";
const user={id:"buyer",nome:"Compras QA",email:"buyer@local.test",role:"admin",active:true};
const fixture=()=>({usuarios:[user],config:{paymentHolidays:[]},employees:[],attendance:{},obras:[{id:"o",name:"Obra QA",status:"active"}],materiais:[{id:"m",descricao:"Cimento QA",unidade:"UN",ativo:true}],fornecedores:[{id:"f",nome:"Fornecedor QA",ativo:true},{id:"competitor",nome:"Concorrente QA",ativo:true}],cotacoes:[{id:"q",numero:"COT-PORTAL",obraId:"o",materialId:"m",qtd:2,unidadeRef:"UN",status:"aberta",data:"2026-10-30",version:1,propostas:[{id:"p",fornecedorId:"f",precoUnit:10},{id:"c",fornecedorId:"competitor",precoUnit:999}]}],pedidos:[],notasFiscais:[],solicitacoesCompra:[],transacoes:[]});
for(const width of [390,1440])test(`portal do fornecedor e revisão por Compras em ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});let data=fixture();const errors=[],commands=[];page.on("pageerror",e=>errors.push(e.message));
 const key=quoteLinkKey({PEDIDO_ACEITE_SECRET:"test".repeat(10)}),token=issueQuoteLink({key,quote:data.cotacoes[0],proposalId:"p",company:"qa"}).token;
 await page.route("**/api/**",async route=>{const b=route.request().postDataJSON()||{};
  if(b.action==="profiles")return route.fulfill({json:{usuarios:[user],precisaSetup:false}});
  if(b.action==="cotacao-fornecedor-link")return route.fulfill({json:{ok:true,...issueQuoteLink({key,quote:data.cotacoes[0],proposalId:b.proposalId,company:"qa"})}});
  if(String(b.action||"").startsWith("cotacao-fornecedor-")){
   const claims=verifyQuoteLink({key,token:b.token,company:"qa"}),access=claims&&quoteLinkAccess(data,claims);if(!access)return route.fulfill({status:404,json:{error:"Link inválido"}});
   if(b.action==="cotacao-fornecedor-ver")return route.fulfill({json:{ok:true,cotacao:publicQuoteView(data,access)}});
   const result=storeSupplierResponse(data,{quoteId:claims.q,proposalId:claims.p,responseId:access.responseId,scope:access.scope,body:b});if(result.ok)data=result.data;return route.fulfill({status:result.ok?200:409,json:result.ok?{ok:true}:{error:result.reason}});
  }
  if(b.action==="operational-command"){commands.push(b.command);const result=applyOperationalCommand(data,b.command);if(result.ok)data=result.data;return route.fulfill({json:{...result,updatedAt:new Date().toISOString()}})}
  return route.fulfill({json:{ok:true,items:[],bases:[],accessToken:"qa",refreshToken:"qa",usuario:user,data,updatedAt:new Date().toISOString()}});
 });
 await page.goto(`/responder-cotacao#${token}`);await expect(page.getByRole("heading",{name:"Responder cotação",exact:true})).toBeVisible();await expect(page.locator("main")).not.toContainText("Concorrente QA");
 await page.getByLabel("Nome do responsável").fill("Vendedor QA");await page.getByLabel(/Cimento QA/).fill("12");
 for(const label of ["Frete (R$)","Desconto (R$)","Impostos adicionais (R$)","Outras despesas (R$)"])await page.getByLabel(label).fill("0");
 await page.getByLabel("Prazo de entrega em dias").fill("3");await page.getByLabel("Condições de pagamento").fill("30 dias");
 await page.getByRole("button",{name:"Adicionar link de anexo",exact:true}).click();await page.getByLabel("Nome do anexo 1").fill("Proposta QA");await page.getByLabel("Link HTTPS do anexo 1").fill("https://example.test/proposta.pdf");
 await page.screenshot({path:`artifacts/compras/portal-fornecedor-${width}.png`,fullPage:true});
 await page.getByRole("button",{name:"Enviar proposta para revisão",exact:true}).click();await expect(page.getByRole("heading",{name:"Resposta recebida"})).toBeVisible();expect(data.pedidos).toHaveLength(0);expect(data.cotacoes[0].propostas[0].precoUnit).toBe(10);
 await page.goto("/");await page.locator("#login-email").fill(user.email);await page.locator("#login-senha").fill("isolated");await page.getByRole("button",{name:"Acessar central MARCELL"}).click();
 if(width<1100)await page.getByRole("button",{name:"Abrir Compras e suprimentos",exact:true}).click();else {await page.locator(".arcd-sidebar .nav-grp-hd").filter({hasText:/Compras/}).click();await page.locator(".arcd-sidebar .nav-item").filter({hasText:/^Compras$/}).click();}
 await selectWorkspaceArea(page,'Fluxo de compras','Cotar');
 await page.locator('#purchase-record-q').getByRole('button',{name:'Comparar propostas · COT-PORTAL',exact:true}).click();
 await expect(page.getByRole("heading",{name:"Fornecedor QA · Aguardando revisão"})).toBeVisible();await expect(page.getByText("Total ofertado:")).toContainText("24,00");await expect(page.getByRole("button",{name:"Aceitar resposta no mapa"})).toBeDisabled();
 await page.getByLabel("Motivo da revisão · Fornecedor QA").fill("Conferidos preços e condições");await page.getByRole("button",{name:"Aceitar resposta no mapa",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Fornecedor QA · aceita"})).toBeVisible();expect(data.pedidos).toHaveLength(0);expect(data.cotacoes[0].propostas[0].precoUnit).toBe(12);expect(commands).toHaveLength(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`artifacts/compras/portal-revisao-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});
