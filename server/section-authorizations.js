// Política única para mutações do blob legado. A UI pode ocultar um botão,
// mas a autorização definitiva ocorre antes de qualquer update no servidor.
const SECTION_ROLES = Object.freeze({
  usuarios:["admin"], config:["admin"], obras:["admin"], condominios:["admin"],
  orcamentos:["admin","engenheiro","engenheiro_auditor"], budgetBaselines:["admin"],
  planos:["admin","engenheiro","engenheiro_auditor"], rdos:["admin","engenheiro"],
  productionWbs:["admin","engenheiro","engenheiro_auditor","planejamento"], scheduleCalendars:["admin","engenheiro","planejamento"], scheduleBaselines:["admin","diretoria"], scheduleActivities:["admin","engenheiro","engenheiro_auditor","planejamento"], scheduleDependencies:["admin","engenheiro","engenheiro_auditor","planejamento"], activityResources:["admin","engenheiro","planejamento"], activityLocations:["admin","engenheiro","planejamento"], lookaheadWindows:["admin","engenheiro","engenheiro_auditor","planejamento","mestre"], constraints:["admin","engenheiro","engenheiro_auditor","planejamento","mestre","qualidade","seguranca"], weeklyPlans:["admin","engenheiro","planejamento","mestre"], weeklyCommitments:["admin","engenheiro","planejamento","mestre"], progressRecords:["admin","engenheiro","planejamento","mestre"], productivityRecords:["admin","engenheiro","planejamento","mestre"], dailyLogs:["admin","engenheiro","mestre"],
  curvaAbcSnapshots:["admin","engenheiro","engenheiro_auditor"], planosSuprimento:["admin","engenheiro","engenheiro_auditor","compras"], marcosSuprimento:["admin","engenheiro","engenheiro_auditor","compras"], alertasSuprimento:["admin","engenheiro","engenheiro_auditor","compras"], reservasEstoque:["admin","compras","engenheiro","engenheiro_auditor"], suprimentosConfig:["admin","engenheiro","engenheiro_auditor"],
  conferencias:["admin","engenheiro","engenheiro_auditor"], qualidadeRegistros:["admin","engenheiro","engenheiro_auditor"],
  qualityPlans:["admin","engenheiro","qualidade"], inspectionTemplates:["admin","engenheiro","qualidade"], inspections:["admin","engenheiro","engenheiro_auditor","qualidade"], nonconformities:["admin","engenheiro","engenheiro_auditor","qualidade"], materialInspections:["admin","compras","estoque","engenheiro","qualidade"],
  safetyDocuments:["admin","seguranca","rh"], workerEligibility:["admin","seguranca","rh","engenheiro"], ppeDeliveries:["admin","seguranca"], toolboxTalks:["admin","seguranca","engenheiro"], jobRiskAnalyses:["admin","seguranca","engenheiro"], workPermits:["admin","seguranca","engenheiro"], safetyInspections:["admin","seguranca","engenheiro"], incidents:["admin","seguranca","engenheiro"], incidentActions:["admin","seguranca","engenheiro"],
  documents:["admin","engenheiro","engenheiro_auditor","documentos"], documentRevisions:["admin","engenheiro","engenheiro_auditor","documentos"], rfis:["admin","engenheiro","engenheiro_auditor","planejamento"], submittals:["admin","engenheiro","qualidade","compras"],
  changeEvents:["admin","engenheiro","diretoria"], cashflowScenarios:["admin","diretoria","financeiro"], cashflowProjectionItems:["admin","diretoria","financeiro"],
  wasteRecords:["admin","engenheiro","ambiental"], resourceConsumption:["admin","engenheiro","ambiental"], environmentalLicenses:["admin","engenheiro","ambiental"], punchItems:["admin","engenheiro","qualidade"], warranties:["admin","engenheiro","assistencia"], serviceTickets:["admin","engenheiro","assistencia"],
  solicitacoesCompra:["admin","compras","engenheiro","engenheiro_auditor"], pedidos:["admin","compras","financeiro"], cotacoes:["admin","compras"],
  fornecedores:["admin","compras","financeiro"], materiais:["admin","compras","engenheiro","engenheiro_auditor"], estoque:["admin","compras","engenheiro","engenheiro_auditor"], movEstoque:["admin","compras","engenheiro","engenheiro_auditor"],
  employees:["admin","rh"], attendance:["admin","rh","engenheiro"], attendanceLocks:["admin","rh"], unlockRequests:["admin","rh","engenheiro"], advances:["admin","rh"],
  titulosFolha:["admin","rh","financeiro"], pagamentosFolha:["admin","rh","financeiro"], rescisoes:["admin","rh","financeiro"], quinzenasArquivadas:["admin","rh"],
  payments:["admin","financeiro"], medicoes:["admin","financeiro"], outrasDesp:["admin","financeiro"], despesasEmpresa:["admin","financeiro"], caixaObra:["admin","financeiro"], notasFiscais:["admin","financeiro","compras"], documentosMovimentacoes:["admin","financeiro"], transacoes:["admin","financeiro"], reconciliationLinks:["admin","financeiro"], fechamentosFinanceiros:["admin"],
  equipamentos:["admin","engenheiro","engenheiro_auditor","compras","financeiro"], locacoesEquip:["admin","engenheiro","engenheiro_auditor","financeiro"], terceirizados:["admin","engenheiro","engenheiro_auditor","financeiro"], pagsTerceiros:["admin","financeiro"],
  comercial:["admin","comercial"],
  // Legado transitório: o cliente ainda gera mensagens de atividade. DATA-001
  // migra a prova para a trilha append-only do servidor; até lá, só papéis
  // operacionais podem anexar este histórico junto de uma seção autorizada.
  changeLog:["admin","engenheiro","engenheiro_auditor","compras","financeiro","rh","comercial"], dailyCheckDate:["admin","rh"],
});

const scoped = value => Array.isArray(value) ? value : [];
const hasForeignObra = (value, obraId) => scoped(value).some(item => item?.obraId && String(item.obraId) !== String(obraId));

export const authorizeSectionChanges = (user = {}, sections = {}) => {
  const keys=Object.keys(sections || {}).filter(key=>key&&!key.startsWith("__"));
  if (user.role === "admin") return "";
  for (const key of keys) {
    const roles=SECTION_ROLES[key];
    if (!roles) return `A seção ${key} não pode ser alterada por esta rota.`;
    if (!roles.includes(user.role)) return "Seu perfil não possui permissão para alterar esta seção.";
    if (user.obraId && hasForeignObra(sections[key], user.obraId)) return "Não é permitido alterar dados de outra obra.";
  }
  return "";
};

// Fatos efetivados não são apagados: permanecem para auditoria e recebem
// status cancelado/estornado com motivo. Rascunhos sem efeito financeiro
// continuam podendo ser descartados por seus fluxos próprios.
const APPEND_ONLY_SECTIONS=new Set([
  "conferencias","qualidadeRegistros","pedidos","cotacoes","notasFiscais",
  "payments","transacoes","caixaObra","movEstoque","outrasDesp",
  "curvaAbcSnapshots","planosSuprimento","marcosSuprimento","alertasSuprimento","reservasEstoque",
  "productionWbs","scheduleBaselines","scheduleActivities","scheduleDependencies","lookaheadWindows","constraints","weeklyPlans","weeklyCommitments","progressRecords","productivityRecords","dailyLogs",
  "qualityPlans","inspectionTemplates","inspections","nonconformities","materialInspections",
  "safetyDocuments","workerEligibility","ppeDeliveries","toolboxTalks","jobRiskAnalyses","workPermits","safetyInspections","incidents","incidentActions",
  "documents","documentRevisions","rfis","submittals",
  "changeEvents","cashflowScenarios","cashflowProjectionItems",
  "wasteRecords","resourceConsumption","environmentalLicenses","punchItems","warranties","serviceTickets",
  "pagsTerceiros","pagamentosFolha","medicoes","medicoesObra","medicoesTerc","rdos",
  "fechamentosFinanceiros",
  "employees","advances","terceirizados","rescisoes",
]);
const ids=value=>new Set((Array.isArray(value)?value:[]).map(item=>String(item?.id||"")).filter(Boolean));
const cancelado=item=>[
  "cancelado","cancelada","cancelled","canceled","estornado","estornada","reversed","arquivado","arquivada",
].includes(String(item?.status||"").toLowerCase());
const temMotivo=item=>String(item?.motivoCancelamento||item?.motivoEstorno||item?.motivoArquivamento||"").trim().length>0;
const porId=value=>new Map((Array.isArray(value)?value:[]).map(item=>[String(item?.id||""),item]).filter(([id])=>id));

const validarCancelamentos = (antes, depois, nome) => {
  const anteriores=porId(antes), posteriores=porId(depois);
  const removidos=[...anteriores.keys()].filter(id=>!posteriores.has(id));
  if(removidos.length)return `Não é permitido excluir fisicamente registros de ${nome}. Cancele ou estorne informando o motivo.`;
  for(const [id, anterior] of anteriores){
    const proximo=posteriores.get(id);
    if(proximo && !cancelado(anterior) && (cancelado(proximo)||proximo.deletedAt!=null)){
      if(proximo.deletedAt!=null&&!cancelado(proximo))return `A exclusão lógica de ${nome} exige status de cancelamento ou estorno e motivo.`;
      if(!temMotivo(proximo))return `O cancelamento de ${nome} exige um motivo.`;
    }
  }
  return "";
};

const validarPendenciasConferencia = (antes, depois) => {
  const anteriores=porId(antes), posteriores=porId(depois);
  for(const [conferenciaId, conferenciaAntes] of anteriores){
    const conferenciaDepois=posteriores.get(conferenciaId);
    if(!conferenciaDepois)continue; // a remoção da conferência já é tratada acima
    const erro=validarCancelamentos(conferenciaAntes?.pendencias||[],conferenciaDepois?.pendencias||[],"pendências de conferência");
    if(erro)return erro;
  }
  return "";
};
const validarFilhosFinanceiros = (antes, depois, section, child, label) => {
  const anteriores=porId(antes?.[section]),posteriores=porId(depois?.[section]);
  for(const [id,parentBefore] of anteriores){
    const parentAfter=posteriores.get(id);
    if(!parentAfter)continue;
    const erro=validarCancelamentos(parentBefore?.[child]||[],parentAfter?.[child]||[],label);
    if(erro)return erro;
  }
  return "";
};
const validarFechamentosImutaveis = (antes, depois) => {
  const anteriores=porId(antes),posteriores=porId(depois);
  for(const [id,fechamento] of anteriores){
    const proximo=posteriores.get(id);
    if(!proximo)return "Fechamentos contábeis não podem ser excluídos.";
    if(JSON.stringify(proximo)!==JSON.stringify(fechamento)){
      return "Fechamentos contábeis são imutáveis e não podem ser alterados.";
    }
  }
  return "";
};
const orcamentoAprovado=item=>["aprovado","aprovada"].includes(String(item?.versionStatus||item?.status||"").toLowerCase())||item?.locked===true||item?.imutavel===true;
const validarOrcamentosAprovados=(antes,depois)=>{
  const anteriores=porId(antes),posteriores=porId(depois);
  for(const [id,orcamento] of anteriores){
    if(!orcamentoAprovado(orcamento))continue;
    const proximo=posteriores.get(id);
    if(!proximo)return "Versões aprovadas do orçamento não podem ser excluídas.";
    if(JSON.stringify(proximo)!==JSON.stringify(orcamento))return "Versões aprovadas do orçamento são imutáveis. Crie uma revisão para alterar valores ou composições.";
  }
  return "";
};
export const validateNoPhysicalDeletes = (previous = {}, next = {}) => {
  for(const key of APPEND_ONLY_SECTIONS){
    if(!Object.prototype.hasOwnProperty.call(next,key))continue;
    const erro=validarCancelamentos(previous[key],next[key],key);
    if(erro)return erro;
  }
  if(Object.prototype.hasOwnProperty.call(next,"conferencias")){
    const erro=validarPendenciasConferencia(previous.conferencias,next.conferencias);
    if(erro)return erro;
  }
  if(Object.prototype.hasOwnProperty.call(next,"fechamentosFinanceiros")){
    const erro=validarFechamentosImutaveis(previous.fechamentosFinanceiros,next.fechamentosFinanceiros);
    if(erro)return erro;
  }
  if(Object.prototype.hasOwnProperty.call(next,"orcamentos")){
    const erro=validarOrcamentosAprovados(previous.orcamentos,next.orcamentos);
    if(erro)return erro;
  }
  for(const [section,child,label] of [
    ["pedidos","pagamentos","pagamentos de pedidos"],
    ["notasFiscais","pagamentos","pagamentos de notas fiscais"],
    ["medicoes","recebimentos","recebimentos de medições"],
    ["titulosFolha","liquidacoes","liquidações da folha"],
  ]){
    if(!Object.prototype.hasOwnProperty.call(next,section))continue;
    const erro=validarFilhosFinanceiros(previous,next,section,child,label);
    if(erro)return erro;
  }
  return "";
};
