import { createHash, randomUUID } from "node:crypto";

const conflict = () => Object.assign(new Error("Identidade de salvamento já utilizada com outro conteúdo."), { code: "P0409" });

export function legacySaveOperation(body, companyId, actorId, action) {
  const id = body?.operationId;
  if (id === undefined) return null;
  if (typeof id !== "string" || !/^[\w-]{1,128}$/.test(id)) {
    throw Object.assign(new Error("Identificação de salvamento inválida."), { code: "INVALID_SAVE_OPERATION" });
  }
  const content = action === "save"
    ? [body.expectedUpdatedAt, body.payload ?? null, body.basePayload ?? null]
    : [body.expectedUpdatedAt, body.sections ?? null, body.baseSections ?? null, body.sectionDeltas ?? null];
  // A ordem das chaves de primeiro nível de seções e deltas afeta o limite
  // do parser legado. Preserve essa ordem na identidade do conteúdo.
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  return { id, companyId, actorId, action, hash, correlationId: randomUUID() };
}

function confirmReceipt(receipt, operation) {
  if (receipt && receipt.request_hash !== operation.hash) throw conflict();
  return receipt;
}

export async function readLegacySaveReceipt(db, operation) {
  const { data, error } = await db.from("legacy_save_receipts")
    .select("request_hash").eq("company_id", operation.companyId).eq("actor_id", operation.actorId)
    .eq("operation", operation.action).eq("operation_id", operation.id).maybeSingle();
  if (error) throw error;
  return confirmReceipt(data, operation);
}

export async function lockLegacySaveReceipt(transaction, operation) {
  const [receipt] = await transaction`
    select request_hash, updated_at, correlation_id from public.lock_legacy_save_receipt(
      ${operation.companyId}, ${operation.actorId}, ${operation.action}, ${operation.id})
  `;
  return confirmReceipt(receipt, operation);
}

export async function recordLegacySaveReceipt(transaction, operation, updatedAt) {
  await transaction`
    insert into public.legacy_save_receipts
      (company_id, actor_id, operation, operation_id, request_hash, updated_at, correlation_id)
    values (${operation.companyId}, ${operation.actorId}, ${operation.action}, ${operation.id},
      ${operation.hash}, ${updatedAt}, ${operation.correlationId})
  `;
}
