import { describe, expect, it } from "vitest";
import {
  calcEquipCustoObra,
  calcEquipFaturamentoEmpresa,
  calcEquipamentosMes,
  calcEquipamentosPorObra,
  melhorTarifa,
  textoComposicao,
} from "./calculations.js";

describe("motor financeiro de equipamentos", () => {
  const data = {
    equipamentos:[
      { id:"e1", nome:"Betoneira", tarifas:{ dia:100 } },
      { id:"e2", nome:"Andaime", proprietarioId:"f1", tarifas:{ dia:80 }, tarifasCusto:{ dia:50 } },
    ],
    locacoesEquip:[
      { equipamentoId:"e1", obraId:"o1", inicio:"2026-07-01", fim:"2026-07-02", valorDiaria:100 },
      { equipamentoId:"e2", obraId:"o1", inicio:"2026-07-01", fim:"2026-07-02", valorDiaria:80 },
    ],
    manutencoesEquip:[
      { equipamentoId:"e1", data:"2026-07-10", custo:20, pagoPor:"empresa" },
    ],
  };

  it("consolida faturamento, custo do dono e manutenção", () => {
    const report = calcEquipamentosMes(data, "2026-07");
    expect(report.total).toMatchObject({
      receita:360,
      custoDono:100,
      manut:20,
      custo:120,
      lucro:240,
    });
    expect(calcEquipFaturamentoEmpresa(data, "2026-07")).toMatchObject({
      receita:360,
      custoDono:100,
      manut:20,
      lucro:240,
      receitaProprios:200,
      receitaTerceiros:160,
    });
  });

  it("calcula custo da obra no recorte informado", () => {
    expect(calcEquipCustoObra(data, "o1", "2026-07", "2026-07-02", "2026-07-02")).toBe(180);
  });

  it("cobra mês de 31 dias como um mês tarifário mais uma diária", () => {
    const tarifas={dia:100,semana:650,quinzena:1200,mes:2000};
    const trintaDias=melhorTarifa(tarifas,30);
    const trintaEUmDias=melhorTarifa(tarifas,31);

    expect(trintaDias.total).toBe(2000);
    expect(textoComposicao(trintaDias.composicao)).toBe("1 mês");
    expect(trintaEUmDias.total).toBe(2100);
    expect(textoComposicao(trintaEUmDias.composicao)).toBe("1 mês + 1 dia");
  });

  it("mantém mês mais diária no custo da obra e multiplica pelas unidades locadas", () => {
    const julho31Dias={
      obras:[{id:"o1",name:"Obra A",status:"active"}],
      equipamentos:[{
        id:"e1",
        nome:"Betoneira",
        quantidadeTotal:2,
        tarifas:{dia:100,semana:650,quinzena:1200,mes:2000},
      }],
      locacoesEquip:[{
        id:"l1",
        equipamentoId:"e1",
        obraId:"o1",
        inicio:"2026-07-01",
        fim:"2026-07-31",
        quantidade:2,
      }],
    };

    expect(calcEquipCustoObra(julho31Dias,"o1","2026-07")).toBe(4200);
    expect(calcEquipamentosPorObra(julho31Dias,"2026-07").totaisPorObra.o1)
      .toMatchObject({dias:31,unidadeDias:62,receita:4200});
  });

  it("projeta equipamentos nas linhas e obras nas colunas sem perder a quantidade",()=>{
    const matriz=calcEquipamentosPorObra({
      obras:[
        {id:"o1",name:"Obra A",status:"active"},
        {id:"o2",name:"Obra B",status:"active"},
      ],
      equipamentos:[
        {id:"e1",nome:"Betoneira",quantidadeTotal:3,tarifas:{dia:100}},
      ],
      locacoesEquip:[
        {id:"l1",equipamentoId:"e1",obraId:"o1",inicio:"2026-07-01",fim:"2026-07-03",quantidade:2},
        {id:"l2",equipamentoId:"e1",obraId:"o2",inicio:"2026-07-02",fim:"2026-07-04",quantidade:1},
      ],
    },"2026-07");
    expect(matriz.obras.map(obra=>obra.id)).toEqual(["o1","o2"]);
    expect(matriz.linhas[0].equip).toMatchObject({nome:"Betoneira",quantidadeTotal:3});
    expect(matriz.linhas[0].porObra.o1).toMatchObject({
      dias:3,unidadeDias:6,quantidadePico:2,receita:600,
    });
    expect(matriz.linhas[0].porObra.o2).toMatchObject({
      dias:3,unidadeDias:3,quantidadePico:1,receita:300,
    });
    expect(matriz.total).toMatchObject({unidadeDias:9,receita:900});
  });
});
