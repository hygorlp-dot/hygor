// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {companyEngineerDependencies,linkCompanyEngineers} from './company-engineer-links.js';
import {syncSimulationTables} from '../scripts/lib/company-local-simulation.mjs';
import {decodeAppData,profileIndexOutdated} from './data-codec.js';
const fixture=()=>({data:{obras:[{id:'i',engineerId:'engineer'},{id:'k',engineerId:'engineer'}],usuarios:[{id:'admin',role:'admin',active:true}],despesasEmpresa:[{id:'independent',valor:800}]},sourceUsers:[{id:'engineer',nome:'Responsável existente',role:'engenheiro',active:true,authUserId:'same-auth-user',pin:'same-existing-secret',accessTabs:['home','obras'],obraId:''},{id:'other',nome:'Responsável existente',role:'engenheiro',active:true}],projectCompanies:{i:'mrc',k:'mrc',a:'arcd'},companyId:'mrc'});
describe('vínculo técnico por identidade de origem',()=>{
  it('inclui uma única identidade para duas obras, sem buscar por nome ou alterar fatos',()=>{
    const input=fixture(),original=structuredClone(input),result=linkCompanyEngineers(input);
    expect(input).toEqual(original);expect(result.added).toEqual([{userId:'engineer',projectIds:['i','k']}]);
    expect(result.data.usuarios).toHaveLength(2);expect(result.data.usuarios[1]).toEqual(input.sourceUsers[0]);
    expect(result.data.obras).toEqual(input.data.obras);expect(result.data.despesasEmpresa).toEqual(input.data.despesasEmpresa);
    expect(linkCompanyEngineers({...input,data:result.data}).added).toEqual([]);
  });
  it('recusa origem ausente, duplicada, inativa ou de outro papel',()=>{
    for(const change of [u=>[],u=>[u[0],{...u[0]}],u=>[{...u[0],active:false}],u=>[{...u[0],role:'admin'}]]){
      const input=fixture();input.sourceUsers=change(input.sourceUsers);expect(()=>linkCompanyEngineers(input)).toThrow();
    }
  });
  it('não amplia uma restrição existente para obra de outra empresa',()=>{
    const input=fixture();input.sourceUsers[0].obraId='a';expect(()=>linkCompanyEngineers(input)).toThrow('outra empresa');
  });
  it('recusa substituir uma identidade divergente na MRC',()=>{
    const input=fixture();input.data.usuarios.push({...input.sourceUsers[0],authUserId:'different'});expect(()=>linkCompanyEngineers(input)).toThrow('diverge');
  });
  it('sincroniza o cadastro principal e o índice compacto de autenticação',()=>{
    const input=fixture(),result=linkCompanyEngineers(input),state={data:result.data,tables:{company_app_data:[{key:'arced_ponto_v1',value:input.data},{key:'arced_auth_profiles_v1',value:{usuarios:[],obras:[]}}]}};
    syncSimulationTables(state);
    expect(decodeAppData(state.tables.company_app_data[0].value).usuarios).toEqual(result.data.usuarios);
    expect(state.tables.company_app_data[1].value.usuarios.find(user=>user.id==='engineer')).toMatchObject({authUserId:'same-auth-user',role:'engenheiro'});
    expect(profileIndexOutdated(state.tables.company_app_data[1].value,state.data)).toBe(false);
  });
});
