import { describe, expect, it } from "vitest";
import { buildClientPortalPublicationRows } from "./client-portal-publication.js";

const data = {
  obras:[{
    id:"obra-a", name:"Casa Aurora", contractValue:100000, contractEnd:"2026-12-18",
    portalCliente:{publicarFotos:true,publicarCronograma:true,publicarFinanceiro:true,publicarDocumentos:true},
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
};

describe("buildClientPortalPublicationRows", () => {
  it("publica o conjunto completo permitido sem levar registros internos", () => {
    const rows=buildClientPortalPublicationRows({data,projectId:"obra-a",publishedAt:"2026-07-26T12:00:00.000Z"});
    expect(rows.map(row=>row.domain)).toEqual(expect.arrayContaining([
      "project_summary","timeline","weekly_update","media","financial_summary","measurement","payment","document",
    ]));
    expect(rows.find(row=>row.domain==="measurement")?.payload).toMatchObject({
      clientAmount:20000, clientStatus:"Recebida parcialmente",
    });
    expect(rows.find(row=>row.domain==="financial_summary")?.payload).toMatchObject({
      contractCurrent:100000, measured:20000, paid:15000, openAmount:5000, balanceToMeasure:80000,
    });
    expect(rows.find(row=>row.domain==="payment")?.payload).toMatchObject({amount:15000,clientStatus:"Recebido"});
    expect(rows.filter(row=>row.domain==="document")).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("Custo interno");
    expect(JSON.stringify(rows)).not.toContain("999999");
  });

  it("respeita todas as chaves editoriais da obra", () => {
    const restricted={...data,obras:[{...data.obras[0],portalCliente:{
      publicarFotos:false,publicarCronograma:false,publicarFinanceiro:false,publicarDocumentos:false,
    }}]};
    const rows=buildClientPortalPublicationRows({data:restricted,projectId:"obra-a"});
    expect(rows.map(row=>row.domain)).toEqual(["project_summary","weekly_update"]);
  });

  it("falha fechado quando a obra não existe", () => {
    expect(()=>buildClientPortalPublicationRows({data,projectId:"outra"})).toThrow("Obra não encontrada");
  });
});
