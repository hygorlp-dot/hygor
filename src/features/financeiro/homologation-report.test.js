import {describe,it,expect} from 'vitest';
import {homologationReport} from './homologation-report.js';

describe('relatório de homologação sem conclusões contraditórias',()=>{
 it('mostra todas as divergências DRE mesmo com totais coincidentes e motor ativo',()=>{
  const report={engineEnforced:true,prontoParaAtivar:false,divergencias:[],divergenciasDRE:Array.from({length:678},(_,i)=>({sourceId:'2026-11:mes:obra-a',path:`costs[${i}].amount`,expected:100,canonical:120,difference:20})),activationGate:{ready:false,checks:[{code:'dre_divergence',ok:false,detail:'678 divergências de DRE.'}]}};
  const before=JSON.stringify(report),result=homologationReport(report,[{id:'obra-a',name:'Obra A'}]);
  expect(result.engineLabel).toBe('Motor financeiro ativo');
  expect(result.complete).toBe(false);expect(result.issues).toHaveLength(678);
  expect(result.issues[0]).toMatchObject({group:'dre',work:'Obra A',competence:'2026-11',expected:100,actual:120});
  expect(JSON.stringify(report)).toBe(before);
 });
 it('não declara homologação concluída quando o portão está pendente sem diferença monetária',()=>{
  const result=homologationReport({engineEnforced:false,divergencias:[],divergenciasDRE:[],prontoParaAtivar:false,activationGate:{ready:false,checks:[{code:'legacy_hashes',ok:false,detail:'Verificação não realizada.'}]}});
  expect(result.complete).toBe(false);expect(result.checks[0].ok).toBe(false);
  expect(result.engineLabel).toBe('Motor financeiro em observação');
 });
 it('distingue zero diferenças de uma verificação ausente e conserva avisos estruturais',()=>{
  expect(homologationReport({engineEnforced:true,prontoParaAtivar:true}).complete).toBe(false);
  const result=homologationReport({engineEnforced:true,prontoParaAtivar:true,activationGate:{ready:true,checks:[{code:'canonical_integrity',ok:true}]},canonicalIntegrity:{findings:[{code:'legacy_warning',severity:'warning',message:'Conferir vínculo.',details:{titleId:'title'}}]}});
  expect(result.complete).toBe(true);expect(result.issues[0].severity).toBe('warning');
 });
 it('inclui compras, banco, vínculos e erros de integridade sem somá-los como custo',()=>{
  const result=homologationReport({divergenciasComprasDRE:[{scope:'obra-a|2026-11',expectedCents:10000,actualCents:9000,differenceCents:-1000}],bankDivergences:[{code:'legacy_bank_missing_canonical',legacyId:'bank'}],missingLegacyLinks:[{legacyType:'pedido',legacyId:'pc'}],staleLegacyLinks:[{legacyType:'medicao',legacyId:'med'}],canonicalIntegrity:{findings:[{code:'orphan_settlement',severity:'error',message:'Liquidação sem título.',details:{settlementId:'set'}}]}},[{id:'obra-a',name:'Obra A'}]);
  expect(result.issues.map(item=>item.group)).toEqual(['purchases','bank','links','links','integrity']);
  expect(result.issues[0]).toMatchObject({work:'Obra A',competence:'2026-11',expected:100,actual:90,difference:-10});
 });
});
