import {test,expect} from '@playwright/test';
import {applyAttendanceCommand} from '../server/attendance-command.js';
for(const [date,expected,end] of [['2026-11-03',514,'17:00'],['2026-11-06',480,'16:00']])test(`entrada e saída ${date}`,async({page},info)=>{
 await page.exposeFunction('reviewOnServer',({data,user,command,now,events})=>applyAttendanceCommand(data,user,command,now,events));
 await page.goto(`/e2e/fixtures/ponto-duas-batidas.html?date=${date}`);
 await page.getByRole('button',{name:'Conferir e integrar',exact:true}).click();
 const modal=page.getByRole('dialog');
 await expect(modal.locator('input[type="time"]')).toHaveCount(2);
 await expect(modal).toContainText(`Previsto: ${end}`);
 await expect(modal).toContainText('Intervalo previsto: 12:00–13:00');
 await modal.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished));});
 await page.screenshot({path:info.outputPath('duas-batidas.png'),fullPage:true});
 expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Confirmar e integrar à Gestão do ponto',exact:true}).click();
 await expect(page.getByText('Integrado à Gestão do ponto',{exact:true})).toBeVisible();
 expect(await page.evaluate(date=>window.saved.attendance.e[date].workedMinutes,date)).toBe(expected);
 expect(await page.evaluate(()=>window.eventsAfter===window.originalEvents)).toBe(true);
 expect(await page.evaluate(()=>window.saved.payments)).toEqual([{amount:7160}]);
});
