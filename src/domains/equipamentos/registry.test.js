import {describe,expect,it} from "vitest";
import {buildEquipmentRegistry,deriveEquipmentLocations,migrateLegacyEquipmentRegistry} from "./registry.js";

const data=()=>({
  equipamentos:[
    {id:"bet",nome:"Betoneira",quantidadeTotal:1,patrimonio:"EQ-10",status:"disponivel"},
    {id:"and",nome:"Andaime",quantidadeTotal:20},
    {id:"amb",nome:"Serra",quantidadeTotal:1},
  ],
  locacoesEquip:[
    {id:"l1",equipamentoId:"and",obraId:"obra-a",quantidade:7,inicio:"2026-08-01",fim:""},
    {id:"l2",equipamentoId:"and",obraId:"obra-b",quantidade:5,inicio:"2026-08-01",fim:""},
    {id:"l3",equipamentoId:"bet",obraId:"obra-b",quantidade:1,inicio:"2026-08-02",fim:""},
  ],
});

describe("registro físico de equipamentos",()=>{
  it("separa modelos, lotes e unidades sem remover a origem legada",()=>{
    const result=buildEquipmentRegistry(data());
    expect(result.models).toHaveLength(3);
    expect(result.units).toEqual([expect.objectContaining({assetTag:"EQ-10",legacySourceId:"bet"})]);
    expect(result.lots).toEqual(expect.arrayContaining([
      expect.objectContaining({legacySourceId:"and",quantity:20,requiresReview:false}),
      expect.objectContaining({legacySourceId:"amb",quantity:1,requiresReview:true}),
    ]));
    expect(result.report).toMatchObject({convertedToUnits:["bet"],convertedToLots:["and","amb"],ambiguous:["amb"]});
  });

  it("fraciona um lote entre obras e deriva o saldo do depósito",()=>{
    const result=deriveEquipmentLocations(data(),"2026-08-04");
    const lot=result.lots.find(item=>item.legacySourceId==="and");
    const locations=result.allocations.filter(item=>item.lotId===lot.id);
    expect(locations).toEqual(expect.arrayContaining([
      expect.objectContaining({type:"work",locationId:"obra-a",quantity:7}),
      expect.objectContaining({type:"work",locationId:"obra-b",quantity:5}),
      expect.objectContaining({type:"depot",quantity:8}),
    ]));
  });

  it("deriva a localização da unidade pela alocação, não por obraAtualId",()=>{
    const input=data();
    input.equipamentos[0].obraAtualId="obra-antiga";
    const result=deriveEquipmentLocations(input,"2026-08-04");
    const unit=result.units.find(item=>item.legacySourceId==="bet");
    expect(result.allocations.find(item=>item.unitId===unit.id)).toMatchObject({type:"work",locationId:"obra-b",quantity:1});
  });

  it("materializa a compatibilidade de forma idempotente",()=>{
    const first=migrateLegacyEquipmentRegistry(data());
    const second=migrateLegacyEquipmentRegistry(first);
    expect(second.equipmentModels).toEqual(first.equipmentModels);
    expect(second.equipmentLots).toEqual(first.equipmentLots);
    expect(second.equipmentUnits).toEqual(first.equipmentUnits);
    expect(second.equipamentos).toEqual(data().equipamentos);
  });

  it("não recria lote quando todas as unidades da origem já foram individualizadas",()=>{
    const input={equipamentos:[{id:"eq",nome:"Martelete",quantidadeTotal:2}],
      equipmentModels:[{id:"model",legacySourceId:"eq"}],equipmentUnits:[
        {id:"u1",modelId:"model",legacySourceId:"eq",assetTag:"P-1"},
        {id:"u2",modelId:"model",legacySourceId:"eq",assetTag:"P-2"},
      ]};
    const result=buildEquipmentRegistry(input);
    expect(result.units).toHaveLength(2);
    expect(result.lots).toHaveLength(0);
    expect(result.report.convertedToUnits).toEqual(["eq"]);
  });

  it("mantém a localização resultante de transferências físicas",()=>{
    const input={equipamentos:[{id:"eq",nome:"Martelete",quantidadeTotal:1,patrimonio:"P-1"}],
      transferenciasEquip:[{id:"t1",equipamentoId:"eq",equipmentUnitId:"legacy-unit:eq",equipmentUnitIds:["legacy-unit:eq"],quantidade:1,deLocationId:"depot",paraObraId:"obra-a",data:"2026-08-02",physicalRegistryMovement:true}]};
    const result=deriveEquipmentLocations(input,"2026-08-04");
    expect(result.allocations.find(item=>item.unitId==="legacy-unit:eq")).toMatchObject({type:"work",locationId:"obra-a",quantity:1});
  });

  it("fraciona saldo permanente de lote após transferência física",()=>{
    const input={equipamentos:[{id:"and",nome:"Andaime",quantidadeTotal:10}],
      transferenciasEquip:[{id:"t1",equipamentoId:"and",equipmentLotId:"legacy-lot:and",quantidade:4,deLocationId:"depot",paraObraId:"obra-a",data:"2026-08-02",physicalRegistryMovement:true}]};
    const result=deriveEquipmentLocations(input,"2026-08-04");
    expect(result.allocations).toEqual(expect.arrayContaining([
      expect.objectContaining({lotId:"legacy-lot:and",type:"work",locationId:"obra-a",quantity:4}),
      expect.objectContaining({lotId:"legacy-lot:and",type:"depot",quantity:6}),
    ]));
  });
});
