import { currentCompany } from "./company-context.js";
import { compactProfiles, profileIndexOutdated } from "./data-codec.js";

const PROFILE_KEY = "arced_auth_profiles_v1";

export function createCompanyProfileIndex(db) {
  const salvarIndicePerfis = async payload => {
    const agora=new Date().toISOString(),value=compactProfiles(payload);
    const {error}=await db.from("company_app_data").upsert({company_id:currentCompany(),key:PROFILE_KEY,value,updated_at:agora,updated_by:null},{onConflict:"company_id,key"});
    if(error)console.error("Não foi possível atualizar o índice de login:",error.message);
  };

  // Regrava o índice só quando o que ele guarda (usuários e obras) mudou.
  const indicePerfisMudou=(antes,depois)=>!igualIndice(antes,depois);
  const igualIndice=(antes,depois)=>!profileIndexOutdated(compactProfiles(antes),depois);
  // Atualização do índice é acessória: nunca derruba a carga ou a gravação que
  // já deu certo, e nunca troca um índice por outro sem nenhum usuário.
  const atualizarIndicePerfisSeguro=async payload=>{
    if(!(payload?.usuarios||[]).length)return;
    try{await salvarIndicePerfis(payload);}
    catch(error){console.error("Não foi possível atualizar o índice de login:",error?.message||error);}
  };
  const lerIndicePerfis = async () => {
    const {data,error}=await db.from("company_app_data").select("value").eq("company_id",currentCompany()).eq("key",PROFILE_KEY).maybeSingle();
    if(error)throw error;
    return data?.value||null;
  };

  return { salvarIndicePerfis, lerIndicePerfis, indicePerfisMudou, atualizarIndicePerfisSeguro };
}
