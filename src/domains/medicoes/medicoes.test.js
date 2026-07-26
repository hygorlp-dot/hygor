import { describe, expect, it } from "vitest";
import { calculateMeasurementProgress, projectTechnicalMeasurementProgress } from "./calculations.js";
import { normalizeTechnicalMeasurement } from "./model.js";
import { rebuildTechnicalMeasurementProjection } from "./projections.js";
import { validateTechnicalMeasurement } from "./validations.js";

describe("domínio de medições técnicas",()=>{
  it("calcula avanço físico ponderado, sem aceitar percentuais fora da faixa",()=>{
    const result=calculateMeasurementProgress([
      {tarefaId:"estrutura",custo:800,pctConfirmado:50,pctDiario:-10},
      {tarefaId:"pintura",custo:200,pctConfirmado:140,pctDiario:100},
    ]);
    expect(result.totalCost).toBe(1000);
    expect(result.physicalProgress).toBe(60);
    expect(result.items.map(item=>item.pctConfirmado)).toEqual([50,100]);
    expect(result.items.map(item=>item.pctDiario)).toEqual([0,100]);
  });

  it("recusa boletim aprovado sem data efetiva, tarefa ou percentual válido",()=>{
    const validation=validateTechnicalMeasurement({
      id:"m-1",obraId:"obra-1",status:"aprovada",dataMedicao:"2026-99-40",
      itens:[{tarefaId:"",pctConfirmado:110}],
    },{requireApprovedItems:true});
    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      "Informe a data efetiva da medição.",
      "Item de medição sem tarefa.",
      "Percentual aprovado inválido para a tarefa.",
    ]));
  });

  it("recompõe o avanço somente a partir de boletins aprovados",()=>{
    const measurements=[
      {id:"m-1",obraId:"obra-1",status:"confirmada",data:"2026-07-01",itens:[{tarefaId:"t-1",pctConfirmado:25}]},
      {id:"m-2",obraId:"obra-1",status:"rascunho",data:"2026-07-10",itens:[{tarefaId:"t-1",pctConfirmado:80}]},
      {id:"m-3",obraId:"obra-1",status:"aprovada",dataMedicao:"2026-07-20",itens:[{tarefaId:"t-1",pctConfirmado:55},{tarefaId:"t-2",pctConfirmado:10}]},
      {id:"m-4",obraId:"obra-1",status:"cancelada",data:"2026-07-25",itens:[{tarefaId:"t-2",pctConfirmado:80}]},
    ];
    expect(projectTechnicalMeasurementProgress(measurements,"obra-1")).toEqual([
      expect.objectContaining({tarefaId:"t-1",progresso:55,medicaoId:"m-3"}),
      expect.objectContaining({tarefaId:"t-2",progresso:10,medicaoId:"m-3"}),
    ]);
  });

  it("não altera RDOs e conserva a evidência ao atualizar o espelho do plano",()=>{
    const data={
      medicoesObra:[{id:"m-1",obraId:"obra-1",status:"aprovada",dataMedicao:"2026-07-10",itens:[{tarefaId:"t-1",pctConfirmado:42}]}],
      planos:[{id:"p-1",obraId:"obra-1",tarefas:[{id:"t-1",progresso:3},{id:"t-2",progresso:7}]}],
      rdos:[{id:"r-1",obraId:"obra-1",servicos:[{tarefaId:"t-1",progressoAte:5}]}],
    };
    const projected=rebuildTechnicalMeasurementProjection(data,"obra-1","2026-07-11T12:00:00.000Z");
    expect(projected.planos[0].tarefas[0]).toMatchObject({progresso:42,progressoOrigem:"medicao_tecnica_aprovada",medicaoTecnicaId:"m-1"});
    expect(projected.planos[0].tarefas[1].progresso).toBe(7);
    expect(projected.rdos).toEqual(data.rdos);
    expect(projected.technicalMeasurementProgress["obra-1"].items).toHaveLength(1);
  });

  it("normaliza o legado sem inventar data e preserva a compatibilidade do status",()=>{
    const legacy=normalizeTechnicalMeasurement({id:"m-1",obraId:"obra-1",status:"confirmada",itens:[]},{now:"2026-07-25T12:00:00.000Z",nextNumber:4});
    expect(legacy).toMatchObject({status:"aprovada",numero:4,data:"",dataMedicao:"",schemaVersion:1});
  });
});
