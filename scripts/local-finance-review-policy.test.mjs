import {it,expect} from 'vitest';
import {canReviewRequest,canReviewDatabaseRequest} from './local-finance-review-policy.mjs';
it('permite login habitual e consultas, sem comandos financeiros ou alteração de cadastros',()=>{
 for(const action of ['profiles','auth-login','auth-refresh','load','financial-closing-preview','financial-annual-dre-report'])expect(canReviewRequest('/api/data','POST',action)).toBe(true);
 for(const action of ['save','save-sections','setup','operational-command','financial-command','reconciliation-command','financial-annual-dre-layout','financial-shadow-migrate','persistence-health','auth-provision'])expect(canReviewRequest('/api/data','POST',action)).toBe(false);
 expect(canReviewRequest('/api/data','GET','load')).toBe(false);
});
it('recusa gravações indiretas e caminhos desconhecidos, preservando apenas leituras e contadores de autenticação',()=>{
 for(const method of ['POST','PATCH','PUT','DELETE'])expect(canReviewDatabaseRequest('/rest/v1/company_app_data',method)).toBe(false);
 expect(canReviewDatabaseRequest('/rest/v1/company_app_data','GET')).toBe(true);
 expect(canReviewDatabaseRequest('/rest/v1/rpc/company_save_with_audit','POST')).toBe(false);
 expect(canReviewDatabaseRequest('/rest/v1/rpc/auth_rate_limit_failure','POST')).toBe(true);
 expect(canReviewRequest('/api/microsoft/onedrive','POST','upload')).toBe(false);
 expect(canReviewRequest('/api/microsoft/onedrive','POST','sync-workspaces')).toBe(false);
 expect(canReviewRequest('/api/microsoft/onedrive','GET','file')).toBe(true);
 expect(canReviewRequest('/api/unknown','POST','load')).toBe(false);
});
