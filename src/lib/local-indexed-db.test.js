import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {createLocalDatabase,createStore,idbResult} from './local-indexed-db.js';

const databases=[];
const make=(version=10,upgrade=db=>createStore(db,'rows','id'),name=`native-${crypto.randomUUID()}`)=>{
  const db=createLocalDatabase(name,version,upgrade);databases.push(db);return db;
};
afterEach(async()=>{vi.unstubAllGlobals();for(const db of databases)db.close();for(const db of databases.splice(0))await db.delete();});

it('só confirma a gravação depois do commit e desfaz todas as escritas se o callback falhar',async()=>{
  const db=make();
  await expect(db.run('rows','readwrite',async tx=>{
    await idbResult(tx.objectStore('rows').put({id:'partial'}));throw Error('interrompido');
  })).rejects.toThrow('interrompido');
  expect(await db.run('rows','readonly',tx=>idbResult(tx.objectStore('rows').getAll()))).toEqual([]);
  await db.run('rows','readwrite',tx=>idbResult(tx.objectStore('rows').put({id:'committed'})));
  db.close();expect(await db.run('rows','readonly',tx=>idbResult(tx.objectStore('rows').getAll()))).toEqual([{id:'committed'}]);
});

it('permite nova tentativa quando o navegador volta a oferecer armazenamento local',async()=>{
  const db=make();const original=globalThis.indexedDB;vi.stubGlobal('indexedDB',undefined);
  await expect(db.open()).rejects.toThrow('armazenamento local está indisponível');
  vi.stubGlobal('indexedDB',original);await expect(db.open()).resolves.toBeDefined();
});

it('orienta sobre outra aba bloqueadora e fecha a conexão da atualização rejeitada',async()=>{
  const name=`blocked-${crypto.randomUUID()}`,old=await idbResult(indexedDB.open(name,1));
  const db=make(10,connection=>createStore(connection,'rows','id'),name);
  try{await expect(db.open()).rejects.toThrow('Outra aba');}finally{old.close();}
  // A primeira requisição bloqueada conclui e se fecha antes da seguinte.
  await expect(db.open()).resolves.toBeDefined();
});
