import { describe, expect, it } from "vitest";
import {
  calcEquipCustoObra,
  calcEquipFaturamentoEmpresa,
  calcEquipamentosMes,
  calcEquipamentosPorObra,
  cobrancaLocacao,
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
      receitaBruta:360,
      descontos:0,
      custoDono:100,
      manut:20,
      lucro:240,
      receitaProprios:200,
      receitaTerceiros:160,
    });
  });

  it("não perde locações de equipamento inativado ou com cadastro ausente",()=>{
    const report=calcEquipamentosMes({
      equipamentos:[{id:"inativo",ativo:false,tarifas:{dia:100}}],
      locacoesEquip:[
        {equipamentoId:"inativo",inicio:"2026-07-01",fim:"2026-07-01"},
        {equipamentoId:"ausente",inicio:"2026-07-01",fim:"2026-07-01",valorDiaria:50},
      ],
    },"2026-07");
    expect(report.total.receita).toBe(150);
    expect(report.linhas).toHaveLength(2);
    expect(report.linhas.find(line=>line.equip.id==="ausente")?.equip.cadastroAusente).toBe(true);
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
        tarifasCusto:{dia:60,semana:390,quinzena:720,mes:1200},
      }],
      locacoesEquip:[{
        id:"l1",
        equipamentoId:"e1",
        obraId:"o1",
        inicio:"2026-07-01",
        fim:"2026-07-31",
        quantidade:2,
      },{
        id:"cancelada",
        equipamentoId:"e1",
        obraId:"o1",
        inicio:"2026-07-01",
        fim:"2026-07-31",
        quantidade:2,
        status:"cancelada",
      }],
    };

    expect(calcEquipCustoObra(julho31Dias,"o1","2026-07")).toBe(4200);
    const mensal=calcEquipamentosMes(julho31Dias,"2026-07");
    expect(mensal.total)
      .toMatchObject({receita:4200,custoDono:2520,lucro:1680});
    expect(mensal.linhas[0].locacoes).toBe(1);
    expect(mensal.linhas[0]).toMatchObject({diasContrato:31,unidadeDias:62,diasTotais:31});
    expect(calcEquipamentosPorObra(julho31Dias,"2026-07").totaisPorObra.o1)
      .toMatchObject({dias:31,unidadeDias:62,receita:4200,custoDono:2520,lucro:1680});
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
        {id:"l1",equipamentoId:"e1",obraId:"o1",inicio:"2026-07-01",fim:"2026-07-03",quantidade:2,equipmentLotId:"lot-1",equipmentUnitIds:["u1","u2"]},
        {id:"l2",equipamentoId:"e1",obraId:"o2",inicio:"2026-07-02",fim:"2026-07-04",quantidade:1},
      ],
    },"2026-07");
    expect(matriz.obras.map(obra=>obra.id)).toEqual(["o1","o2"]);
    expect(matriz.linhas[0].equip).toMatchObject({nome:"Betoneira",quantidadeTotal:3});
    expect(matriz.linhas[0].porObra.o1).toMatchObject({
      dias:3,unidadeDias:6,quantidadePico:2,receita:600,
    });
    expect(matriz.linhas[0].porObra.o1.detalhes[0]).toMatchObject({
      locacaoId:"l1",
      obraId:"o1",
      equipmentLotId:"lot-1",
      equipmentUnitIds:["u1","u2"],
      inicio:"2026-07-01",
      fim:"2026-07-03",
      quantidade:2,
      dias:3,
      unidadeDias:6,
      bruto:600,
      receita:600,
      custoDono:0,
      lucro:600,
      semTarifa:false,
      status:"encerrada",
    });
    expect(textoComposicao(matriz.linhas[0].porObra.o1.detalhes[0].composicao))
      .toBe("3 dias");
    expect(matriz.linhas[0].porObra.o2).toMatchObject({
      dias:3,unidadeDias:3,quantidadePico:1,receita:300,
    });
    expect(matriz.total).toMatchObject({unidadeDias:9,receita:900});
  });

  it("mantém dias de contrato separados de diárias-unidade em locações simultâneas",()=>{
    const report=calcEquipamentosMes({
      equipamentos:[{id:"e1",nome:"Andaime",quantidadeTotal:4,tarifas:{dia:10}}],
      locacoesEquip:[
        {id:"l1",equipamentoId:"e1",obraId:"o1",inicio:"2026-06-29",fim:"2026-07-02",quantidade:2},
        {id:"l2",equipamentoId:"e1",obraId:"o2",inicio:"2026-07-02",fim:"2026-07-04",quantidade:1},
      ],
    },"2026-07");
    expect(report.linhas[0]).toMatchObject({diasContrato:5,unidadeDias:7,receita:70});
  });

  it("usa para sempre o snapshot mesmo após alterar o cadastro",()=>{
    const loc={quantidade:1,commercialSnapshot:{tarifas:{dia:80},tarifasCusto:{dia:30},descontoPct:10,descontoValor:4}};
    expect(cobrancaLocacao(loc,{tarifas:{dia:999}},2)).toMatchObject({bruto:160,desconto:20,liquido:140});
  });

  it("arredonda em centavos, limita descontos defensivamente e sinaliza desconto elevado",()=>{
    const equip={tarifas:{dia:33.33}};
    expect(cobrancaLocacao({quantidade:3,descontoPct:0,descontoValor:0},equip,1)).toMatchObject({bruto:99.99,desconto:0,liquido:99.99});
    expect(cobrancaLocacao({quantidade:1,descontoPct:100,descontoValor:50},equip,1)).toMatchObject({bruto:33.33,desconto:33.33,liquido:0,descontoElevado:true});
    expect(cobrancaLocacao({quantidade:1,descontoPct:150,descontoValor:50},equip,1).liquido).toBe(0);
  });
});
