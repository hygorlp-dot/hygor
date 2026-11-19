import {parseCompanyFileReference} from '../src/domains/arquivos/company-file-reference.js';
import {podeAcessarAba} from '../src/domains/administracao/abas-acesso.js';

export async function resolvePublishedCompanyFile({reference,companyId,projectId,storage}){
 const file=parseCompanyFileReference(reference);
 if(!file||file.companyId!==companyId||file.projectId!==projectId||file.projectId==='chat')return {status:403,body:{ok:false,error:'Arquivo indisponível para este acesso.'}};
 const {data,error}=await storage.from(file.bucket).createSignedUrl(file.name,300);
 if(error||!data?.signedUrl)return {status:404,body:{ok:false,error:'Arquivo não encontrado.'}};
 return {status:200,body:{ok:true,url:data.signedUrl,expiresIn:300}};
}

export async function resolveCompanyFile({reference,companyId,user,works,storage}){
 const file=parseCompanyFileReference(reference);
 if(!file)return {status:400,body:{ok:false,error:'Referência de arquivo inválida.'}};
 if(!user||user.active===false||file.companyId!==companyId)return {status:403,body:{ok:false,error:'Arquivo indisponível para este acesso.'}};
 const permitted=file.projectId==='chat'
  ?podeAcessarAba(user,'chat')
  :(works||[]).some(work=>String(work.id)===file.projectId)&&(!user.obraId||String(user.obraId)===file.projectId)&&['rdo','conferencia'].some(tab=>podeAcessarAba(user,tab));
 if(!permitted)return {status:403,body:{ok:false,error:'Arquivo indisponível para este acesso.'}};
 const {data,error}=await storage.from(file.bucket).createSignedUrl(file.name,300);
 if(error||!data?.signedUrl)return {status:404,body:{ok:false,error:'Arquivo não encontrado.'}};
 return {status:200,body:{ok:true,url:data.signedUrl,expiresIn:300}};
}
