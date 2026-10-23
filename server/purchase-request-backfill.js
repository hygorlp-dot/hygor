import { decodeAppData } from "./data-codec.js";
import { buildPurchaseRequestLiveRow } from "./purchase-request-live-write.js";
import { isDeepStrictEqual } from "node:util";

// Caller supplies a transaction. Lock the same source row as operational
// commands, so a deployment cannot overwrite a newer request with an old copy.
export const backfillPurchaseRequests = async (tx, companyId) => {
  const [source] = await tx`select value from company_app_data where company_id=${companyId} and key=${"arced_ponto_v1"} for update`;
  if (!source) return {requests:0, preservedExtras:0};
  const data = decodeAppData(source.value);
  const requests = data.solicitacoesCompra || [];
  for (const request of requests) {
    const row = buildPurchaseRequestLiveRow(companyId, request);
    if (!row.id || !row.project_id) throw new Error("Solicitação sem identificação ou obra; backfill cancelado.");
    await tx`insert into purchase_requests
      (company_id,id,request_number,project_id,needed_by,priority,notes,source_version,payload,updated_at)
      values (${row.company_id},${row.id},${row.request_number},${row.project_id},${row.needed_by},${row.priority},${row.notes},${row.source_version},${tx.json(row.payload)},now())
      on conflict (company_id,id) do update set
        request_number=excluded.request_number,project_id=excluded.project_id,needed_by=excluded.needed_by,
        priority=excluded.priority,notes=excluded.notes,source_version=excluded.source_version,
        payload=excluded.payload,updated_at=excluded.updated_at`;
  }
  const actual = await tx`select id,payload,source_version from purchase_requests where company_id=${companyId}`;
  for (const request of requests) {
    const projected = actual.find(row => row.id === String(request.id));
    if (!projected || !isDeepStrictEqual(projected.payload, request)
      || Number(projected.source_version) !== Number(request.version || 0)) throw new Error("Projeção de solicitação não confirmada.");
  }
  return {requests:requests.length, preservedExtras:actual.filter(row => !requests.some(request => String(request.id) === row.id)).length};
};
