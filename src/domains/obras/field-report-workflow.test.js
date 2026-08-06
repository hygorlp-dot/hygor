import {describe,expect,it} from "vitest";
import {fieldReportCompletion,fieldReportIsReadOnly} from "./field-report-workflow.js";

const completeReport=()=>({obraId:"obra-1",data:"2026-08-06",descricao:"Concretagem do pavimento",
  clima:{manha:"bom",tarde:"nublado",noite:"chuva"},servicos:[{tarefaId:"t-1",progressoAte:10}],
  revisaoEngenheiro:{aprovado:true}});

describe("fluxo de conclusão do Diário de Obra",()=>{
  it("exige exatamente os cinco grupos mínimos do documento",()=>{
    const completion=fieldReportCompletion({});
    expect(completion.complete).toBe(false);
    expect(completion.pending.map(item=>item.id)).toEqual(["contexto","relato","clima","execucao","revisao"]);
  });
  it("não torna foto ou IA obrigatórias",()=>{
    expect(fieldReportCompletion(completeReport())).toMatchObject({complete:true,pending:[]});
  });
  it("não aceita serviço sem avanço nem observação como execução do dia",()=>{
    const report=completeReport();report.servicos=[{tarefaId:"t-1",progressoAte:0,obs:""}];
    expect(fieldReportCompletion(report).pending.map(item=>item.id)).toContain("execucao");
  });
  it("distingue clima não informado de clima bom",()=>{
    const report=completeReport();report.clima.tarde="";
    expect(fieldReportCompletion(report).pending.map(item=>item.id)).toEqual(["clima"]);
  });
  it("considera concluído e cancelado como somente leitura",()=>{
    expect(fieldReportIsReadOnly({status:"concluido"})).toBe(true);
    expect(fieldReportIsReadOnly({status:"cancelado"})).toBe(true);
    expect(fieldReportIsReadOnly({status:"preparacao"})).toBe(false);
  });
});
