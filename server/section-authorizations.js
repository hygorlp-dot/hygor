import { orcamentoAprovado } from "../src/domains/orcamentos/budget-approval.js";
import {budgetHierarchyError} from '../src/domains/orcamentos/hierarchy.js';
// Política única para mutações do blob legado. A UI pode ocultar um botão,
// mas a autorização definitiva ocorre antes de qualquer update no servidor.
const SECTION_ROLES = Object.freeze({
  usuarios:["admin"], config:["admin"], obras:["admin"], condominios:["admin"],
  orcamentos:["admin","engenheiro","engenheiro_auditor"], budgetBaselines:["admin"],
  // Achado de 27/10/2026: adicionar um item SINAPI ao orçamento também grava
  // o item em baseFavoritos, e salvar/excluir composição própria grava
  // composicoesEmpresa (OrcamentoView.jsx). Sem entrada aqui, todo
  // engenheiro recebia "A seção baseFavoritos não pode ser alterada por esta
  // rota" e, como a seção pendente segue em todo salvamento seguinte, nada
  // mais do orçamento salvava. Mesmos perfis que editam `orcamentos`.
  baseFavoritos:["admin","engenheiro","engenheiro_auditor"], composicoesEmpresa:["admin","engenheiro","engenheiro_auditor"],
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
  // Achado do Pathfinder de Compras (27/10/2026): a tela "Preços e curva ABC"
  // grava a pesquisa de preços em `cotacoesMaterial` por update() direto, mas a
  // seção não tinha entrada aqui. Só o administrador conseguia registrar um
  // preço; compras e engenharia (que têm a aba) recebiam "a seção não pode ser
  // alterada por esta rota". Mesmos perfis que acessam a aba `suprimentos`.
  cotacoesMaterial:["admin","compras","engenheiro","engenheiro_auditor"],
  fornecedores:["admin","compras","financeiro"], materiais:["admin","compras","engenheiro","engenheiro_auditor"], estoque:["admin","compras","engenheiro","engenheiro_auditor"], movEstoque:["admin","compras","engenheiro","engenheiro_auditor"],
  employees:["admin","rh"], advances:["admin","rh"],
  titulosFolha:["admin","rh","financeiro"], pagamentosFolha:["admin","rh","financeiro"], rescisoes:["admin","rh","financeiro"], quinzenasArquivadas:["admin","rh"],
  payments:["admin","financeiro"], medicoes:["admin","financeiro"], outrasDesp:["admin","financeiro"], despesasEmpresa:["admin","financeiro"], caixaObra:["admin","financeiro"], notasFiscais:["admin","financeiro","compras"], documentosMovimentacoes:["admin","financeiro"], transacoes:["admin","financeiro"], reconciliationLinks:["admin","financeiro"], fechamentosFinanceiros:["admin"],
  equipamentos:["admin","engenheiro","engenheiro_auditor","compras","financeiro"], locacoesEquip:["admin","engenheiro","engenheiro_auditor","financeiro"], terceirizados:["admin","rh","engenheiro","engenheiro_auditor","financeiro"], medicoesTerc:["admin","engenheiro","engenheiro_auditor"], pagsTerceiros:["admin","financeiro"],
  comercial:["admin","comercial"],
  // Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): estas
  // 4 seções de src/features/conciliacao/ConciliacaoView.jsx (contas
  // bancárias, regras de auto-classificação, fechamento de período e
  // rejeição de candidata) sempre gravaram por update() direto, mas nunca
  // tinham entrada aqui - qualquer usuário não-admin (inclusive
  // "financeiro", que src/domains/conciliacao/permissions.js
  // explicitamente autoriza a operar essas telas) recebia
  // "a seção X não pode ser alterada por esta rota" ao tentar salvar. Só
  // administrador conseguia usar essas 4 funcionalidades na prática.
  fechamentosBancarios:["admin","financeiro"], contasBancarias:["admin","financeiro"],
  regrasConc:["admin","financeiro"], rejeicoesConc:["admin","financeiro"],
});

const scoped = value => Array.isArray(value) ? value : [];
const hasForeignObra = (value, obraId) => scoped(value).some(item => item?.obraId && String(item.obraId) !== String(obraId));
const hasUnscopedRecord = value => scoped(value).some(item => item && !item.obraId && !item.obra);
// Catálogos corporativos são compartilhados entre obras. O papel continua
// sendo validado acima, mas um usuário autorizado e vinculado a uma obra não
// deve ser obrigado a gravar um obraId artificial nesses registros.
const CATALOG_SECTIONS=new Set([
  "unidades","materiais","fornecedores","composicoes","composicoesEmpresa",
  "fases","categoriasDesp","baseFavoritos","cotacoesMaterial",
]);

export const authorizeSectionChanges = (user = {}, sections = {}) => {
  const keys=Object.keys(sections || {}).filter(key=>key&&!key.startsWith("__"));
  if (user.role === "admin") return "";
  for (const key of keys) {
    const roles=SECTION_ROLES[key];
    if (!roles) return `A seção ${key} não pode ser alterada por esta rota.`;
    if (!roles.includes(user.role)) return "Seu perfil não possui permissão para alterar esta seção.";
    if (user.obraId && hasForeignObra(sections[key], user.obraId)) return "Não é permitido alterar dados de outra obra.";
    // Um perfil vinculado a obra não pode transformar uma mutação em registro
    // global omitindo o vínculo. Referências corporativas continuam exclusivas
    // de perfis sem restrição de obra ou do administrador.
    if(user.obraId&&!CATALOG_SECTIONS.has(key)&&hasUnscopedRecord(sections[key]))return "Registros de perfil restrito precisam estar vinculados à sua obra.";
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
const cancelado=item=>[
  "cancelado","cancelada","cancelled","canceled","estornado","estornada","reversed","arquivado","arquivada",
].includes(String(item?.status||"").toLowerCase());
const temMotivo=item=>String(item?.motivoCancelamento||item?.motivoEstorno||item?.motivoArquivamento||"").trim().length>0;
const porId=value=>new Map((Array.isArray(value)?value:[]).map(item=>[String(item?.id||""),item]).filter(([id])=>id));
const COMMERCIAL_COLLECTIONS=new Set([
  "leads","atividades","reunioes","propostas","contratos","clientes",
  "parceiros","metas","comissoes","vendas","pesquisas","opportunities",
  "stageEvents","empreendimentos","unidadesImobiliarias","imoveisAvulsos",
  "reservasImobiliarias","vendasImobiliarias","visitasImobiliarias","corretores",
]);

const validarMutacaoCatalogo=(antes,depois,nome)=>{
  const anteriores=porId(antes),posteriores=porId(depois);
  const removidos=[...anteriores.keys()].filter(id=>!posteriores.has(id));
  const adicionados=[...posteriores.keys()].filter(id=>!anteriores.has(id));
  // Uma tela de cadastro opera um registro por vez. Várias remoções, ou
  // remover e criar IDs no mesmo snapshot, indicam quase sempre que um clique
  // partiu de uma renderização antiga e tentou substituir o catálogo vigente.
  if(removidos.length>1||(removidos.length&&adicionados.length)){
    return `A atualização de ${nome} substituiria cadastros existentes. Recarregue os dados e salve um registro por vez.`;
  }
  return "";
};

const validarMutacaoComercial=(antes={},depois={})=>{
  for(const nome of COMMERCIAL_COLLECTIONS){
    if(!Object.prototype.hasOwnProperty.call(depois||{},nome))continue;
    const erro=validarMutacaoCatalogo(antes?.[nome],depois?.[nome],`comercial.${nome}`);
    if(erro)return erro;
  }
  return "";
};

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
  if(Object.prototype.hasOwnProperty.call(next,'extratos')){
    const after=porId(next.extratos),beforeIndex=porId(previous.extratos);
    if((next.extratos||[]).some(item=>!beforeIndex.get(String(item.id))?.importManifest&&(item.importManifest||item.originalFile||item.importReversals?.length)))return 'Lotes bancários exigem o comando de importação autorizado.';
    for(const before of previous.extratos||[]){
      if(!before.importManifest)continue;
      const current=after.get(String(before.id));
      if(!current||['importManifest','originalFile','importReversals','hashArquivo','arquivo'].some(key=>JSON.stringify(before[key])!==JSON.stringify(current[key])))return 'Originais, lotes e reversões bancárias exigem o comando autorizado.';
    }
  }
  if(Object.prototype.hasOwnProperty.call(next,'transacoes')){
    const after=porId(next.transacoes),beforeIndex=porId(previous.transacoes);
    if((next.transacoes||[]).some(item=>!beforeIndex.get(String(item.id))?.importStamp&&(item.importStamp||item.importReversal)))return 'A origem bancária exige o comando de importação autorizado.';
    for(const before of previous.transacoes||[]){
      const current=after.get(String(before.id));
      if(before.importStamp&&(!current||before.importStamp!==current.importStamp||before.importReversal!==current.importReversal||current.status==='cancelado'&&before.status!=='cancelado'))return 'A reversão da importação exige o comando autorizado.';
      if(before.importReversal&&(!current||Object.keys(before).some(key=>JSON.stringify(before[key])!==JSON.stringify(current[key]))))return 'Movimentos revertidos permanecem imutáveis para auditoria.';
    }
  }
  for(const key of ['commercialContractRecords','commercialContractCompany']){
    if(Object.prototype.hasOwnProperty.call(next,key)&&JSON.stringify(previous[key]??null)!==JSON.stringify(next[key]??null))return 'Contratos e cadastro da contratada exigem o comando comercial autorizado.';
  }
  for(const key of CATALOG_SECTIONS){
    if(!Object.prototype.hasOwnProperty.call(next,key))continue;
    const erro=validarMutacaoCatalogo(previous[key],next[key],key);
    if(erro)return erro;
  }
  for(const key of APPEND_ONLY_SECTIONS){
    if(!Object.prototype.hasOwnProperty.call(next,key))continue;
    const erro=validarCancelamentos(previous[key],next[key],key);
    if(erro)return erro;
  }
  if(Object.prototype.hasOwnProperty.call(next,"comercial")){
    const erro=validarMutacaoComercial(previous.comercial,next.comercial);
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
    const before=new Map((previous.orcamentos||[]).map(b=>[b.id,b]));
    const shape=b=>[b?.etapas||[],(b?.itens||[]).map(i=>[i.id,i.etapaId])];
    for(const budget of next.orcamentos||[])if(JSON.stringify(shape(before.get(budget.id)))!==JSON.stringify(shape(budget))){
      const error=budgetHierarchyError(budget);if(error)return error;
    }
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

// ORC-001: a aprovação é uma fronteira de domínio, não um detalhe da tela.
// Um engenheiro pode preparar revisões, mas não consegue promover uma versão
// manualmente por save-sections nem criar/trocar uma baseline por requisição.
const byRecordId=value=>new Map((Array.isArray(value)?value:[]).map(item=>[String(item?.id||""),item]).filter(([id])=>id));
const sameJson=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const validateBudgetBaselinePolicy=(previous={},next={},user={})=>{
  if(Object.prototype.hasOwnProperty.call(next,'obras')){
    const before=new Map((previous.obras||[]).map(w=>[String(w.id),w.costPlanning]));
    for(const work of previous.obras||[])if((Object.keys(work.costPlanning?.serviceLinks||{}).length||work.costPlanning?.serviceLinkHistory?.length)&&!(next.obras||[]).some(w=>String(w.id)===String(work.id)))return 'Obra com histórico de vínculos de compromissos não pode ser removida por snapshot.';
    for(const work of next.obras||[]){
      const old=before.get(String(work.id));
      if(!sameJson(old?.serviceLinks||{},work.costPlanning?.serviceLinks||{})||!sameJson(old?.serviceLinkHistory||[],work.costPlanning?.serviceLinkHistory||[]))return 'Vínculos de compromissos e seu histórico só podem ser alterados pelo comando de previsão.';
    }
  }
  const previousBudgets=byRecordId(previous.orcamentos),nextBudgets=byRecordId(next.orcamentos);
  for(const [id,budget] of nextBudgets){
    const before=previousBudgets.get(id);
    const wasApproved=before&&orcamentoAprovado(before);
    const isApproved=orcamentoAprovado(budget);
    if(!wasApproved&&isApproved){
      if(user.role!=="admin")return "Somente o administrador pode aprovar uma versão orçamentária.";
      if(!String(budget.lockedAt||budget.approvedAt||"").trim()||!String(budget.approvedById||budget.lockedById||"").trim())return "A aprovação da versão exige data e autor auditáveis.";
      const error=budgetHierarchyError(budget);if(error)return error;
    }
  }

  if(Object.prototype.hasOwnProperty.call(next,"budgetBaselines")){
    const before=Array.isArray(previous.budgetBaselines)?previous.budgetBaselines:[];
    const after=Array.isArray(next.budgetBaselines)?next.budgetBaselines:[];
    if(!sameJson(before,after)&&user.role!=="admin")return "Somente o administrador pode criar ou trocar a baseline do orçamento.";
    const active=new Map();
    for(const baseline of after.filter(item=>item?.ativo!==false)){
      const key=`${baseline.obraId||""}|${baseline.tipo||"controle"}`;
      if(active.has(key))return "Há mais de uma baseline ativa para a mesma obra e finalidade.";
      active.set(key,baseline);
      const budget=nextBudgets.get(String(baseline.budgetId||""));
      if(!budget||!orcamentoAprovado(budget))return "A baseline deve apontar para uma versão orçamentária aprovada e bloqueada.";
      if(!sameJson(before,after)){const error=budgetHierarchyError(budget);if(error)return error;}
    }
  }
  return "";
};

// PLAN-001: baseline do cronograma é uma fotografia aprovada. Ela não pode
// ser editada ou substituída silenciosamente; uma revisão cria outro registro
// e conserva a ligação e a justificativa da versão anterior.
const baselineApproved=item=>String(item?.status||"").toLowerCase()==="aprovada";
const baselineSuperseded=item=>["substituida","substituída","superseded"].includes(String(item?.status||"").toLowerCase());
export const validatePlanningBaselinePolicy=(previous={},next={},user={})=>{
  const oldVersioned=(previous.scheduleBaselines||[]).filter(row=>row.schemaVersion===2),newVersioned=(next.scheduleBaselines||[]).filter(row=>row.schemaVersion===2);
  if(!sameJson(oldVersioned,newVersioned))return 'Linhas de base versionadas só podem ser alteradas pelos comandos de proposta e aprovação. Histórico aprovado é imutável.';
  if(!Object.prototype.hasOwnProperty.call(next,"scheduleBaselines"))return "";
  const before=byRecordId(previous.scheduleBaselines),after=byRecordId(next.scheduleBaselines);
  const approvalRole=["admin","diretoria"].includes(user.role);
  for(const [id,item] of after){
    const old=before.get(id);
    if(!old&&baselineApproved(item)){
      if(!approvalRole)return "Somente administrador ou diretoria podem aprovar a baseline do cronograma.";
      if(!String(item.approvedAt||"").trim()||!String(item.approvedById||"").trim())return "A aprovação da baseline exige data e autor auditáveis.";
    }
    if(old&&baselineApproved(old)&&!sameJson(old,item)){
      if(!baselineSuperseded(item))return "Baseline aprovada do cronograma é imutável. Crie uma revisão explícita.";
      if(!approvalRole)return "Somente administrador ou diretoria podem substituir uma baseline aprovada.";
      const revision=[...after.values()].find(candidate=>candidate.revisionOf===id&&String(candidate.reason||"").trim());
      if(!revision)return "Substituir a baseline exige uma nova revisão com justificativa e vínculo à versão anterior.";
    }
  }
  return "";
};

// BANK-001 (25/08/2026): fechamentosBancarios/regrasConc agora aceitam o
// perfil "financeiro" (ver SECTION_ROLES acima), mas cada uma tem UMA
// transição que continua exclusiva do administrador -
// src/domains/conciliacao/permissions.js já reserva as duas ao mesmo nível
// elevado (podeReabrirFechamento/podeDesfazerConciliacao) que a tela usa
// para esconder os botões. SECTION_ROLES sozinho não distingue "financeiro
// fechando um período novo" de "financeiro reabrindo um já fechado" - as
// duas mexem na mesma seção - por isso essa checagem por transição,
// mesmo padrão de validateBudgetBaselinePolicy/validatePlanningBaselinePolicy.
export const validateBankReconciliationPolicy=(previous={},next={},user={})=>{
  if(user.role==="admin")return "";
  if(Object.prototype.hasOwnProperty.call(next,"fechamentosBancarios")){
    const before=byRecordId(previous.fechamentosBancarios),after=byRecordId(next.fechamentosBancarios);
    for(const [id,item] of after){
      const old=before.get(id);
      if(old&&old.status==="fechado"&&item.status!=="fechado"){
        return "Somente o administrador pode reabrir um período bancário fechado.";
      }
    }
  }
  if(Object.prototype.hasOwnProperty.call(next,"regrasConc")){
    const before=byRecordId(previous.regrasConc),after=byRecordId(next.regrasConc);
    for(const id of before.keys()){
      if(!after.has(id))return "Somente o administrador pode excluir uma regra de conciliação.";
    }
  }
  return "";
};

// Garantia e sua trilha só mudam pelos comandos auditados, inclusive para admin.
export const validateTechnicalRetentionPolicy=(previous={},next={})=>{
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(key=>[key,stable(v[key])])):v;
 const equal=(a,b)=>sameJson(stable(a),stable(b));
 const normalize=m=>m?{...m,data:m.data||m.dataMedicao||'',dataMedicao:m.dataMedicao||m.data||'',numero:Number(m.numero||0),total:Number(m.total||0),
  observacao:m.observacao||'',pagamentoId:m.pagamentoId||'',notaFiscalId:m.notaFiscalId||'',responsavelEvidenciaId:m.responsavelEvidenciaId||'',responsavelEvidencia:m.responsavelEvidencia||'',responsavelEvidenciaRole:m.responsavelEvidenciaRole||'',
  itens:(m.itens||[]).map(i=>({etapaId:i.etapaId||'',pctAnterior:Number(i.pctAnterior||0),pctAcum:Number(i.pctAcum||0),valor:Number(i.valor||0)})),
  fotos:(m.fotos||[]).map(f=>({id:f.id,url:f.url||'',path:f.path||f.id||'',nome:f.nome||'Evidência fotográfica',legenda:f.legenda||'',enviadoPorId:f.enviadoPorId||'',enviadoPor:f.enviadoPor||'',enviadoPorRole:f.enviadoPorRole||'',enviadoEm:f.enviadoEm||''}))}:null;
 const records=new Map((previous.medicoesTerc||[]).map(m=>[m.id,m]));
 const updated=new Map((next.medicoesTerc||[]).map(m=>[m.id,m]));
 const protectedIds=new Set();
 for(const id of new Set([...records.keys(),...updated.keys()])){
  const before=records.get(id),after=updated.get(id);
  if(before?.technicalRetention||after?.technicalRetention||before?.technicalRetentionHistory||after?.technicalRetentionHistory){
   protectedIds.add(id);
   if(!equal(normalize(before),normalize(after)))return 'Garantias e medições com garantia só podem ser alteradas pelos comandos específicos.';
  }
 }
 const payments=rows=>(rows||[]).filter(p=>p.guaranteePayment||p.technicalRetentionCents>0||protectedIds.has(p.medicaoTercId)).map(p=>({...p,pagador:p.pagador==='empresa'?'empresa':'obra',issRetido:Number(p.issRetido||0),inssRetido:Number(p.inssRetido||0),liquido:p.liquido!=null?Number(p.liquido):Number(p.amount||0),conciliado:!!p.conciliado,transacaoId:p.transacaoId||'',medicaoTercId:p.medicaoTercId||''}));
 if(!equal(payments(previous.pagsTerceiros),payments(next.pagsTerceiros)))return 'Use os comandos de pagamento, estorno e conciliação da garantia.';
 const invoices=rows=>(rows||[]).filter(n=>protectedIds.has(n.medicaoTercId)||[...records.values()].some(m=>protectedIds.has(m.id)&&m.notaFiscalId===n.id)).map(n=>[n.id,n.pagamentos||[]]);
 if(!equal(invoices(previous.notasFiscais),invoices(next.notasFiscais)))return 'Não altere baixas da nota de uma medição com garantia por snapshot.';
 return '';
};
