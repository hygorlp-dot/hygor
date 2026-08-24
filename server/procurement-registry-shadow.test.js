import { describe, expect, it } from "vitest";
import {
  PROCUREMENT_REGISTRY_SCHEMA_VERSION,
  buildProcurementRegistrySnapshot,
  compareProcurementRegistrySnapshot,
} from "./procurement-registry-shadow.js";

const legacy = () => ({
  cotacoes:[
    {
      id:"c-1", obraId:"obra-1", materialId:"m-1", solicitacaoId:"s-1",
      status:"aberta", qtd:5, version:1,
      propostas:[{ id:"pr-1", fornecedorId:"f-1", precoUnit:10 }],
    },
    {
      id:"c-2", obraId:"obra-1", materialId:"m-2", solicitacaoId:"",
      status:"cancelada", qtd:2, version:2,
    },
  ],
  pedidos:[
    {
      id:"p-1", obraId:"obra-1", fornecedorId:"f-1", cotacaoId:"c-1", solicitacaoId:"s-1",
      numero:"PC-0001", status:"enviado", version:3,
    },
    {
      id:"p-2", obraId:"obra-1", fornecedorId:"f-1", cotacaoId:"", solicitacaoId:"",
      numero:"PC-0002", status:"cancelado", version:1,
    },
    // Referencia uma cotação que não existe na lista acima - não deve virar linha órfã.
    { id:"p-x", obraId:"obra-1", fornecedorId:"f-1", cotacaoId:"c-inexistente", numero:"PC-0003" },
  ],
});

const canonicalFrom = snapshot => ({
  quotations:snapshot.quotations.map(row => ({ id:row.id, source_hash:row.sourceHash })),
  purchaseOrders:snapshot.purchaseOrders.map(row => ({ id:row.id, source_hash:row.sourceHash })),
});

describe("procurement registry shadow", () => {
  it("projeta cotações e pedidos", () => {
    const snapshot=buildProcurementRegistrySnapshot(legacy());
    expect(snapshot.schemaVersion).toBe(PROCUREMENT_REGISTRY_SCHEMA_VERSION);
    expect(snapshot.counts).toEqual({ quotations:2, purchaseOrders:2 });
    expect(snapshot.quotations[0].active).toBe(true);
    expect(snapshot.quotations[1].active).toBe(false);
    expect(snapshot.purchaseOrders[0].active).toBe(true);
    expect(snapshot.purchaseOrders[1].active).toBe(false);
    expect(snapshot.quotations[0].payload.id).toBe("c-1");
  });

  it("não cria pedido órfão quando a cotação vinculada não existe no snapshot", () => {
    const snapshot=buildProcurementRegistrySnapshot(legacy());
    expect(snapshot.purchaseOrders.some(row => row.id === "p-x")).toBe(false);
  });

  it("é determinístico e idempotente para o mesmo legado", () => {
    expect(buildProcurementRegistrySnapshot(legacy())).toEqual(buildProcurementRegistrySnapshot(legacy()));
  });

  it("aprova a comparação quando IDs e hashes coincidem", () => {
    const snapshot=buildProcurementRegistrySnapshot(legacy());
    expect(compareProcurementRegistrySnapshot(snapshot, canonicalFrom(snapshot))).toEqual([]);
  });

  it("expõe ausência, sobra e alteração sem fallback silencioso", () => {
    const snapshot=buildProcurementRegistrySnapshot(legacy());
    const canonical=canonicalFrom(snapshot);
    canonical.quotations.shift();
    canonical.purchaseOrders[0].source_hash="divergente";
    canonical.purchaseOrders.push({ id:"inesperado", source_hash:"x" });
    expect(compareProcurementRegistrySnapshot(snapshot, canonical)).toEqual(expect.arrayContaining([
      { section:"quotations", key:"c-1", reason:"missing" },
      { section:"purchaseOrders", key:"p-1", reason:"hash_mismatch" },
      { section:"purchaseOrders", key:"inesperado", reason:"unexpected" },
    ]));
  });
});
