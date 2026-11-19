// Existing backup operations run independently in each ready company context.
// A failed connection must neither combine datasets nor skip the other company.
export async function runCompanyBackupCron({companies,run,ready,job}){
 const results=[];
 for(const {id}of companies){
  try{const result=await run(id,async()=>{await ready(id);return job();});results.push({companyId:id,ok:result?.ok!==false,result});}
  catch(error){results.push({companyId:id,ok:false,status:error?.status||503,error:'Não foi possível concluir o backup desta empresa. Confira sua conexão e prontidão.'});}
 }
 return {ok:results.length>0&&results.every(r=>r.ok),companies:results};
}
