import {describe,expect,it} from 'vitest';
import {employeeDossierStatus} from './employee-dossier-status.js';
import {simulationEmployees} from '../../../scripts/simulacao/fulano-siclano.mjs';

const employee=()=>simulationEmployees()[1];
const today='2026-10-25';
const documents=()=>['identity','address','contract','registration','aso','training','ppe'].map(category=>({id:category,category,issuedAt:'2026-10-01',...(category==='aso'?{expiresAt:'2027-10-01'}:{})}));
describe('conferência do prontuário',()=>{
  it('inclui registro e ASO do CLT por diária sem exigir salário mensal',()=>{
    const result=employeeDossierStatus(employee(),documents(),today);
    expect(result.pending).toEqual([]);expect(result.registrationIssues).toEqual([]);
    expect(result.suggestedCount).toBe(7);expect(result.presentCount).toBe(7);
    expect(result.categories.find(item=>item.id==='termination')).toMatchObject({suggested:false,state:'missing'});
  });
  it('distingue ausente, arquivado, vencido, emissão futura e ASO sem validade',()=>{
    const docs=documents().filter(item=>item.category!=='contract').map(item=>({...item,...(item.category==='identity'?{archivedAt:'2026-10-24'}:item.category==='aso'?{expiresAt:''}:item.category==='training'?{expiresAt:'2026-10-24'}:item.category==='ppe'?{issuedAt:'2026-11-01'}:{})}));
    const result=employeeDossierStatus(employee(),docs,today);
    expect(Object.fromEntries(result.pending.map(item=>[item.id,item.state]))).toEqual({identity:'missing',contract:'missing',aso:'validity_missing',training:'expired',ppe:'future'});
  });
  it('documento novo vigente resolve categoria, mas não atualiza o ASO do cadastro',()=>{
    const worker={...employee(),examExpiresAt:'2026-10-24'};
    const result=employeeDossierStatus(worker,[...documents(),{id:'aso-antigo',category:'aso',expiresAt:'2026-10-24'}],today);
    expect(result.pending).toEqual([]);
    expect(result.registrationIssues).toContain('Validade do ASO na vigência escolhida');
    expect(worker.examExpiresAt).toBe('2026-10-24');
  });
  it('não presume CTPS e ASO a partir de diária sem vínculo declarado',()=>{
    const worker={...employee(),employmentRelationship:'',employmentRelationshipEffectiveFrom:''};
    const result=employeeDossierStatus(worker,[],today);
    expect(result.categories.find(item=>item.id==='registration').suggested).toBe(false);
    expect(result.categories.find(item=>item.id==='aso').suggested).toBe(false);
  });
});
