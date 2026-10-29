import {describe,it,expect} from "vitest";
import {buildRequestedDreProjectionRows} from "./dre-projection.js";
import {annualSourceValues} from "../src/domains/dre/annual-statement.js";
import {canonicalDreEvents} from "./financial-dre-integration.js";

const project=(data,events=[])=>buildRequestedDreProjectionRows(data,[{year:2026,month:6,scope:"company_dre",includeMemorial:true}],events)[0].payload;
describe("memorial do DRE",()=>{
  it("rastreia medição, nota, anexos e estorno sem contar pagamentos novamente",()=>{
    const doc={url:"https://example.com/nota.pdf",nome:"NF 20"};
    const data={obras:[{id:"o1",name:"Obra A"}],config:{},
      medicoes:[{id:"m1",obraId:"o1",competencia:"2026-07",valorPrevisto:1000,documentos:[doc]}],
      notasFiscais:[{id:"n1",obraId:"o1",status:"aprovada",emissao:"2026-07-12",valorBruto:200,numero:"20",documentos:[doc],pagamentos:[{id:"pg",valor:200,data:"2026-07-15"}]}],
      despesasEmpresa:[{id:"d1",categoria:"aluguel",competencia:"2026-07",valor:-30,descricao:"Estorno"}],
      documentosMovimentacoes:[{movimentoId:"medicao:m1:revenue",documentos:[doc]}]};
    const report=project(data),values=annualSourceValues(report);
    expect(report.memorial.faturamentoObras).toHaveLength(1);
    expect(report.memorial.faturamentoObras[0]).toMatchObject({obra:"Obra A",amountCents:100000,record:{id:"m1",documentos:[doc]},documents:[doc]});
    expect(report.memorial.outrasDiretas).toHaveLength(1);
    expect(report.memorial.outrasDiretas[0]).toMatchObject({documentNumber:"20",date:"2026-07-12",record:{pagamentos:[{id:"pg"}]}});
    for(const source of ["faturamentoObras","outrasDiretas","category:aluguel"]){
      expect(report.memorial[source].reduce((sum,item)=>sum+item.amountCents,0)).toBe(values[source]);
    }
    expect(report.memorial["category:aluguel"][0].amountCents).toBe(-3000);
  });
  it("mantém o valor apropriado da nota em cada obra",()=>{
    const report=project({obras:[{id:"a",name:"A"},{id:"b",name:"B"}],notasFiscais:[{id:"n",status:"aprovada",emissao:"2026-07-10",valorBruto:100,rateios:[{id:"r1",obraId:"a",valor:40},{id:"r2",obraId:"b",valor:60}]}]});
    expect(report.memorial.outrasDiretas.map(item=>item.amountCents).sort()).toEqual([4000,6000]);
  });
  it("preserva detalhes e documentos dos títulos canônicos",()=>{
    const title={id:"t1",direction:"receivable",competence:"2026-07-01",original_amount:70,status:"open",metadata:{financialKind:"revenue",description:"Receita nativa",documentos:[{url:"https://example.com/native.pdf"}]}};
    const report=project({},canonicalDreEvents({titles:[title]}).events);
    expect(report.memorial.receitaCorporativa[0].record).toEqual(title);
  });
  it("detalha locações, descontos, repasses e manutenção usando o motor de tarifas",()=>{
    const report=project({equipamentos:[{id:"e1",nome:"Betoneira",proprietarioId:"p1",tarifas:{dia:10}}],locacoesEquip:[{id:"l1",equipamentoId:"e1",inicio:"2026-07-01",fim:"2026-07-03",descontoPct:10}],manutencoesEquip:[{id:"mt",equipamentoId:"e1",data:"2026-07-02",custo:5}]});
    const values=annualSourceValues(report);
    for(const source of ["receitaLocacoes","descontoLocacoes","repasseEquipamentosTerceiros","manutencaoLocacoes"]){
      expect(report.memorial[source].reduce((sum,item)=>sum+item.amountCents,0)).toBe(values[source]);
    }
  });
});
