import {createClient} from "@supabase/supabase-js";
import {decodeAppData} from "../server/data-codec.js";

const required=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
const unavailable=required.find(key=>!process.env[key]||String(process.env[key]).startsWith("@"));
if(unavailable){
  console.log(`Integridade de cadastros: auditoria remota ignorada (${unavailable} indisponível).`);
  process.exit(0);
}

const company=process.env.COMPANY_ID||"arcd";
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const catalogs=[
  "usuarios","obras","employees","terceirizados","unidades","materiais",
  "fornecedores","composicoes","composicoesEmpresa","fases","categoriasDesp",
];
const idSet=value=>new Set((Array.isArray(value)?value:[]).map(item=>String(item?.id||"")).filter(Boolean));

const {data:row,error}=await db.from("company_app_data")
  .select("value,updated_at").eq("company_id",company).eq("key","arced_ponto_v1").single();
if(error)throw error;
const current=decodeAppData(row.value);
const currentCounts=Object.fromEntries(catalogs.map(key=>[key,Array.isArray(current[key])?current[key].length:0]));

const {data:events,error:auditError}=await db.from("audit_events")
  .select("id,created_at,action,actor_id,before_snapshot,after_snapshot")
  .eq("company_id",company).order("created_at",{ascending:false}).limit(500);
if(auditError)throw auditError;

const suspicious=[];
const recoverable=new Map(catalogs.map(key=>[key,new Set()]));
for(const event of events||[]){
  const before=event.before_snapshot||{},after=event.after_snapshot||{};
  for(const key of catalogs){
    if(!Array.isArray(before[key])||!Array.isArray(after[key]))continue;
    const previous=idSet(before[key]),next=idSet(after[key]);
    const removed=[...previous].filter(id=>!next.has(id));
    const added=[...next].filter(id=>!previous.has(id));
    if(removed.length){
      const currentIds=idSet(current[key]);
      removed.filter(id=>!currentIds.has(id)).forEach(id=>recoverable.get(key).add(id));
      suspicious.push({
        eventId:event.id,at:event.created_at,action:event.action,
        section:key,before:previous.size,after:next.size,removed:removed.length,added:added.length,
      });
    }
  }
}

console.log(JSON.stringify({
  updatedAt:row.updated_at,
  currentCounts,
  suspicious:suspicious.slice(0,100),
  recoverableCounts:Object.fromEntries([...recoverable].map(([key,ids])=>[key,ids.size])),
},null,2));
