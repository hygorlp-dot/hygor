// Seções cuja persistência por snapshot pertence ao legado financeiro.
// FIN-003 só permite mutá-las por comandos transacionais do motor.
export const FINANCIAL_LEGACY_SECTIONS=new Set([
  "payments","medicoes","outrasDesp","despesasEmpresa","caixaObra","transacoes",
  "notasFiscais","pedidos","pagsTerceiros","medicoesTerc","pagamentosFolha",
  "titulosFolha","reconciliationLinks","rescisoes",
  "attendance","employees","archivedLaborCosts","config",
  "equipamentos","locacoesEquip","manutencoesEquip",
]);

// O ponto é um fato operacional que alimenta o razão, não um lançamento
// financeiro criado pelo operador. Ele precisa continuar sincronizando a
// projeção canônica, mas não pode ser bloqueado pelo gate que proíbe pagamentos
// e títulos legados. A auditoria e a transação do save-sections permanecem.
export const FINANCIAL_OPERATIONAL_SOURCE_SECTIONS=new Set(["attendance"]);

// Seções que ainda possuem ao menos um escritor por snapshot no aplicativo.
// Enquanto qualquer uma delas continuar sujeita ao bloqueio do FIN-003, ligar
// o enforcement derruba um módulo funcional. A lista é deliberadamente
// explícita para funcionar como checklist de migração e gate de deploy.
//
// reconciliationLinks, archivedLaborCosts, payments, medicoes, outrasDesp,
// despesasEmpresa, transacoes, pagsTerceiros, medicoesTerc, notasFiscais,
// pedidos, rescisoes, pagamentosFolha, titulosFolha, attendance, employees e
// config continuam protegidas como seções financeiras legadas,
// mas não pertencem mais a este checklist:
// seus escritores foram migrados para comandos servidores idempotentes.
export const FINANCIAL_SNAPSHOT_WRITER_SECTIONS=new Set();

export const FINANCIAL_MODULE_SECTION_MATRIX=Object.freeze({});

const PROJECT_FINANCIAL_FIELDS=Object.freeze([
  "contractType","contractValue","adminPercentage",
  "adminBaseMateriais","adminBaseMaoDeObra","adminBaseTerceirizados",
  "billingType","parcelaMensal","contractStart","contractEnd",
  "totalParcelas","billingFrequency","diaVenc1","diaVenc2",
  "entrada","entradaDate","hasCaixa",
]);

const projectFinancialValue=(project,field)=>{
  if([
    "contractValue","adminPercentage","parcelaMensal","totalParcelas",
    "diaVenc1","diaVenc2","entrada",
  ].includes(field))return Number(project?.[field]||0);
  if(field==="hasCaixa")return !!project?.[field];
  if([
    "adminBaseMateriais","adminBaseMaoDeObra","adminBaseTerceirizados",
  ].includes(field))return project?.[field] == null ? null : !!project[field];
  return String(project?.[field]||"");
};

// A coleção de obras contém documentos, fase, portal e OneDrive, que não são
// fatos financeiros e continuam usando o merge por seção. Somente criação,
// exclusão e campos que alteram contrato, faturamento ou caixa ficam restritos
// ao comando versionado do agregado da obra quando o FIN-003 está ativo.
export const validateProjectFinancialSnapshotPolicy=({
  engineEnforced=false,before={},after={},
}={})=>{
  if(!engineEnforced)return {ok:true};
  const previous=new Map((before?.obras||[]).map(item=>[String(item?.id||""),item]));
  const next=new Map((after?.obras||[]).map(item=>[String(item?.id||""),item]));
  const structuralChange=[...previous.keys()].some(id=>!next.has(id))
    || [...next.keys()].some(id=>!previous.has(id));
  if(structuralChange)return {
    ok:false,
    error:"FIN-003 está ativo: cadastro e exclusão de obras exigem o comando transacional.",
  };
  for(const [id,current] of previous){
    const proposed=next.get(id);
    const field=PROJECT_FINANCIAL_FIELDS.find(key=>
      projectFinancialValue(current,key)!==projectFinancialValue(proposed,key)
    );
    if(field)return {
      ok:false,
      error:`FIN-003 está ativo: o campo contratual ${field} da obra exige o comando transacional.`,
    };
  }
  return {ok:true};
};

export const hasLegacyFinancialWrite=sections=>Object.keys(sections||{})
  .some(section=>FINANCIAL_LEGACY_SECTIONS.has(section));

// Em sombra, o blob legado continua sendo a fonte oficial e não pode ficar
// indisponível por lentidão/concorrência na reconstrução do razão. A gravação
// auditável é confirmada primeiro; a sincronização canônica continua sendo
// homologada pelas rotinas explícitas. Quando o enforcement for ativado, a
// persistência volta obrigatoriamente à transação conjunta.
export const financialPersistenceMode=engineEnforced=>
  engineEnforced?"transactional_ledger":"audited_shadow";

const hasBlockedLegacyFinancialWrite=sections=>Object.keys(sections||{})
  .some(section=>
    FINANCIAL_LEGACY_SECTIONS.has(section)
    && !FINANCIAL_OPERATIONAL_SOURCE_SECTIONS.has(section)
  );

export const validateFinancialWritePath=({engineEnforced=false,sections={}}={})=>{
  if(!engineEnforced||!hasBlockedLegacyFinancialWrite(sections))return {ok:true};
  return {
    ok:false,
    error:"FIN-003 está ativo: alterações financeiras devem usar o comando transacional do razão, não o salvamento legado.",
  };
};

export const financialEnforcementReadiness=()=>{
  const pending=[...FINANCIAL_SNAPSHOT_WRITER_SECTIONS]
    .filter(section=>
      FINANCIAL_LEGACY_SECTIONS.has(section)
      && !FINANCIAL_OPERATIONAL_SOURCE_SECTIONS.has(section)
    )
    .sort();
  const modules=Object.fromEntries(Object.entries(FINANCIAL_MODULE_SECTION_MATRIX)
    .map(([module,sections])=>[module,sections.filter(section=>pending.includes(section))])
    .filter(([,sections])=>sections.length));
  return {ready:pending.length===0,pending,modules};
};

export const financialActivationEvidenceGate=({
  writerReadiness=financialEnforcementReadiness(),
  factsCount=0,
  shadowRun=null,
  divergences=[],
  dreDivergences=[],
  procurementDreDivergences=[],
  missingLegacyLinks=[],
  openQualityCases=[],
}={})=>{
  const safeList=value=>Array.isArray(value)?value:[];
  const checks=[
    {
      code:"snapshot_writers",
      ok:!!writerReadiness?.ready,
      detail:writerReadiness?.ready
        ?"Nenhum escritor financeiro por snapshot permanece."
        :`${safeList(writerReadiness?.pending).length} seção(ões) ainda escrevem por snapshot.`,
    },
    {
      code:"shadow_has_facts",
      ok:Number(factsCount)>0,
      detail:Number(factsCount)>0
        ?`${Number(factsCount)} fato(s) financeiro(s) cobertos pela sombra.`
        :"A sombra não contém fatos financeiros para comparar.",
    },
    {
      code:"shadow_run",
      ok:!!shadowRun,
      detail:shadowRun
        ?"Existe carga financeira em sombra registrada."
        :"Nenhuma carga financeira em sombra foi registrada.",
    },
    {
      code:"ledger_divergence",
      ok:safeList(divergences).length===0,
      detail:safeList(divergences).length===0
        ?"Razão legado e canônico sem divergências."
        :`${safeList(divergences).length} divergência(s) entre legado e razão canônico.`,
    },
    {
      code:"dre_divergence",
      ok:safeList(dreDivergences).length===0,
      detail:safeList(dreDivergences).length===0
        ?"DRE legado e projeção canônica sem divergências."
        :`${safeList(dreDivergences).length} divergência(s) de DRE.`,
    },
    {
      code:"procurement_dre_divergence",
      ok:safeList(procurementDreDivergences).length===0,
      detail:safeList(procurementDreDivergences).length===0
        ?"Compras e reconhecimento no DRE sem divergências."
        :`${safeList(procurementDreDivergences).length} divergência(s) Compras × DRE.`,
    },
    {
      code:"legacy_links",
      ok:safeList(missingLegacyLinks).length===0,
      detail:safeList(missingLegacyLinks).length===0
        ?"Todos os fatos legados possuem vínculo canônico."
        :`${safeList(missingLegacyLinks).length} fato(s) legado(s) sem legacy_record_link.`,
    },
    {
      code:"quality_cases",
      ok:safeList(openQualityCases).length===0,
      detail:safeList(openQualityCases).length===0
        ?"Nenhum caso financeiro de qualidade permanece aberto."
        :`${safeList(openQualityCases).length} caso(s) financeiro(s) de qualidade permanecem abertos.`,
    },
  ];
  const blockers=checks.filter(check=>!check.ok);
  return {
    ready:blockers.length===0,
    checks,
    blockers:blockers.map(check=>check.code),
  };
};
