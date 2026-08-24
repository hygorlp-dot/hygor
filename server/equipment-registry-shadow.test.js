import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_REGISTRY_SCHEMA_VERSION,
  buildEquipmentRegistrySnapshot,
  compareEquipmentRegistrySnapshot,
} from "./equipment-registry-shadow.js";

const legacy = () => ({
  equipamentos:[
    {
      id:"eq-1", nome:"Betoneira 400L", categoria:"concretagem", patrimonio:"PAT-001",
      status:"locado", ativo:true, proprietarioId:"prop-1", obraAtualId:"obra-1",
      valorAquisicao:8500, version:2,
    },
    {
      id:"eq-2", nome:"Andaime", categoria:"acesso", ativo:false, status:"inativo", version:0,
    },
  ],
  proprietariosEquip:[
    { id:"prop-1", nome:"ARCD Locações", tipo:"empresa", ativo:true },
  ],
  locacoesEquip:[
    {
      id:"loc-1", equipamentoId:"eq-1", obraId:"obra-1", inicio:"2026-07-01", fim:"",
      status:"ativa", version:3, tarifas:{ dia:120 },
    },
    {
      id:"loc-2", equipamentoId:"eq-1", obraId:"obra-1", inicio:"2026-05-01", fim:"2026-05-20",
      status:"encerrada", version:1,
    },
    // Referencia um equipamento que não existe na lista acima - não deve virar linha órfã.
    { id:"loc-x", equipamentoId:"eq-inexistente", obraId:"obra-1", inicio:"2026-06-01", status:"ativa" },
  ],
  manutencoesEquip:[
    {
      id:"man-1", equipamentoId:"eq-1", obraId:"obra-1", inicio:"2026-06-10", fim:"2026-06-12",
      custo:450, descricao:"Troca de motor", status:"concluida",
    },
  ],
});

const canonicalFrom = snapshot => ({
  equipment:snapshot.equipment.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  owners:snapshot.owners.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  allocations:snapshot.allocations.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  maintenanceEvents:snapshot.maintenanceEvents.map(row => ({ id:row.id, source_hash:row.sourceHash })),
});

describe("equipment registry shadow", () => {
  it("projeta equipamentos, proprietários, locações e manutenções", () => {
    const snapshot=buildEquipmentRegistrySnapshot(legacy());
    expect(snapshot.schemaVersion).toBe(EQUIPMENT_REGISTRY_SCHEMA_VERSION);
    expect(snapshot.counts).toEqual({
      equipment:2, owners:1, allocations:2, maintenanceEvents:1,
    });
    expect(snapshot.equipment[1].active).toBe(false);
    expect(snapshot.allocations[0].active).toBe(true);
    expect(snapshot.allocations[1].active).toBe(false);
    expect(snapshot.maintenanceEvents[0].cost).toBe(450);
    expect(snapshot.equipment[0].payload.id).toBe("eq-1");
  });

  it("não cria locação/manutenção órfã quando o equipamento não existe no snapshot", () => {
    const snapshot=buildEquipmentRegistrySnapshot(legacy());
    expect(snapshot.allocations.some(row => row.id === "loc-x")).toBe(false);
  });

  it("é determinístico e idempotente para o mesmo legado", () => {
    expect(buildEquipmentRegistrySnapshot(legacy())).toEqual(buildEquipmentRegistrySnapshot(legacy()));
  });

  it("aprova a comparação quando IDs e hashes coincidem", () => {
    const snapshot=buildEquipmentRegistrySnapshot(legacy());
    expect(compareEquipmentRegistrySnapshot(snapshot, canonicalFrom(snapshot))).toEqual([]);
  });

  it("expõe ausência, sobra e alteração sem fallback silencioso", () => {
    const snapshot=buildEquipmentRegistrySnapshot(legacy());
    const canonical=canonicalFrom(snapshot);
    canonical.equipment.shift();
    canonical.owners[0].source_hash="divergente";
    canonical.maintenanceEvents.push({ id:"inesperado", source_hash:"x" });
    expect(compareEquipmentRegistrySnapshot(snapshot, canonical)).toEqual(expect.arrayContaining([
      { section:"equipment", key:"eq-1", reason:"missing" },
      { section:"owners", key:"prop-1", reason:"hash_mismatch" },
      { section:"maintenanceEvents", key:"inesperado", reason:"unexpected" },
    ]));
  });
});
