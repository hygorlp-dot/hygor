import Dexie from "dexie";
import { enqueueOfflineOperation, resolveOfflineSync } from "./queue.js";

export function createOfflineOperationStore({ dbName = "arcd-field-operations-v1", db } = {}) {
  const database = db || new Dexie(dbName);
  database.version(1).stores({ operations: "&idempotencyKey, entityId, status, createdAt" });
  const operations = database.table("operations");

  return {
    async enqueue(operation) {
      const existing = operation?.idempotencyKey ? await operations.get(operation.idempotencyKey) : null;
      const result = enqueueOfflineOperation(existing ? [existing] : [], operation);
      if (!result.ok || result.idempotent) return result;
      const item = result.queue[0];
      await operations.add(item);
      return { ...result, item };
    },
    async resolve(result) {
      const current = await operations.get(result?.idempotencyKey);
      if (!current) return { ok: false, error: "Operação offline não encontrada." };
      const [next] = resolveOfflineSync([current], result);
      await operations.put(next);
      return { ok: true, item: next };
    },
    async list() {
      return operations.orderBy("createdAt").toArray();
    },
    async close() {
      database.close();
    },
    async destroy() {
      database.close();
      await database.delete();
    },
  };
}
