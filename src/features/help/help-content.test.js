import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {HELP_BY_ID,HELP_GUIDES,searchHelp,FINANCE_HELP,PURCHASE_HELP,WORK_HELP} from './help-content.js';
import {ROLE_TABS} from '../../domains/administracao/abas-acesso.js';
import {checkHelpCoverage,renderAppManual} from '../../../scripts/generate-app-manual.mjs';

describe('manual e ajuda contextual',()=>{
 it('cobre todas as abas autorizáveis com instruções completas',()=>{
  expect(()=>checkHelpCoverage()).not.toThrow();
  for(const id of ROLE_TABS.admin)expect(HELP_BY_ID[id]?.steps.length,id).toBeGreaterThanOrEqual(3);
  for(const id of [...Object.values(FINANCE_HELP),...Object.values(PURCHASE_HELP),...Object.values(WORK_HELP)])expect(HELP_BY_ID[id],id).toBeDefined();
 });
 it('mantém o manual gerado sincronizado com o conteúdo do app',()=>{
  expect(readFileSync('docs/MANUAL_DO_APP.md','utf8')).toBe(renderAppManual());
 });
 it('encontra tarefas sem depender de acentos e exige todas as palavras',()=>{
  expect(searchHelp(HELP_GUIDES,'conciliacao').map(item=>item.id)).toContain('conc');
  expect(searchHelp(HELP_GUIDES,'RECEBER material').map(item=>item.id)).toContain('cmp');
  expect(searchHelp(HELP_GUIDES,'palavra-inexistente')).toEqual([]);
 });
});
