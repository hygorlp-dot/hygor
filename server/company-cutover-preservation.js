import {cutoverHash,requireCutover,verifyCutoverBundle} from './company-cutover.js';

export const PRESERVATION_VERSION=1;
export const preservedCutoverTable=table=>table==='auth_rate_limits'||table.startsWith('ponto_');
export const volatileCutoverRow=(table,row)=>table==='company_app_data'&&(row.key==='onedrive_auth_v1'||String(row.key||'').startsWith('arced_presence__'));
const normalized=rows=>(rows||[]).map(cutoverHash).sort();
const equalRows=(a,b)=>cutoverHash(normalized(a))===cutoverHash(normalized(b));
const operationalRows=(table,rows)=>(rows||[]).filter(row=>!volatileCutoverRow(table,row));

// Builds another immutable LOCAL rehearsal, never an activation certificate.
// The approved operational target is retained; current volatile facts are not
// imported into either company, into the SQL payload, or into its journal.
export function preparePreservingCompanyCutover({bundle,capture,target=bundle.after}){
 verifyCutoverBundle(bundle);
 requireCutover(capture&&typeof capture==='object','Captura atual ausente.');
 requireCutover(Object.keys(capture).every(table=>Object.hasOwn(bundle.before,table)),'Inventário da captura mudou; conferir o catálogo completo.');
 requireCutover(cutoverHash(Object.keys(target).sort())===cutoverHash(Object.keys(bundle.after).sort()),'Inventário do alvo divergente.');
 const before={},after={},preserved=[];
 for(const table of Object.keys(bundle.before)){
  if(bundle.external[table]){before[table]=structuredClone(bundle.before[table]);after[table]=structuredClone(target[table]);continue;}
  requireCutover(Array.isArray(capture[table]),`Captura atual incompleta: ${table}.`);
  requireCutover(Array.isArray(target[table]),`Alvo incompleto: ${table}.`);
  if(preservedCutoverTable(table)){
   // Legacy plans had wrongly emptied rate limits. They are explicitly
   // preserved. Any proposed change to REP-P/ARP/clock evidence is refused.
   if(table.startsWith('ponto_'))requireCutover(equalRows(bundle.before[table],target[table]),`Alteração protegida do ponto recusada: ${table}.`);
   before[table]=[];after[table]=[];preserved.push(table);continue;
  }
  before[table]=structuredClone(operationalRows(table,capture[table]));
  after[table]=structuredClone(operationalRows(table,target[table]));
  requireCutover(equalRows(before[table],operationalRows(table,bundle.before[table])),`Origem operacional mudou: ${table}; recapturar e conferir.`);
 }
 const {id:_oldId,...content}=structuredClone(bundle);
 Object.assign(content,{before,after,preservation:{version:PRESERVATION_VERSION,tables:preserved.sort(),companyDataKeys:['onedrive_auth_v1','arced_presence__*'],policy:'leave-live-rows-untouched; exclude-from-CAS-and-journal'},parentBundleId:bundle.id});
 content.order=bundle.order.filter(table=>!preservedCutoverTable(table)&&!equalRows(before[table],after[table]));
 // New, reviewed target overlays may add changes to previously equal tables.
 requireCutover(Object.keys(before).every(table=>bundle.external[table]||preservedCutoverTable(table)||equalRows(before[table],after[table])||content.order.includes(table)), 'Alteração fora da ordem relacional aprovada.');
 return {...content,id:cutoverHash(content)};
}

export function assertCutoverPreservation(bundle){
 // The veto also protects old packages: changing an ARP table cannot be
 // enabled merely by calling the older rehearsal compiler directly.
 for(const table of Object.keys(bundle.before))if(table.startsWith('ponto_'))requireCutover(equalRows(bundle.before[table],bundle.after[table]),`Alteração protegida do ponto recusada: ${table}.`);
 if(!bundle.preservation)return;
 requireCutover(bundle.preservation.version===PRESERVATION_VERSION,'Versão de preservação desconhecida.');
 const expected=Object.keys(bundle.before).filter(preservedCutoverTable).sort();
 requireCutover(cutoverHash(bundle.preservation.tables)===cutoverHash(expected),'Escopo de preservação divergente.');
 for(const [table,rows]of Object.entries(bundle.before)){
  if(preservedCutoverTable(table))requireCutover(!rows.length&&!bundle.after[table].length&&!bundle.order.includes(table),'Tabela preservada contém mutação ou imagem de dados.');
  requireCutover(![...rows,...bundle.after[table]].some(row=>volatileCutoverRow(table,row)),'Dado volátil incluído no pacote transacional.');
 }
}
