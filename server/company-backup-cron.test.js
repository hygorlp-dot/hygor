import {describe,it,expect} from 'vitest';
import {runWithCompany,currentCompany} from './company-context.js';
import {runCompanyBackupCron} from './company-backup-cron.js';
const companies=[{id:'arcd'},{id:'mrc'}];
describe('company backup cron isolation',()=>{
 it('creates independent jobs with the active company and restores outer context',async()=>{const seen=[];const result=await runWithCompany('mrc',()=>runCompanyBackupCron({companies,run:runWithCompany,ready:async id=>seen.push(['ready',id,currentCompany()]),job:async()=>{await Promise.resolve();return {ok:true,company:currentCompany(),records:[currentCompany()+'-only']};}}));expect(result.ok).toBe(true);expect(result.companies.map(r=>r.result.records)).toEqual([['arcd-only'],['mrc-only']]);expect(seen).toEqual([['ready','arcd','arcd'],['ready','mrc','mrc']]);expect(currentCompany()).toBe('arcd');});
 it('does not read or create a backup in a company before readiness',async()=>{const seen=[];const result=await runCompanyBackupCron({companies,run:runWithCompany,ready:async id=>{if(id==='arcd')throw Object.assign(Error('not ready'),{status:503});},job:async()=>{seen.push(currentCompany());return {ok:true};}});expect(seen).toEqual(['mrc']);expect(result.ok).toBe(false);expect(result.companies[0]).toMatchObject({companyId:'arcd',ok:false,status:503});});
 it('continues the other company after failure without returning provider secrets',async()=>{const result=await runCompanyBackupCron({companies,run:runWithCompany,ready:async()=>{},job:async()=>{if(currentCompany()==='arcd')throw Error('synthetic-private-provider-detail');return {ok:true,company:'mrc'};}});expect(result.companies[1].ok).toBe(true);expect(JSON.stringify(result)).not.toContain('synthetic-private-provider-detail');});
});
