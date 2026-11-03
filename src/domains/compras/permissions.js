import {podeAcessarAba} from '../administracao/abas-acesso.js';
const PURCHASE_MANAGEMENT_ROLES = Object.freeze(["admin", "compras", "financeiro"]);

export const canManagePurchases = role =>
  PURCHASE_MANAGEMENT_ROLES.includes(String(role || ""));

export const canReceivePurchases=role=>canManagePurchases(role)||['engenheiro','engenheiro_auditor'].includes(role);

// Espelha os perfis de recebimento existentes na API; não concede acesso.
export const canActOnPurchaseQueue=(user,row)=>{
 if(!user||user.active===false||user.ativo===false||!podeAcessarAba(user,'cmp')||user.obraId&&user.obraId!==row.obraId)return false;
 if(row.type!=='order')return true;
 return row.stage==='recebimentos'?canReceivePurchases(user.role):canManagePurchases(user.role);
};
