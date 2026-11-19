import {assertCompanyProjectScope} from './company-project-guard.js';

// A responsible engineer is an existing user dependency of the work. A name,
// email similarity or inactive account never grants company membership.
export function companyEngineerDependencies({works=[],users=[],projectCompanies,companyId}){
  const dependencies=new Map();
  for(const work of works){
    if(projectCompanies[String(work.id)]!==companyId||!work.engineerId)continue;
    const id=String(work.engineerId),matches=users.filter(user=>String(user.id)===id);
    if(matches.length!==1)throw new Error('O responsável técnico exige um usuário de origem com ID exato e único.');
    const user=matches[0];
    if(user.role!=='engenheiro'||user.active===false)throw new Error('O responsável técnico precisa de perfil de engenheiro ativo na origem.');
    assertCompanyProjectScope(user,projectCompanies,companyId);
    const existing=dependencies.get(id);
    if(existing)existing.projectIds.push(String(work.id));
    else dependencies.set(id,{user:structuredClone(user),projectIds:[String(work.id)]});
  }
  return [...dependencies.values()];
}

export function linkCompanyEngineers({data,sourceUsers,projectCompanies,companyId}){
  const dependencies=companyEngineerDependencies({works:data.obras,users:sourceUsers,projectCompanies,companyId}),users=[...(data.usuarios||[])],added=[];
  for(const dependency of dependencies){
    const matches=users.filter(user=>String(user.id)===String(dependency.user.id));
    if(matches.length>1)throw new Error('Há perfis duplicados para o responsável técnico na empresa.');
    if(matches.length){
      const current=matches[0];
      if(current.role!=='engenheiro'||current.active===false||String(current.authUserId||'')!==String(dependency.user.authUserId||''))throw new Error('O perfil técnico existente diverge da identidade autorizada; confira antes de substituir.');
      assertCompanyProjectScope(current,projectCompanies,companyId);continue;
    }
    users.push(dependency.user);added.push({userId:dependency.user.id,projectIds:dependency.projectIds});
  }
  return {data:added.length?{...data,usuarios:users}:data,added};
}
