import {loadEnv} from 'vite';
import {createClient} from '@supabase/supabase-js';
import {decodeAppData} from '../server/data-codec.js';
import {mergeDomainRows} from '../server/domain-row-routing.js';
import {attendanceObraKeyPrefix,mergeAttendanceObjects,withAttendanceSyncedAt} from '../server/attendance-obra-routing.js';
import {archivedLaborKeys,rebuildArchivedLaborCosts} from '../server/financial-archived-costs-source.js';
import {loadCanonicalDre} from '../server/financial-dre-integration.js';

// Leitura administrativa autorizada para a revisão. Nenhuma sessão do usuário,
// senha ou chave é copiada para os testes ou para o navegador de revisão dele.
export async function readRealFinanceData(){
 const env=loadEnv('development',process.cwd(),'');
 const fetchReadOnly=(input,options={})=>{
  const method=String(options.method||input?.method||'GET').toUpperCase();
  if(!['GET','HEAD'].includes(method))throw new Error('A auditoria aceita somente leitura da base.');
  return fetch(input,options);
 };
 const db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchReadOnly}});
 const key='arced_ponto_v1',company=env.COMPANY_ID||'arcd';
 const domains=['ponto','lookahead','config','equipamentos','patrimonio','rdo','orcamentos'];
 const entries=domains.map(domain=>[domain,`${key}__${domain}`]);
 const [core,split,attendance]=await Promise.all([
  db.from('company_app_data').select('value,updated_at').eq('company_id',company).eq('key',key).single(),
  db.from('company_app_data').select('key,value,updated_at').eq('company_id',company).in('key',entries.map(([,k])=>k)),
  db.from('company_app_data').select('key,value,updated_at').eq('company_id',company).like('key',`${attendanceObraKeyPrefix(`${key}__ponto`)}%`).order('updated_at',{ascending:true}),
 ]);
 for(const response of [core,split,attendance])if(response.error)throw new Error(`Falha na leitura da base (${response.error.code||response.status}).`);
 const payload=decodeAppData(core.data.value);
 const parts=Object.fromEntries(entries.flatMap(([domain,k])=>{const row=split.data.find(r=>r.key===k);return row?[[domain,decodeAppData(row.value)]]:[];}));
 const data=mergeDomainRows(payload,parts);
 data.attendance=mergeAttendanceObjects(data.attendance||{},...attendance.data.map(row=>{const value=decodeAppData(row.value);return withAttendanceSyncedAt(value.attendance,value.attendanceSyncedAt);}));
 const expected=archivedLaborKeys(data,key);
 const [archiveRows,canonical]=await Promise.all([
  expected.length?db.from('company_app_data').select('key,value').eq('company_id',company).in('key',expected.map(item=>item.key)):Promise.resolve({data:[],error:null}),
  loadCanonicalDre(db,company),
 ]);
 if(archiveRows.error)throw new Error('Falha ao ler os custos arquivados.');
 const rebuilt=rebuildArchivedLaborCosts({data,archiveRows:archiveRows.data,key});
 return {data:rebuilt.data,canonical,missingArchives:rebuilt.missing.length,updatedAt:core.data.updated_at};
}
