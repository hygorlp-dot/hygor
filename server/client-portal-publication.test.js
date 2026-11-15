import { describe, expect, it } from "vitest";
import { buildClientPortalPublicationRows, clientPortalProgress } from "./client-portal-publication.js";
import {portalFixture} from "./client-portal.fixture.js";
it("resolve a fase pelo ID do cadastro e não usa o status técnico active como fase",()=>{
  const source=portalFixture();
  expect(buildClientPortalPublicationRows({data:source,projectId:"obra-local"}).find(row=>row.domain==="project_summary").payload.currentPhase).toBe("Acabamento");
  source.obras[0].faseId="fase-ausente";
  expect(buildClientPortalPublicationRows({data:source,projectId:"obra-local"}).find(row=>row.domain==="project_summary").payload.currentPhase).toBe("");
});

it("não antecipa recebimentos e caixa futuros na posição atual",()=>{
  const source=portalFixture();
  source.medicoes[0].recebimentos.push({id:"futuro",data:"2026-11-18",valor:900});
  source.caixaObra.push({id:"aporte-futuro",obraId:"obra-local",tipo:"aporte",data:"2026-11-18",valor:5000});
  const rows=buildClientPortalPublicationRows({data:source,projectId:"obra-local",publishedAt:"2026-11-14T15:00:00Z"});
  expect(rows.find(row=>row.domain==="financial_summary").payload.paid).toBe(2500);
  expect(rows.find(row=>row.domain==="cash_summary").payload.balance).toBe(9400);
  expect(rows.filter(row=>row.domain==="payment").map(row=>row.payload.id)).toEqual(["rec-local"]);
});
it("usa o calendário da Bahia e não volta ao recebido legado quando os recebimentos foram cancelados",()=>{
  const source=portalFixture();source.medicoes[0].valorRecebido=900;
  source.medicoes[0].recebimentos=[{id:"cancelado",data:"2026-11-12",valor:900,status:"cancelado"},{id:"ainda-futuro",data:"2026-11-14",valor:300}];
  const rows=buildClientPortalPublicationRows({data:source,projectId:"obra-local",publishedAt:"2026-11-14T01:00:00Z"});
  expect(rows.find(row=>row.domain==="financial_summary").payload.paid).toBe(0);
  expect(rows.filter(row=>row.domain==="payment")).toHaveLength(0);
});
it("retira pedidos e notas excluídos da consulta do cliente",()=>{
  const source=portalFixture();source.pedidos[0].deletedAt="2026-11-13";source.notasFiscais[0].ativo=false;
  const rows=buildClientPortalPublicationRows({data:source,projectId:"obra-local"});
  expect(rows.filter(row=>row.domain==="purchase_order"||row.domain==="invoice")).toHaveLength(0);
});
it("vincula a nota do extrato por ID e sinaliza ambiguidade sem escolher por semelhança",()=>{
  const source=portalFixture();
  let rows=buildClientPortalPublicationRows({data:source,projectId:"obra-local"});
  expect(rows.find(row=>row.domain==="cash_movement"&&row.payload.id==="caixa-local").payload).toMatchObject({invoiceNumber:"1001",invoiceDocuments:[{id:"doc-local",title:"Nota fiscal 1001.pdf",url:"https://files.example.test/nota-1001.pdf"}]});
  delete source.caixaObra[1].notaFiscalId;
  source.notasFiscais.push({...source.notasFiscais[0],id:"segunda-nota",numero:"1002"});
  rows=buildClientPortalPublicationRows({data:source,projectId:"obra-local"});
  expect(rows.find(row=>row.domain==="cash_movement"&&row.payload.id==="caixa-local").payload).toMatchObject({invoiceNumber:"",invoiceDocuments:[],invoiceLinkAmbiguous:true});
  source.obras[0].portalCliente.publicarNotasFiscais=false;
  rows=buildClientPortalPublicationRows({data:source,projectId:"obra-local"});
  expect(rows.find(row=>row.domain==="cash_movement"&&row.payload.id==="caixa-local").payload).toMatchObject({invoiceNumber:"",invoiceDocuments:[]});
});

const data = {
  obras:[{
    id:"obra-a", name:"Casa Aurora", contractValue:100000, contractEnd:"2026-12-18",
    portalCliente:{publicarFotos:true,publicarCronograma:true,publicarFinanceiro:true,publicarDocumentos:true,publicarCaixaObra:true,publicarNotasFiscais:true,publicarCompras:true,publicarCotacoes:true},
    documentosOneDrive:[
      {id:"doc-publico",nome:"Boletim",url:"https://cliente/documento.pdf",publicarCliente:true},
      {id:"doc-interno",nome:"Custo interno",url:"https://interno/custo.pdf",publicarCliente:false},
    ],
  }],
  planos:[{obraId:"obra-a",tarefas:[{id:"t1",nome:"Fundação",inicio:"2026-07-01",fim:"2026-07-20",progresso:100}]}],
  rdos:[{
    id:"rdo-1",obraId:"obra-a",status:"concluido",data:"2026-07-20",descricao:"Fundação concluída",
    fotos:[{id:"foto-1",url:"https://cliente/foto.webp",legenda:"Fundação",publicarCliente:true}],
  }],
  medicoes:[
    {id:"m1",obraId:"obra-a",competencia:"2026-07",descricao:"Parcela julho",valorPrevisto:20000,percentualAcumulado:20,recebimentos:[{id:"r1",valor:15000,data:"2026-07-22"}]},
    {id:"m-cancelada",obraId:"obra-a",status:"cancelado",valorPrevisto:999999},
  ],
  fornecedores:[{id:"forn-1",nome:"Casa dos Materiais",cnpj:"não publicar"}],
  materiais:[{id:"mat-1",descricao:"Cimento CP II",unidade:"SC"}],
  caixaObra:[
    {id:"cx-1",obraId:"obra-a",data:"2026-07-10",tipo:"aporte",valor:10000,descricao:"Aporte julho",transacaoId:"não-publicar"},
    {id:"cx-2",obraId:"obra-a",data:"2026-07-12",tipo:"despesa",categoria:"material",valor:2500,descricao:"Materiais"},
    {id:"cx-estornado",obraId:"obra-a",data:"2026-07-13",tipo:"despesa",valor:999999,status:"estornado"},
  ],
  notasFiscais:[{id:"nf-1",obraId:"obra-a",tipo:"nfe",numero:"124",emissao:"2026-07-12",fornecedorId:"forn-1",valorBruto:2500,valorLiquido:2400,status:"aprovada",chave:"não publicar",documentoFornecedor:"não publicar"}],
  pedidos:[{id:"pc-1",obraId:"obra-a",numero:"PC-001",fornecedorId:"forn-1",data:"2026-07-11",previsao:"2026-07-15",status:"recebido",itens:[{materialId:"mat-1",qtd:10,qtdRecebida:10,precoUnit:25}],pagamentos:[{transacaoId:"não publicar"}]}],
  cotacoes:[{id:"ct-1",obraId:"obra-a",materialId:"mat-1",qtd:10,data:"2026-07-09",status:"decidida",escolhida:"prop-1",propostas:[{id:"prop-1",fornecedorId:"forn-1",precoUnit:25,prazoDias:3,obs:"não publicar"}]}],
};

describe("buildClientPortalPublicationRows", () => {
  it("leva todos os diários concluídos por dia, inclusive sem fotos, com vínculo exato das imagens",()=>{
    const source={...data,rdos:Array.from({length:35},(_,index)=>({id:`dia-${index}`,obraId:"obra-a",status:"concluido",codigo:index+1,data:"2026-07-20",descricao:`Relato ${index}`,comentarios:"Comentário interno proibido",presencas:[{cpf:"privado"}],servicos:[{tarefaId:"t1",quantidadeDia:2,unidade:"m²",progressoAte:30}],fotos:index===0?[{id:"foto-dia",url:"https://cliente/foto.webp"}]:[]}))};
    source.rdos.push({id:"draft",obraId:"obra-a",status:"preparacao",data:"2026-07-21",descricao:"Rascunho privado"});
    const rows=buildClientPortalPublicationRows({data:source,projectId:"obra-a"});
    expect(rows.filter(row=>row.domain==="daily_report")).toHaveLength(35);
    expect(rows.find(row=>row.domain==="media").payload.reportId).toBe("dia-0");
    expect(rows.find(row=>row.domain==="daily_report").payload.services[0]).toMatchObject({description:"Fundação",quantity:2,unit:"m²",progress:30});
    const serialized=JSON.stringify(rows);expect(serialized).not.toContain("Comentário interno proibido");expect(serialized).not.toContain("Rascunho privado");expect(serialized).not.toContain("cpf");
  });
  it("publica o conjunto completo permitido sem levar registros internos", () => {
    const rows=buildClientPortalPublicationRows({data,projectId:"obra-a",publishedAt:"2026-07-26T12:00:00.000Z"});
    expect(rows.map(row=>row.domain)).toEqual(expect.arrayContaining([
      "project_summary","timeline","weekly_update","media","financial_summary","measurement","payment","document",
      "cash_summary","cash_movement","invoice","purchase_order","quotation",
    ]));
    expect(rows.find(row=>row.domain==="measurement")?.payload).toMatchObject({
      clientAmount:20000, clientStatus:"Recebida parcialmente",
    });
    expect(rows.find(row=>row.domain==="financial_summary")?.payload).toMatchObject({
      contractCurrent:100000, measured:20000, paid:15000, openAmount:5000, balanceToMeasure:80000,
    });
    expect(rows.find(row=>row.domain==="payment")?.payload).toMatchObject({amount:15000,clientStatus:"Recebido"});
    expect(rows.filter(row=>row.domain==="document")).toHaveLength(1);
    expect(rows.find(row=>row.domain==="cash_summary")?.payload).toMatchObject({totalContributions:10000,totalExpenses:2500,balance:7500});
    expect(rows.find(row=>row.domain==="invoice")?.payload).toMatchObject({number:"124",supplierName:"Casa dos Materiais",netAmount:2400});
    expect(rows.find(row=>row.domain==="purchase_order")?.payload).toMatchObject({number:"PC-001",total:250});
    expect(rows.find(row=>row.domain==="quotation")?.payload.proposals[0]).toMatchObject({supplierName:"Casa dos Materiais",total:250,selected:true});
    expect(JSON.stringify(rows)).not.toContain("Custo interno");
    // Mapa de cotação (C1.3): total por fornecedor, não o preço vazio do formato antigo.
    const mapRows=buildClientPortalPublicationRows({data:{...data,cotacoes:[{id:"ct-2",obraId:"obra-a",materialId:"mat-1",qtd:10,data:"2026-07-10",status:"aberta",
      itens:[{id:"a",materialId:"mat-1",qtd:10},{id:"b",materialId:"mat-1",qtd:2}],decisoes:{a:{propostaId:"prop-1",pedidoId:"pc-1"}},
      propostas:[{id:"prop-1",fornecedorId:"forn-1",precos:{a:25,b:5},prazoDias:3}]}]},projectId:"obra-a",publishedAt:"2026-07-26T12:00:00.000Z"});
    expect(mapRows.find(row=>row.domain==="quotation")?.payload).toMatchObject({material:"2 itens · Cimento CP II",quantity:2});
    expect(mapRows.find(row=>row.domain==="quotation")?.payload.proposals[0]).toMatchObject({total:260,selected:true});
    expect(JSON.stringify(rows)).not.toContain("999999");
    expect(JSON.stringify(rows)).not.toContain("não publicar");
  });

  it("respeita todas as chaves editoriais da obra", () => {
    const restricted={...data,obras:[{...data.obras[0],portalCliente:{
      publicarFotos:false,publicarCronograma:false,publicarFinanceiro:false,publicarDocumentos:false,
      publicarCaixaObra:false,publicarNotasFiscais:false,publicarCompras:false,publicarCotacoes:false,
    }}]};
    const rows=buildClientPortalPublicationRows({data:restricted,projectId:"obra-a"});
    expect(rows.map(row=>row.domain)).toEqual(["project_summary","publication_policy"]);
  });

  it("não publica nota ou cotação cancelada/estornada/rejeitada no feminino nem nota em rascunho", () => {
    const nota=(id,status)=>({id,obraId:"obra-a",tipo:"nfe",numero:id,emissao:"2026-07-12",valorBruto:100,status});
    const quote=(id,status)=>({id,obraId:"obra-a",materialId:"mat-1",qtd:1,data:"2026-07-09",status,propostas:[]});
    const rows=buildClientPortalPublicationRows({data:{...data,
      notasFiscais:[nota("ok","aprovada"),nota("c","cancelada"),nota("e","estornada"),nota("r","rejeitada"),nota("d","rascunho")],
      cotacoes:[quote("q-ok","aberta"),quote("q-c","cancelada")]},projectId:"obra-a"});
    expect(rows.filter(row=>row.domain==="invoice").map(row=>row.payload.number)).toEqual(["ok"]);
    expect(rows.filter(row=>row.domain==="quotation").map(row=>row.payload.id)).toEqual(["q-ok"]);
  });

  it("mostra o andamento real da entrega e a unidade em que o pedido foi comprado", () => {
    const order=(id,itens)=>({id,obraId:"obra-a",numero:id,fornecedorId:"forn-1",data:"2026-07-11",status:"enviado",pagamentos:[],itens});
    const item={materialId:"mat-1",qtd:10,precoUnit:35,unidadeRef:"KG",unidadeCompra:"SC",fatorConversao:50};
    const rows=buildClientPortalPublicationRows({data:{...data,pedidos:[
      order("A",[{...item,qtdRecebida:0}]),order("B",[{...item,qtdRecebida:4}]),order("C",[{...item,qtdRecebida:10}]),
    ]},projectId:"obra-a"});
    const byNumber=Object.fromEntries(rows.filter(row=>row.domain==="purchase_order").map(row=>[row.payload.number,row.payload]));
    expect([byNumber.A.clientStatus,byNumber.B.clientStatus,byNumber.C.clientStatus]).toEqual(["enviado","parcial","recebido"]);
    expect(byNumber.A.items[0]).toMatchObject({unit:"SC",quantity:10,unitPrice:35});
  });

  it("não revela pedido nem fornecedor na descrição do caixa quando as compras não são publicadas", () => {
    const paga={id:"cx-p",obraId:"obra-a",data:"2026-07-14",tipo:"despesa",valor:100,pedidoId:"pc-1",descricao:"Pagamento do pedido PC-001 · Casa dos Materiais"};
    const closed={...data.obras[0],portalCliente:{...data.obras[0].portalCliente,publicarCompras:false}};
    const hidden=buildClientPortalPublicationRows({data:{...data,obras:[closed],caixaObra:[paga]},projectId:"obra-a"});
    const cash=JSON.stringify(hidden.filter(row=>row.domain==="cash_movement"));
    expect(cash).not.toContain("PC-001");
    expect(cash).not.toContain("Casa dos Materiais");
    expect(hidden.find(row=>row.domain==="cash_movement").payload.description).toBe("Pagamento de compra de material");
    const open=buildClientPortalPublicationRows({data:{...data,caixaObra:[paga]},projectId:"obra-a"});
    expect(open.find(row=>row.domain==="cash_movement").payload.description).toContain("PC-001");
  });

  it("falha fechado quando a obra não existe", () => {
    expect(()=>buildClientPortalPublicationRows({data,projectId:"outra"})).toThrow("Obra não encontrada");
  });
});

describe("clientPortalProgress", () => {
  const tasks=[{id:"a",custo:9000,progresso:50},{id:"b",custo:1000,progresso:100}];
  it("usa o avanço do último boletim técnico aprovado da obra", () => {
    const medicoesObra=[
      {id:"b1",obraId:"o",status:"aprovada",dataMedicao:"2026-09-01",avancoFisico:30},
      {id:"b2",obraId:"o",status:"aprovada",dataMedicao:"2026-10-01",avancoFisico:42.4},
      {id:"b3",obraId:"o",status:"rascunho",dataMedicao:"2026-10-20",avancoFisico:90},
      {id:"x",obraId:"outra",status:"aprovada",dataMedicao:"2026-10-25",avancoFisico:99},
    ];
    expect(clientPortalProgress({data:{medicoesObra},obraId:"o",tasks})).toEqual({value:42.4,source:"medicao_tecnica"});
  });
  it("sem boletim, pondera as tarefas pelo custo, não pela média simples", () => {
    expect(clientPortalProgress({data:{},obraId:"o",tasks})).toEqual({value:55,source:"cronograma_ponderado"});
    expect(clientPortalProgress({data:{},obraId:"o",tasks:[{progresso:50},{progresso:100}]})).toEqual({value:75,source:"cronograma"});
  });
  it("reaproveita o avanço oficial da medição percentual antes do cronograma",()=>{
    expect(clientPortalProgress({data:{medicoes:[{id:"m",obraId:"o",tipo:"percentual",percentualAcumulado:40,status:"emitida"}]},obraId:"o",tasks})).toEqual({value:40,source:"medicao_percentual"});
  });
});
