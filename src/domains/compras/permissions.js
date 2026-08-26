const PURCHASE_MANAGEMENT_ROLES = Object.freeze(["admin", "compras", "financeiro"]);

export const canManagePurchases = role =>
  PURCHASE_MANAGEMENT_ROLES.includes(String(role || ""));
