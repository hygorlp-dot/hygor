// Permissões do domínio de aprovações. Sem React, DOM ou persistência.

export const APROVACOES_ADMIN_ROLES = Object.freeze(["admin"]);

export const podeAdministrarPoliticas = role => APROVACOES_ADMIN_ROLES.includes(String(role || ""));

// Decidir/aprovar uma etapa não é restrito por papel do sistema - é restrito
// por ESTAR na lista de elegíveis daquela etapa (resolvida pelo motor). Esta
// função só cobre ações administrativas (criar/editar/publicar política,
// gerenciar delegações de outros usuários).
export const podeGerenciarDelegacoes = role => ["admin", "financeiro", "compras"].includes(String(role || ""));
