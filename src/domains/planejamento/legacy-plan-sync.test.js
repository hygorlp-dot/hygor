import {it,expect} from 'vitest';
import {legacyPlanSyncIssue} from './legacy-plan-sync.js';
const budget={id:'budget',versionId:'version',obraId:'a'},plan={id:'p',obraId:'a',budgetId:'budget',tarefas:[{id:'task',etapaId:'stage',progresso:45,custoReal:300}]};
const data={planos:[plan],orcamentos:[budget]};
it('allows completing a missing version by the existing exact budget link',()=>expect(legacyPlanSyncIssue(data,'a',plan,budget,'planejamento')).toBe(''));
it('does not merge two plans for a work',()=>expect(legacyPlanSyncIssue({...data,planos:[plan,{...plan,id:'other'}]},'a',plan,budget,'planejamento')).toContain('mais de um plano'));
it('does not choose between unlinked draft versions automatically',()=>expect(legacyPlanSyncIssue({...data,orcamentos:[budget,{...budget,id:'other'}]},'a',{...plan,budgetId:''},budget,'rascunho')).toContain('mais de um orçamento'));
it('keeps a broken historical link for review instead of replacing it',()=>expect(legacyPlanSyncIssue(data,'a',{...plan,budgetId:'missing'},budget,'rascunho')).toContain('vínculo antigo'));
it('allows the approved control baseline to replace an older explicit version',()=>expect(legacyPlanSyncIssue(data,'a',{...plan,budgetId:'old'},budget,'baseline')).toBe(''));
it('does not drop a second task linked to the same stage',()=>{
 const duplicate={...plan,tarefas:[...plan.tarefas,{...plan.tarefas[0],id:'second'}]},before=structuredClone(duplicate);
 expect(legacyPlanSyncIssue({...data,planos:[duplicate]},'a',duplicate,budget,'planejamento')).toContain('mais de uma tarefa');expect(duplicate).toEqual(before);
});
