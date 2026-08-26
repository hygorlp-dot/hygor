// Permissões do domínio de Conciliação Bancária. Sem React, DOM ou persistência.

const CONCILIACAO_VIEW_ROLES = Object.freeze(["admin", "financeiro", "rh"]);
const CONCILIACAO_OPERAR_ROLES = Object.freeze(["admin", "financeiro"]);
const CONCILIACAO_TRABALHISTA_ROLES = Object.freeze(["admin", "financeiro", "rh"]);
const CONCILIACAO_ELEVADO_ROLES = Object.freeze(["admin"]);

export const podeVerConciliacao = role => CONCILIACAO_VIEW_ROLES.includes(String(role || ""));
export const podeOperarConciliacao = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));
export const podeOperarConciliacaoTrabalhista = role => CONCILIACAO_TRABALHISTA_ROLES.includes(String(role || ""));

// Desfazer, reabrir período e arquivar extrato exigem permissão elevada -
// são operações que alteram fatos financeiros já fechados/auditados.
export const podeDesfazerConciliacao = role => CONCILIACAO_ELEVADO_ROLES.includes(String(role || ""));
export const podeReabrirFechamento = role => CONCILIACAO_ELEVADO_ROLES.includes(String(role || ""));
export const podeArquivarExtrato = role => CONCILIACAO_ELEVADO_ROLES.includes(String(role || ""));
export const podeFecharPeriodo = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));
export const podeCriarRegra = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));

