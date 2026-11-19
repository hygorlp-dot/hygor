// Consulta pura: preserva o relatório e distingue resultado das verificações
// do estado efetivo do motor. Nenhum dado financeiro é corrigido por esta tela.
export const homologationGroups = {
 totals:'Totais financeiros',dre:'Projeções do DRE',purchases:'Compras e DRE',
 bank:'Extratos bancários',links:'Vínculos com a origem',integrity:'Integridade do razão',
};
const metricNames={billed:'Faturado',received:'Recebido',thirdParty:'Terceiros',expenses:'Despesas da obra',companyExpenses:'Despesas da empresa',purchases:'Compras'};
const checkNames={snapshot_writers:'Gravações financeiras',shadow_has_facts:'Fatos disponíveis',shadow_run:'Carga registrada',ledger_divergence:'Totais financeiros',dre_divergence:'Projeções do DRE',procurement_dre_divergence:'Compras e DRE',legacy_links:'Vínculos com a origem',legacy_hashes:'Atualidade dos vínculos',bank_shadow:'Extratos bancários',quality_cases:'Pendências de qualidade',canonical_integrity:'Integridade do razão'};
const bankReasons={legacy_bank_without_id:'Movimento de origem sem identificação.',legacy_bank_missing_canonical:'Movimento de origem sem correspondente no razão.',legacy_bank_stale:'Dados do extrato diferentes da origem.',canonical_legacy_bank_not_in_snapshot:'Movimento do razão ausente na origem consultada.'};
export const projectionFindingTypes={
 not_materialized:{label:'Projeção não materializada',instruction:'A comparação inclui períodos que o ERP só prepara sob demanda. Confira esta competência e este escopo no DRE com o responsável financeiro.'},
 inactive_projection:{label:'Projeção inativa',instruction:'Confira a situação da projeção para esta competência e este escopo com o responsável financeiro.'},
 structure:{label:'Campo ou estrutura diferente',instruction:'Confira o campo no diagnóstico e a versão da projeção com o responsável financeiro.'},
 value:{label:'Valor divergente',instruction:'Compare o campo com o DRE da mesma competência e os registros que compõem a linha.'},
};
const list=value=>Array.isArray(value)?value:[];
export function homologationReport(report={},works=[]){
 const workName=id=>['empresa','company_dre',''].includes(String(id||''))?'Empresa':works.find(work=>String(work.id)===String(id))?.name||'Obra não disponível';
 const periodLabels={mes:'Mês completo',q1:'Primeira quinzena',q2:'Segunda quinzena'};
 const projection=source=>{const [competence,period,...scope]=String(source||'').split(':');return {competence:/^\d{4}-\d{2}$/.test(competence)?competence:'Não informada',period:periodLabels[period]||period||'Período não informado',work:workName(scope.join(':'))};};
 const issues=[];
 const add=(group,row,values)=>issues.push({group,label:homologationGroups[group],severity:'error',reference:String(row.sourceId||row.legacyId||row.scope||row.code||''),raw:row,...values,id:`${group}:${issues.length}`});
 list(report.divergencias).forEach(row=>add('totals',row,{work:workName(row.scope),field:metricNames[row.metric]||row.metric||'Total',expected:row.legacyAmount,actual:row.canonicalAmount,difference:row.difference,kind:'currency'}));
 list(report.divergenciasDRE).forEach(row=>{
  const finding=Object.hasOwn(projectionFindingTypes,row.kind)?row.kind:!row.path?'not_materialized':typeof row.difference==='number'?'value':'structure';
  add('dre',row,{...projection(row.sourceId),finding,field:row.path||projectionFindingTypes[finding].label,expected:row.expected,actual:row.canonical,difference:row.difference,kind:'value'});
 });
 list(report.divergenciasComprasDRE).forEach(row=>{const [work,competence]=String(row.scope||'').split('|');add('purchases',row,{work:workName(work),competence:competence||'Não informada',field:'Custo reconhecido de compras',expected:row.expectedCents==null?undefined:row.expectedCents/100,actual:row.actualCents==null?undefined:row.actualCents/100,difference:row.differenceCents==null?undefined:row.differenceCents/100,kind:'currency'});});
 list(report.bankDivergences).forEach(row=>add('bank',row,{field:bankReasons[row.code]||'Conferir movimento bancário',expected:row.expected,actual:row.actual,kind:'value'}));
 list(report.missingLegacyLinks).forEach(row=>add('links',row,{field:'Registro de origem sem vínculo com o razão',expected:row.legacyType,actual:'Vínculo ausente',kind:'value'}));
 list(report.staleLegacyLinks).forEach(row=>add('links',row,{field:'Dados da origem alterados após o vínculo',expected:row.expectedHash,actual:row.actualHash,kind:'value'}));
 list(report.canonicalIntegrity?.findings).forEach(row=>add('integrity',row,{severity:row.severity==='warning'?'warning':'error',field:row.message||'Conferir integridade do registro',kind:'value'}));
 const checks=list(report.activationGate?.checks).map(check=>({...check,label:checkNames[check.code]||'Verificação adicional',ok:check.ok===true}));
 const complete=report.activationGate?.ready===true&&checks.length>0&&checks.every(check=>check.ok)&&!issues.some(issue=>issue.severity==='error');
 return {engineLabel:report.engineEnforced===true?'Motor financeiro ativo':report.engineEnforced===false?'Motor financeiro em observação':'Estado do motor não informado',complete,issues,checks};
}
