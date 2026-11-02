import { podeAcessarAba } from '../src/domains/administracao/abas-acesso.js';
import { FILE_ROLES } from '../src/domains/arquivos/commands.js';
import { folderAccess } from '../src/domains/arquivos/access.js';
export function validateFileCabinetScope({user={},data={},command={}}) {
  if (!podeAcessarAba(user,'arquivos') || !FILE_ROLES.includes(user.role) || user.active===false) return {ok:false,error:'Seu perfil não pode alterar os arquivos da obra.'};
  const obraId=command.payload?.obraId;
  if (!obraId || !(data.obras||[]).some(item=>item.id===obraId) || (user.role!=='admin'&&user.obraId&&String(user.obraId)!==String(obraId))) return {ok:false,error:'Obra não disponível para seu perfil.'};
  const cabinet=(data.workFileCabinets||[]).find(item=>item.obraId===obraId);
  const p=command.payload||{};
  if(command.type==='ARQUIVOS_PERMISSAO_ALTERADA'&&user.role!=='admin')return {ok:false,error:'Somente o administrador pode definir permissões.'};
  if(cabinet){const doc=cabinet.documents?.find(item=>item.id===p.id),folder=cabinet.folders?.find(item=>item.id===p.id);if([doc?.folderId,folder?.id,p.folderId,p.parentId].filter(id=>id!=null).some(id=>!folderAccess(cabinet,id,user,'write')))return {ok:false,error:'Pasta não disponível para alteração.'};}
  return {ok:true,obraId,scope:'work'};
}
