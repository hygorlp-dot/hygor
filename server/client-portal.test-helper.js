import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {camadaSupabase,PAPEIS_SUPABASE} from "./ponto-eletronico/banco-pglite.test-helper.js";
export async function newPortalDatabase(){
  const pg=new PGlite();
  await pg.exec(PAPEIS_SUPABASE);
  await pg.exec(readFileSync("migrations/005_client_portal_foundation.up.sql","utf8"));
  await pg.exec(readFileSync("migrations/20261114125534_client_portal_atomic_publication.up.sql","utf8"));
  const base=camadaSupabase(pg);
  const enrich=async(result,join)=>{
    if(!join||result.error||!result.data)return result;
    const add=async row=>({...row,client_portal_users:(await pg.query("select * from client_portal_users where id=$1",[row.portal_user_id])).rows[0]});
    return {...result,data:Array.isArray(result.data)?await Promise.all(result.data.map(add)):await add(result.data)};
  };
  return {pg,from(table){
    const builder=base.from(table);let join=false;
    const proxy=new Proxy(builder,{get(target,key){
      if(key==="select")return columns=>{join=String(columns).includes("!inner");target.select(join?"*":columns);return proxy;};
      if(key==="single"||key==="maybeSingle")return ()=>target.maybeSingle().then(result=>enrich(result,join));
      if(key==="then")return (resolve,reject)=>target.then(result=>enrich(result,join).then(resolve),reject);
      if(typeof target[key]==="function")return (...args)=>{target[key](...args);return proxy;};
      return target[key];
    }});return proxy;
  },async rpc(name,args){const result=await base.rpc(name,args);return name==="client_portal_change_password"&&!result.error?{...result,data:result.data[0][name]}:result;}};
}
