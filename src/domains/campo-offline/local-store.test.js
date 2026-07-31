import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { createOfflineOperationStore } from "./local-store.js";

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const stores = [];
function makeStore(dbName = `arcd-offline-test-${crypto.randomUUID()}`) {
  const store = createOfflineOperationStore({ dbName });
  stores.push(store);
  return store;
}
afterEach(async () => { await Promise.all(stores.splice(0).map(store => store.destroy())); });

describe("store persistente de operações de campo", () => {
  it("persiste operação permitida e impede duplicidade pela chave idempotente", async () => {
    const dbName = `arcd-offline-test-${crypto.randomUUID()}`;
    const persistentStore = makeStore(dbName);
    const operation = { type: "DAILY_LOG_SAVE", entityId: "rdo-1", idempotencyKey: "daily-1", createdAt: "2026-07-26T12:00:00.000Z" };
    const first = await persistentStore.enqueue(operation);
    const duplicate = await persistentStore.enqueue(operation);

    expect(first.ok).toBe(true);
    expect(duplicate.idempotent).toBe(true);
    await persistentStore.close();
    const reopened = makeStore(dbName);
    expect(await reopened.list()).toEqual([{ ...operation, status: "pendente", attempts: 0 }]);
  });

  it("preserva conflito e nunca deixa financeiro entrar na base local", async () => {
    const store = makeStore();
    const blocked = await store.enqueue({ type: "FINANCIAL_COMMAND", entityId: "x", idempotencyKey: "financial-1" });
    await store.enqueue({ type: "INSPECTION_SAVE", entityId: "inspection-1", idempotencyKey: "inspection-1" });
    const sync = await store.resolve({ idempotencyKey: "inspection-1", ok: false, error: "Versão divergente" });

    expect(blocked.ok).toBe(false);
    expect(sync.item).toMatchObject({ status: "conflito", attempts: 1, error: "Versão divergente" });
    expect(await store.list()).toHaveLength(1);
  });
});
