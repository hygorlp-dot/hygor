import {activeCompany,companyStorageKey} from '../../lib/company-scope.js';
import {createLocalDatabase,createStore,idbResult} from '../../lib/local-indexed-db.js';
import {buildSectionDelta,expandSectionDelta} from './section-delta.js';
/** @typedef {Record<string, unknown>} Snapshot */
/** @typedef {{id:string, role:string, companyId?:string, obraId?:string, active?:boolean, accessTabs?:string[]}} RecoveryUser */
/** @typedef {{owner:string, tab:string, revision:string}} JournalReceipt */
/** @typedef {{user:RecoveryUser, tab:string, base:Snapshot}} JournalContext */
/** @typedef {JournalContext & {intended:Snapshot}} ProtectedEdit */
/** @typedef {{changed:{id:string|number}[], removed:(string|number)[]}} ChangeDelta */
/** @typedef {{delta?:ChangeDelta, base?:unknown, intended?:unknown}} SnapshotChange */
/** @typedef {JournalReceipt & {scope:string, changes:Record<string,SnapshotChange>, createdAt:string}} JournalRow */
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const excluded=new Set(['attendance','attendanceLocks','unlockRequests','dailyCheckDate','attendanceOperationReceipts','operationalCommandReceipts','changeLog']);
export const recoveryScope=user=>JSON.stringify([user.companyId||activeCompany(),user.id,user.role,user.obraId||'',user.active!==false,[...(user.accessTabs||[])].sort()]);
export function recoveryTab(){let id=sessionStorage.getItem('marcell-recovery-tab');if(!id){id=crypto.randomUUID();sessionStorage.setItem('marcell-recovery-tab',id);}return id;}
/** @param {Snapshot} base @param {Snapshot} intended @returns {Record<string, SnapshotChange>} */
export function snapshotChanges(base,intended){
 const changes={};
 for(const key of new Set([...Object.keys(base||{}),...Object.keys(intended||{})])){
  if(excluded.has(key)||same(base?.[key],intended?.[key]))continue;
  const delta=buildSectionDelta(base?.[key],intended?.[key]);
  changes[key]=delta?{delta}:{base:base?.[key],intended:intended?.[key]};
 }
 return changes;
}
export function expandSnapshot(changes,current){
 const base={},intended={};
 for(const [key,change] of Object.entries(changes)){
  if(change.delta){const expanded=expandSectionDelta(change.delta,current[key]);const created=new Set(change.delta.changed.filter(r=>!change.delta.original.some(b=>String(b.id)===String(r.id))).map(r=>String(r.id)));base[key]=expanded.base.filter(r=>!created.has(String(r.id)));intended[key]=expanded.incoming;}
  else{base[key]=change.base;intended[key]=change.intended;}
 }
 return {base,intended};
}
export function canRecoverSnapshot(row,user,current){
 if(row.scope!==recoveryScope(user)||user.active===false)return false;
 if(!user.obraId)return true;
 for(const [section,change] of Object.entries(row.changes)){
  const records=change.delta?[...change.delta.changed,...change.delta.original]:[...(Array.isArray(change.base)?change.base:[]),...(Array.isArray(change.intended)?change.intended:[])];
  for(const record of records){
   const stored=(Array.isArray(current[section])?current[section]:[]).find(r=>String(r.id)===String(record.id));
   if((record.obraId&&String(record.obraId)!==String(user.obraId))||(stored?.obraId&&String(stored.obraId)!==String(user.obraId)))return false;
  }
 }
 return true;
}
export function createSnapshotJournal(name='marcell-workspace-edits-v1'){
 const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('marcell-workspace-journal'));};
 const db=createLocalDatabase(name,10,database=>{createStore(database,'edits',['owner','tab'],['owner']);}),known=new Map();
 const read=(owner,tab)=>db.run('edits','readonly',tx=>idbResult(tx.objectStore('edits').get([owner,tab])));
 const key=(owner,tab)=>JSON.stringify([owner,tab]);
 return {db,
  adopt:(/** @type {JournalReceipt} */ row)=>known.set(key(row.owner,row.tab),row.revision),
  read,
  /** @param {string} owner @param {string} tab @returns {Promise<JournalRow|undefined>} */
  async readLatest(owner,tab){return db.run('edits','readonly',async tx=>{
   const edits=tx.objectStore('edits'),current=await idbResult(edits.get([owner,tab]));
   return current||(await idbResult(edits.index('owner').getAll(owner))).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))).at(-1);
  });},
  /** @param {ProtectedEdit} edit */
  async protect({user,tab,base,intended}){
   const row={owner:user.id,tab,scope:recoveryScope(user),revision:crypto.randomUUID(),changes:snapshotChanges(base,intended),createdAt:new Date().toISOString()};
   // Dados de autenticação nunca pertencem a uma intenção de edição.
   if(/"(?:password|senha|accessToken|refreshToken)"\s*:/.test(JSON.stringify(row.changes)))throw Error('A edição contém credenciais e não pode ser recuperada por esta fila.');
   await db.run('edits','readwrite',async tx=>{
    const edits=tx.objectStore('edits'),existing=await idbResult(edits.get([row.owner,tab]));
    if(existing&&existing.revision!==known.get(key(row.owner,tab)))throw Error('Outra aba ou uma edição anterior está protegida. Revise antes de substituir.');
    await idbResult(edits.put(row));
   });known.set(key(row.owner,tab),row.revision);changed();return {owner:row.owner,tab,revision:row.revision};
  },
  /** @param {JournalReceipt|null|undefined} receipt */
  async release(receipt){if(!receipt)return;await db.run('edits','readwrite',async tx=>{const edits=tx.objectStore('edits'),row=await idbResult(edits.get([receipt.owner,receipt.tab]));if(row?.revision===receipt.revision)await idbResult(edits.delete([receipt.owner,receipt.tab]));});changed();},
 };
}
const companyJournals=new Map();
export const snapshotJournal=new Proxy(/** @type {ReturnType<typeof createSnapshotJournal>} */ ({}), {get(_target,property){
 const companyId=activeCompany();
 if(!companyJournals.has(companyId))companyJournals.set(companyId,createSnapshotJournal(companyStorageKey('workspace-edits-v1')));
 const journal=companyJournals.get(companyId),value=journal[property];
 return typeof value==='function'?value.bind(journal):value;
}});
