import { describe,expect,it } from "vitest";
import { authorizeSectionChanges,validateBankReconciliationPolicy,validateBudgetBaselinePolicy,validateNoPhysicalDeletes,validatePlanningBaselinePolicy } from "./section-authorizations.js";
describe("autorização de produção",()=>{
  it("permite planejamento somente ao perfil previsto",()=>{
    expect(authorizeSectionChanges({role:"planejamento"},{scheduleActivities:[{id:"a",obraId:"o"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{scheduleActivities:[{id:"a",obraId:"o"}]})).toMatch(/permissão/);
  });
  it("não permite criar registro global por perfil restrito a obra",()=>{
    expect(authorizeSectionChanges({role:"financeiro",obraId:"o1"},{payments:[{id:"p1",valor:100}]})).toMatch(/precisam estar vinculados/);
    expect(authorizeSectionChanges({role:"financeiro",obraId:"o1"},{payments:[{id:"p1",obraId:"o1",valor:100}]})).toBe("");
  });
  it("permite que perfis autorizados vinculados a obra mantenham catálogos globais",()=>{
    const compras={role:"compras",obraId:"o1"};
    expect(authorizeSectionChanges(compras,{materiais:[{id:"m1",descricao:"Aço"}]})).toBe("");
    expect(authorizeSectionChanges(compras,{fornecedores:[{id:"f1",nome:"Fornecedor"}]})).toBe("");
    expect(authorizeSectionChanges({role:"engenheiro",obraId:"o1"},{materiais:[{id:"m1",descricao:"Aço"}]})).toBe("");
    expect(authorizeSectionChanges({role:"engenheiro",obraId:"o1"},{fornecedores:[{id:"f1",nome:"Fornecedor"}]})).toMatch(/permissão/);
  });
  it("reserva ponto, bloqueio e verificação diária aos comandos granulares",()=>{
    const engenheiro={role:"engenheiro",obraId:"o1"};
    expect(authorizeSectionChanges(engenheiro,{dailyCheckDate:"2026-07-27"})).toMatch(/não pode ser alterada por esta rota/);
    expect(authorizeSectionChanges(engenheiro,{attendance:{e1:{"2026-07-27":{status:"P",obraId:"o1"}}}})).toMatch(/não pode ser alterada por esta rota/);
    expect(authorizeSectionChanges(engenheiro,{attendanceLocks:{"2026-07-27__o1":{id:"2026-07-27__o1",obraId:"o1",locked:true}}})).toMatch(/não pode ser alterada por esta rota/);
  });
  it("permite ao RH administrar contratos de terceiros sem liberar medições ou pagamentos",()=>{
    const contrato={id:"t1",obraId:"o1",name:"Prestador"};
    expect(authorizeSectionChanges({role:"rh"},{terceirizados:[contrato]})).toBe("");
    expect(authorizeSectionChanges({role:"rh"},{medicoesTerc:[{id:"m1",obraId:"o1",tercId:"t1"}]})).toMatch(/permissão/);
    expect(authorizeSectionChanges({role:"rh"},{pagsTerceiros:[{id:"p1",obraId:"o1",tercId:"t1"}]})).toMatch(/permissão/);
  });
  it("não aceita exclusão física de baseline",()=>expect(validateNoPhysicalDeletes({scheduleBaselines:[{id:"b"}]},{scheduleBaselines:[]})).toMatch(/excluir fisicamente/));
  it("bloqueia substituição acidental de catálogos por uma fotografia antiga",()=>{
    const anterior={materiais:[{id:"m1"},{id:"m2"}]};
    expect(validateNoPhysicalDeletes(anterior,{materiais:[{id:"m1"},{id:"m3"}]})).toMatch(/substituiria cadastros/);
    expect(validateNoPhysicalDeletes(anterior,{materiais:[]})).toMatch(/substituiria cadastros/);
    expect(validateNoPhysicalDeletes(anterior,{materiais:[{id:"m2"}]})).toBe("");
    expect(validateNoPhysicalDeletes(anterior,{materiais:[...anterior.materiais,{id:"m3"}]})).toBe("");
  });
  it("bloqueia substituição acidental dos cadastros comerciais",()=>{
    const anterior={comercial:{
      clientes:[{id:"c1"},{id:"c2"}],
      propostas:[{id:"p1"},{id:"p2"}],
    }};
    expect(validateNoPhysicalDeletes(anterior,{comercial:{
      clientes:[{id:"c1"},{id:"c3"}],
      propostas:anterior.comercial.propostas,
    }})).toMatch(/comercial\.clientes substituiria cadastros/);
    expect(validateNoPhysicalDeletes(anterior,{comercial:{
      clientes:anterior.comercial.clientes,
      propostas:[],
    }})).toMatch(/comercial\.propostas substituiria cadastros/);
    expect(validateNoPhysicalDeletes(anterior,{comercial:{
      clientes:[...anterior.comercial.clientes,{id:"c3"}],
      propostas:anterior.comercial.propostas,
    }})).toBe("");
  });
  it("impede alteração ou remoção de versão orçamentária aprovada",()=>{
    const anterior={orcamentos:[{id:"o1",versionStatus:"aprovada",itens:[{id:"i1",precoUnit:10}]}]};
    expect(validateNoPhysicalDeletes(anterior,{orcamentos:[{id:"o1",versionStatus:"aprovada",itens:[{id:"i1",precoUnit:11}]}]})).toMatch(/imutáveis/);
    expect(validateNoPhysicalDeletes(anterior,{orcamentos:[]})).toMatch(/não podem ser excluídas/);
  });
  it("exige motivo também para estorno e exclusão lógica",()=>{
    const anterior={payments:[{id:"p1",valor:100}]};
    expect(validateNoPhysicalDeletes(anterior,{payments:[{id:"p1",valor:100,status:"estornada"}]})).toMatch(/exige um motivo/);
    expect(validateNoPhysicalDeletes(anterior,{payments:[{id:"p1",valor:100,deletedAt:"2026-07-26"}]})).toMatch(/exclusão lógica/);
    expect(validateNoPhysicalDeletes(anterior,{payments:[{id:"p1",valor:100,status:"estornada",motivoEstorno:"Duplicidade"}]})).toBe("");
  });
  it("reserva aprovação e adoção de baseline ao administrador",()=>{
    const draft={id:"o1",obraId:"obra-1",versionStatus:"rascunho"};
    const approved={...draft,versionStatus:"aprovado",lockedAt:"2026-07-26T10:00:00Z",approvedById:"admin"};
    expect(validateBudgetBaselinePolicy({orcamentos:[draft]},{orcamentos:[approved]},{role:"engenheiro"})).toMatch(/administrador/);
    expect(validateBudgetBaselinePolicy({orcamentos:[draft],budgetBaselines:[]},{orcamentos:[approved],budgetBaselines:[{id:"b1",obraId:"obra-1",budgetId:"o1",tipo:"controle",ativo:true}]},{role:"admin"})).toBe("");
  });
  it("recusa baseline ambígua ou vinculada a rascunho",()=>{
    const draft={id:"o1",obraId:"obra-1",versionStatus:"rascunho"};
    expect(validateBudgetBaselinePolicy({budgetBaselines:[]},{orcamentos:[draft],budgetBaselines:[{id:"b1",obraId:"obra-1",budgetId:"o1",ativo:true}]},{role:"admin"})).toMatch(/aprovada/);
    const approved={...draft,versionStatus:"aprovado",lockedAt:"x",approvedById:"a"};
    expect(validateBudgetBaselinePolicy({budgetBaselines:[]},{orcamentos:[approved],budgetBaselines:[{id:"b1",obraId:"obra-1",budgetId:"o1",ativo:true},{id:"b2",obraId:"obra-1",budgetId:"o1",ativo:true}]},{role:"admin"})).toMatch(/mais de uma baseline/);
  });
  it("mantém baseline de cronograma imutável e revisável por vínculo explícito",()=>{
    const baseline={id:"p1",status:"aprovada",approvedAt:"2026-07-26",approvedById:"d1",tarefas:["a"]};
    expect(validatePlanningBaselinePolicy({scheduleBaselines:[baseline]},{scheduleBaselines:[{...baseline,tarefas:["b"]}]},{role:"diretoria"})).toMatch(/imutável/);
    expect(validatePlanningBaselinePolicy({scheduleBaselines:[baseline]},{scheduleBaselines:[{...baseline,status:"substituida"},{id:"p2",status:"rascunho",revisionOf:"p1",reason:"Aditivo aprovado"}]},{role:"diretoria"})).toBe("");
  });
  it("não permite aprovação de cronograma por perfil operacional",()=>{
    expect(validatePlanningBaselinePolicy({scheduleBaselines:[]},{scheduleBaselines:[{id:"p1",status:"aprovada",approvedAt:"2026-07-26",approvedById:"d1"}]},{role:"planejamento"})).toMatch(/administrador ou diretoria/);
  });

  // Achado de 25/08/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): estas
  // 4 seções da Conciliação Bancária nunca tinham entrada em SECTION_ROLES -
  // qualquer perfil não-admin (inclusive "financeiro", autorizado pelo
  // próprio domínio a operar a tela) era rejeitado com
  // "não pode ser alterada por esta rota" ao tentar salvar.
  it("permite ao financeiro operar contas bancárias, regras e fechamento de conciliação",()=>{
    expect(authorizeSectionChanges({role:"financeiro"},{contasBancarias:[{id:"c1"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{regrasConc:[{id:"r1"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{fechamentosBancarios:[{id:"f1"}]})).toBe("");
    expect(authorizeSectionChanges({role:"financeiro"},{rejeicoesConc:[{id:"j1"}]})).toBe("");
  });
  it("não permite que rh ou engenheiro alterem a conciliação bancária",()=>{
    expect(authorizeSectionChanges({role:"rh"},{fechamentosBancarios:[{id:"f1"}]})).toMatch(/permissão/);
    expect(authorizeSectionChanges({role:"engenheiro"},{contasBancarias:[{id:"c1"}]})).toMatch(/permissão/);
  });
  it("reserva reabrir um período bancário fechado ao administrador",()=>{
    const anterior={fechamentosBancarios:[{id:"f1",status:"fechado"}]};
    const reaberto={fechamentosBancarios:[{id:"f1",status:"reaberto"}]};
    expect(validateBankReconciliationPolicy(anterior,reaberto,{role:"financeiro"})).toMatch(/administrador/);
    expect(validateBankReconciliationPolicy(anterior,reaberto,{role:"admin"})).toBe("");
  });
  it("permite ao financeiro fechar um período novo (não é reabertura)",()=>{
    const anterior={fechamentosBancarios:[]};
    const fechado={fechamentosBancarios:[{id:"f1",status:"fechado"}]};
    expect(validateBankReconciliationPolicy(anterior,fechado,{role:"financeiro"})).toBe("");
  });
  it("reserva excluir uma regra de conciliação ao administrador",()=>{
    const anterior={regrasConc:[{id:"r1"},{id:"r2"}]};
    const semR1={regrasConc:[{id:"r2"}]};
    expect(validateBankReconciliationPolicy(anterior,semR1,{role:"financeiro"})).toMatch(/administrador/);
    expect(validateBankReconciliationPolicy(anterior,semR1,{role:"admin"})).toBe("");
  });
  it("permite ao financeiro criar ou desativar uma regra (sem remover)",()=>{
    const anterior={regrasConc:[{id:"r1",ativa:true}]};
    const desativada={regrasConc:[{id:"r1",ativa:false}]};
    const nova={regrasConc:[{id:"r1",ativa:true},{id:"r2",ativa:true}]};
    expect(validateBankReconciliationPolicy(anterior,desativada,{role:"financeiro"})).toBe("");
    expect(validateBankReconciliationPolicy(anterior,nova,{role:"financeiro"})).toBe("");
  });
});
