import {podeAcessarAba} from '../administracao/abas-acesso.js';

const financeRoles=['admin','financeiro'];

export function canApprovePayableInvoice(user,obraId){
 return Boolean(user?.active!==false&&financeRoles.includes(user?.role)&&podeAcessarAba(user,'fin')&&
  (!user.obraId||String(user.obraId)===String(obraId)));
}

export function canRecordPayable(user,type,obraId,pageId){
 if(!user||user.active===false||!['nota','pedido'].includes(type)||
  (user.obraId&&String(user.obraId)!==String(obraId)))return false;
 const byFinance=financeRoles.includes(user.role)&&podeAcessarAba(user,'fin');
 const byPurchasing=type==='pedido'&&[...financeRoles,'compras'].includes(user.role)&&podeAcessarAba(user,'cmp');
 return pageId==='cmp'?byPurchasing:pageId==='fin'?byFinance:byFinance||byPurchasing;
}
