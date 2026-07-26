export const LOOKAHEAD_HORIZONS=Object.freeze([3,4,6]);
export const DEFAULT_LOOKAHEAD_HORIZON=6;
export const LOOKAHEAD_PACKAGE_STATUS=Object.freeze({
  UNREVIEWED:"nao_analisado",RESTRICTED:"restrito",READY:"pronto",COMMITTED:"comprometido",
  IN_PROGRESS:"em_execucao",DONE:"concluido",NOT_DONE:"nao_concluido",CANCELLED:"cancelado",
});
export const CONSTRAINT_STATUS=Object.freeze({OPEN:"aberta",IN_PROGRESS:"em_tratamento",RELEASED:"liberada",OVERDUE:"vencida",CANCELLED:"cancelada"});
export const CONSTRAINT_CATEGORIES=Object.freeze(["projeto","informacao","material","mao_de_obra","equipamento","acesso","seguranca","qualidade","aprovacao","financeiro","cliente","fornecedor","predecessora","interferencia","frente_de_servico","clima","licenca","outro"]);
