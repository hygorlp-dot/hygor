import { podeAcessarAba } from '../src/domains/administracao/abas-acesso.js';
import { FILE_ROLES } from '../src/domains/arquivos/commands.js';
export function validateFileCabinetScope({user={},data={},command={}}) {
  if (!podeAcessarAba(user,'arquivos') || !FILE_ROLES.includes(user.role) || user.active===false) return {ok:false,error:'Seu perfil não pode alterar os arquivos da obra.'};
  const obraId=command.payload?.obraId;
  if (!obraId || !(data.obras||[]).some(item=>item.id===obraId) || (user.role!=='admin'&&user.obraId&&String(user.obraId)!==String(obraId))) return {ok:false,error:'Obra não disponível para seu perfil.'};
  return {ok:true,obraId,scope:'work'};
}
