// Permissões do domínio de Conciliação Bancária. Sem React, DOM ou persistência.

export const CONCILIACAO_VIEW_ROLES = Object.freeze(["admin", "financeiro"]);
export const CONCILIACAO_OPERAR_ROLES = Object.freeze(["admin", "financeiro"]);
export const CONCILIACAO_ELEVADO_ROLES = Object.freeze(["admin"]);

export const podeVerConciliacao = role => CONCILIACAO_VIEW_ROLES.includes(String(role || ""));
export const podeOperarConciliacao = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));

// Desfazer, reabrir período e arquivar extrato exigem permissão elevada -
// são operações que alteram fatos financeiros já fechados/auditados.
export const podeDesfazerConciliacao = role => CONCILIACAO_ELEVADO_ROLES.includes(String(role || ""));
export const podeReabrirFechamento = role => CONCILIACAO_ELEVADO_ROLES.includes(String(role || ""));
export const podeArquivarExtrato = role => CONCILIACAO_ELEVADO_ROLES.includes(String(role || ""));
export const podeFecharPeriodo = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));
export const podeCriarRegra = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));

// Conciliação em lote e valores acima do limite configurado exigem o mesmo
// nível de quem já opera a fila - mas ficam isolados aqui para o caso de a
// regra de negócio divergir no futuro (ex.: exigir admin para lotes grandes).
export const podeConciliarEmLote = role => CONCILIACAO_OPERAR_ROLES.includes(String(role || ""));

// Valor acima deste limite exige confirmação adicional explícita na tela
// antes de aplicar a conciliação (não bloqueia, apenas exige um segundo clique).
export const LIMITE_CONFIRMACAO_ADICIONAL_CENTAVOS = 5_000_00;
export const exigeConfirmacaoAdicional = valorCentavos =>
  Math.abs(valorCentavos) >= LIMITE_CONFIRMACAO_ADICIONAL_CENTAVOS;
