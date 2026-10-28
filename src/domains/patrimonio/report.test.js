import {describe,expect,it} from "vitest";
import {buildPatrimonyReportHtml,summarizePatrimonyReport} from "./report.js";

describe("relatório patrimonial",()=>{
  const assets=[
    {
      id:"a1",assetTag:"PAT-000002",name:"Notebook Dell",category:"Informática",
      acquisitionValue:2500,acquisitionDate:"2026-10-01",status:"ativo",
      location:{label:"Sede"},custodian:{name:"Hygor"},
      invoice:{number:"100",supplierName:"Fornecedor A"},
    },
    {
      id:"a2",assetTag:"PAT-000001",name:"Martelete",category:"Ferramentas",
      acquisitionValue:500,acquisitionDate:"2026-09-15",status:"em_uso",
      location:{label:"Obra H2 04"},custodian:{name:"João"},
      invoice:{},
    },
  ];

  it("soma os valores de aquisição e agrupa por categoria",()=>{
    const summary=summarizePatrimonyReport(assets);
    expect(summary).toMatchObject({count:2,total:3000,withInvoice:1});
    expect(summary.categories).toEqual([
      {category:"Informática",count:1,value:2500},
      {category:"Ferramentas",count:1,value:500},
    ]);
  });

  it("gera relatório com valores, localização, NF e ressalva patrimonial",()=>{
    const html=buildPatrimonyReportHtml({
      assets,companyName:"Empresa Teste",filterLabel:"Recorte: Bens ativos",
      generatedAt:new Date("2026-10-28T12:00:00-03:00"),
    });
    expect(html).toContain("Relatório de Patrimônio da Empresa");
    expect(html).toContain("Empresa Teste");
    expect(html).toContain("3.000,00");
    expect(html).toContain("2.500,00");
    expect(html).toContain("500,00");
    expect(html).toContain("Obra H2 04");
    expect(html).toContain("NF 100");
    expect(html).toContain("Não representam depreciação");
    expect(html.indexOf("PAT-000001")).toBeLessThan(html.indexOf("PAT-000002"));
  });

  it("escapa texto cadastrado antes de montar o HTML",()=>{
    const html=buildPatrimonyReportHtml({
      assets:[{id:"x",assetTag:"PAT-1",name:'<script>alert("x")</script>',acquisitionValue:1}],
      companyName:"A&B <Empresa>",
      filterLabel:'Busca: "<tag>"',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A&amp;B &lt;Empresa&gt;");
    expect(html).toContain("&lt;tag&gt;");
  });
});
