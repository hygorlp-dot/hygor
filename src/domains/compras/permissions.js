import {podeAcessarAba} from '../administracao/abas-acesso.js';
const PURCHASE_MANAGEMENT_ROLES = Object.freeze(["admin", "compras", "financeiro"]);

export const canManagePurchases = role =>
  PURCHASE_MANAGEMENT_ROLES.includes(String(role || ""));

// Espelha os perfis de recebimento existentes na API; não concede acesso.
export const canActOnPurchaseQueue=(user,row)=>{
 if(!user||user.active===false||user.ativo===false||!podeAcessarAba(user,'cmp')||user.obraId&&user.obraId!==row.obraId)return false;
 if(row.type!=='order')return true;
 return row.stage==='recebimentos'?['admin','compras','financeiro','engenheiro','engenheiro_auditor'].includes(user.role):canManagePurchases(user.role);
};
