export const COMMERCIAL_SCHEMA_VERSION=3;
export const OPPORTUNITY_STAGES=Object.freeze(["diagnostico","escopo","proposta","negociacao","fechamento"]);
export const TERMINAL_OPPORTUNITY_STAGES=Object.freeze(["ganho","perdido","arquivado"]);
export const STAGE_PROBABILITY=Object.freeze({diagnostico:20,escopo:35,proposta:50,negociacao:70,fechamento:90,ganho:100,perdido:0,arquivado:0});
export const LEGACY_STAGE_MAP=Object.freeze({
  reuniao_agendada:"diagnostico",reuniao_realizada:"diagnostico",escopo:"escopo",proposta_elaboracao:"escopo",
  proposta_enviada:"proposta",aguardando_decisao:"proposta",negociacao:"negociacao",
  contrato_elaboracao:"fechamento",contrato_enviado:"fechamento",aguardando_assinatura:"fechamento",contrato_assinado:"fechamento",aguardando_entrada:"fechamento",
  contratado:"ganho",transferido:"ganho",perdido:"perdido",arquivado:"arquivado",
});
export const LEAD_STATES=Object.freeze(["novo","em_atendimento","aguardando_retorno","qualificado","desqualificado","arquivado","convertido"]);
