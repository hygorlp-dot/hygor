import {createLocalDatabase,createStore,idbResult} from '../../lib/local-indexed-db.js';
import { enqueueOfflineOperation, resolveOfflineSync } from "./queue.js";

export function createOfflineOperationStore({ dbName = "arcd-field-operations-v1", db } = {}) {
  const database = db || createLocalDatabase(dbName,10,database=>{
    createStore(database,'operations','idempotencyKey',['entityId','status','createdAt']);
  });
  if(db)db.version(1).stores({operations:'&idempotencyKey, entityId, status, createdAt'});
  const run=(mode,callback)=>db?db.transaction(mode==='readwrite'?'rw':'r',db.table('operations'),()=>callback({
    get:key=>db.table('operations').get(key),add:row=>db.table('operations').add(row),put:row=>db.table('operations').put(row),ordered:()=>db.table('operations').orderBy('createdAt').toArray(),
  })):database.run('operations',mode,tx=>{const store=tx.objectStore('operations');return callback({get:key=>idbResult(store.get(key)),add:row=>idbResult(store.add(row)),put:row=>idbResult(store.put(row)),ordered:()=>idbResult(store.index('createdAt').getAll())});});

  return {
    async enqueue(operation) {
      return run('readwrite',async operations=>{
      const existing = operation?.idempotencyKey ? await operations.get(operation.idempotencyKey) : null;
      const result = enqueueOfflineOperation(existing ? [existing] : [], operation);
      if (!result.ok || result.idempotent) return result;
      const item = result.queue[0];
      await operations.add(item);
      return { ...result, item };
      });
    },
    async resolve(result) {
      return run('readwrite',async operations=>{
      const current = await operations.get(result?.idempotencyKey);
      if (!current) return { ok: false, error: "Operação offline não encontrada." };
      const [next] = resolveOfflineSync([current], result);
      await operations.put(next);
      return { ok: true, item: next };
      });
    },
    async list() {
      return run('readonly',operations=>operations.ordered());
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
