import {canManagePurchases} from "../src/domains/compras/permissions.js";

export const validatePurchaseChanges = (user, previous = [], next = []) => {
  const nextIds = new Set((next || []).map(order => String(order.id)));
  const removed = (previous || []).filter(order => !nextIds.has(String(order.id)));
  if (!removed.length) return "";
  if (!canManagePurchases(user?.role))
    return "Seu perfil não possui permissão para excluir compras.";
  if (user?.obraId && removed.some(order => String(order.obraId) !== String(user.obraId)))
    return "Não é permitido excluir compras de outra obra.";
  return "";
};
