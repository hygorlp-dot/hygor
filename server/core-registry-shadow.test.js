import { describe, expect, it } from "vitest";
import {
  CORE_REGISTRY_SCHEMA_VERSION,
  buildCoreRegistrySnapshot,
  compareCoreRegistrySnapshot,
} from "./core-registry-shadow.js";

const legacy = () => ({
  obras:[
    { id:"obra-1", name:"B2-04", status:"active", startDate:"2026-07-01" },
    { id:"obra-2", name:"Concluída", status:"done" },
  ],
  employees:[
    {
      id:"emp-1", name:"Ana", obra:"obra-1", role:"Engenheira",
      cpf:"123.456.789-00", pixKey:"ana@pix", startDate:"2026-07-02",
    },
    { id:"emp-2", name:"Administrativo", workArea:"administrativo", startDate:"2026-07-03" },
  ],
  fornecedores:[
    { id:"forn-1", nome:"Materiais PE", cnpj:"12.345.678/0001-90", categorias:["cimento"] },
  ],
  terceirizados:[
    {
      id:"contrato-1", prestadorId:"prestador-1", name:"Elétrica Ltda",
      documento:"98.765.432/0001-10", obraId:"obra-1", specialty:"eletricista",
    },
    {
      id:"contrato-2", prestadorId:"prestador-1", name:"Elétrica Ltda",
      documento:"98.765.432/0001-10", obraId:"obra-2", specialty:"instalações",
    },
  ],
});

const canonicalFrom = snapshot => ({
  projects:snapshot.projects.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  employees:snapshot.employees.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  employeeAssignments:snapshot.employeeAssignments.map(row => ({
    employee_id:row.employeeId, project_id:row.projectId, source_hash:row.sourceHash,
  })),
  employeeIdentifiers:snapshot.employeeIdentifiers.map(row => ({
    employee_id:row.employeeId, identifier_type:row.identifierType,
    normalized_value:row.normalizedValue, source_hash:row.sourceHash,
  })),
  suppliers:snapshot.suppliers.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  thirdPartyProfiles:snapshot.thirdPartyProfiles.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  thirdPartyContracts:snapshot.thirdPartyContracts.map(row => ({ id:row.id, source_hash:row.sourceHash })),
});

describe("core registry shadow", () => {
  it("projeta cadastros e vínculos sem duplicar o prestador", () => {
    const snapshot=buildCoreRegistrySnapshot(legacy());
    expect(snapshot.schemaVersion).toBe(CORE_REGISTRY_SCHEMA_VERSION);
    expect(snapshot.counts).toEqual({
      projects:2,
      employees:2,
      employeeAssignments:1,
      employeeIdentifiers:2,
      suppliers:1,
      thirdPartyProfiles:1,
      thirdPartyContracts:2,
    });
    expect(snapshot.projects[1].active).toBe(false);
    expect(snapshot.employeeIdentifiers.map(item => item.normalizedValue)).toEqual([
      "12345678900", "ana@pix",
    ]);
    expect(snapshot.thirdPartyProfiles[0].payload).not.toHaveProperty("contractValue");
  });

  it("é determinístico e idempotente para o mesmo legado", () => {
    expect(buildCoreRegistrySnapshot(legacy())).toEqual(buildCoreRegistrySnapshot(legacy()));
  });

  it("aprova a comparação quando IDs e hashes coincidem", () => {
    const snapshot=buildCoreRegistrySnapshot(legacy());
    expect(compareCoreRegistrySnapshot(snapshot, canonicalFrom(snapshot))).toEqual([]);
  });

  it("expõe ausência, sobra e alteração sem fallback silencioso", () => {
    const snapshot=buildCoreRegistrySnapshot(legacy());
    const canonical=canonicalFrom(snapshot);
    canonical.projects.shift();
    canonical.suppliers[0].source_hash="divergente";
    canonical.employees.push({ id:"inesperado", source_hash:"x" });
    expect(compareCoreRegistrySnapshot(snapshot, canonical)).toEqual(expect.arrayContaining([
      { section:"projects", key:"obra-1", reason:"missing" },
      { section:"suppliers", key:"forn-1", reason:"hash_mismatch" },
      { section:"employees", key:"inesperado", reason:"unexpected" },
    ]));
  });

  it("não cria contrato órfão quando a obra não existe", () => {
    const snapshot=buildCoreRegistrySnapshot({
      ...legacy(),
      terceirizados:[{ id:"contrato-x", prestadorId:"p-x", name:"Sem obra", obraId:"inexistente" }],
    });
    expect(snapshot.thirdPartyProfiles).toHaveLength(1);
    expect(snapshot.thirdPartyContracts).toEqual([]);
  });
});
