export const COMMERCIAL_SCHEMA_VERSION=2;
export const COMMERCIAL_DESTINATIONS=Object.freeze(["com_workspace","com_pipeline","com_relationships","com_deals","com_management"]);
export const LEGACY_COMMERCIAL_ROUTE=Object.freeze({
  com_dash:"com_workspace",com_agenda:"com_workspace",com_reunioes:"com_workspace",com_tarefas:"com_workspace",
  com_funil:"com_pipeline",com_jornada:"com_pipeline",com_perdas:"com_pipeline",
  com_leads:"com_relationships",com_clientes:"com_relationships",com_parceiros:"com_relationships",com_indicacoes:"com_relationships",
  com_propostas:"com_deals",com_negociacoes:"com_deals",com_contratos:"com_deals",com_metas:"com_management",com_relatorios:"com_management",
});
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
