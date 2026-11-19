import {describe,expect,it} from 'vitest';
import {buildRequestedDreProjectionRows} from './dre-projection.js';
import {canGenerateMissingDre,missingDrePlan,buildMissingDreRows} from './missing-dre-projections.js';

const identifiers=['2026-11:q2:work-qa','2026-11:mes:company_dre'];
const fixture={
  obras:[{id:'work-qa',name:'Obra QA'}],
  outrasDesp:[{id:'cost',obraId:'work-qa',data:'2026-11-19',competencia:'2026-11',valor:25}],
};
const options={company:'mrc',actor:'qa',sourceRevision:'active-revision',projectionVersion:'current',canonicalEvents:[]};

describe('geração seletiva de projeções do DRE',()=>{
  it('restringe acesso e aceita apenas escopos existentes no relatório desta empresa',()=>{
    expect(canGenerateMissingDre('mrc',{role:'admin'})).toBe(true);
    expect(canGenerateMissingDre('arcd',{role:'admin'})).toBe(false);
    expect(canGenerateMissingDre('mrc',{role:'financeiro'})).toBe(false);
    expect(canGenerateMissingDre('mrc',{role:'admin',obraId:'work-qa'})).toBe(false);
    expect(missingDrePlan(fixture,['2026-11:mes:work-foreign'])).toBeNull();
    expect(missingDrePlan(fixture,['2026-11:q2:company_dre'])).toBeNull();
    expect(missingDrePlan(fixture,[identifiers[0],identifiers[0]])).toHaveLength(1);
  });

  it('calcula somente os escopos pedidos e preserva a fotografia de competência fechada',()=>{
    const data={...fixture,fechamentosFinanceiros:[{
      competencia:'2026-11',status:'fechado',snapshot:{canonicalDre:{sourceId:identifiers[1],
        payload:{lucroLiquido:999,memorial:{origem:'histórico'}},sourceRevision:'closed',projectionVersion:'previous'}},
    }]};
    const before=structuredClone(data);
    const requests=missingDrePlan(data,identifiers);
    const rows=buildMissingDreRows({data,requests,...options});
    expect(rows.map(row=>row.source_id)).toEqual(identifiers);
    expect(rows[0]).toMatchObject({
      company_id:'mrc',event_type:'dre_snapshot',source_type:'dre_projection',
      payload:buildRequestedDreProjectionRows(data,[requests[0]])[0].payload,
    });
    expect(rows[1].payload).toMatchObject({lucroLiquido:999,sourceRevision:'closed',projectionVersion:'previous'});
    expect(data).toEqual(before);
  });
});
