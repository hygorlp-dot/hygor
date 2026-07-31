import { describe, expect, it } from "vitest";
import { buildClientPortalPublicationRows } from "./client-portal-publication.js";

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
    expect(JSON.stringify(rows)).not.toContain("999999");
    expect(JSON.stringify(rows)).not.toContain("não publicar");
  });

  it("respeita todas as chaves editoriais da obra", () => {
    const restricted={...data,obras:[{...data.obras[0],portalCliente:{
      publicarFotos:false,publicarCronograma:false,publicarFinanceiro:false,publicarDocumentos:false,
      publicarCaixaObra:false,publicarNotasFiscais:false,publicarCompras:false,publicarCotacoes:false,
    }}]};
    const rows=buildClientPortalPublicationRows({data:restricted,projectId:"obra-a"});
    expect(rows.map(row=>row.domain)).toEqual(["project_summary","weekly_update"]);
  });

  it("falha fechado quando a obra não existe", () => {
    expect(()=>buildClientPortalPublicationRows({data,projectId:"outra"})).toThrow("Obra não encontrada");
  });
});
