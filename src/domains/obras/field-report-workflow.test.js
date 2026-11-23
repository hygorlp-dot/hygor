import {describe,expect,it} from "vitest";
import {fieldReportCompletion,fieldReportDayTarget,fieldReportIsReadOnly,findFieldReportForDay,OPEN_FIELD_REPORT_DAY} from "./field-report-workflow.js";

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

describe('atalho do placar para o Diário de obra',()=>{
  const works=[{id:'a'},{id:'b'}];
  const intent={tabId:'rdo',action:OPEN_FIELD_REPORT_DAY,linked:true,scope:{obraId:'b'},record:{date:'2026-11-19',reportId:'b-19'}};

  it('abre a obra e a data autorizadas e recusa data inválida ou fora do acesso',()=>{
    expect(fieldReportDayTarget(intent,works,'b')).toEqual({obraId:'b',date:'2026-11-19',reportId:'b-19'});
    expect(fieldReportDayTarget(intent,works,'a')).toBeNull();
    expect(fieldReportDayTarget({...intent,record:{date:'2026-02-31'}},works)).toBeNull();
    expect(fieldReportDayTarget({...intent,linked:false},works)).toBeNull();
  });

  it('seleciona o diário vinculado mesmo com um cancelamento anterior no mesmo dia',()=>{
    const old={id:'cancelado',obraId:'b',data:'2026-11-19',status:'cancelado'};
    const draft={id:'b-19',obraId:'b',data:'2026-11-19',status:'preparacao'};
    expect(findFieldReportForDay([old,draft],'b','2026-11-19','b-19')).toBe(draft);
    expect(findFieldReportForDay([old,draft],'a','2026-11-19','b-19')).toBeUndefined();
  });
});
