import {beforeEach,expect,it,vi} from 'vitest';
import {RH_STEP_TARGET_KEY,writeRhStepTarget,readRhStepTarget,clearRhStepTarget,pointCycleForDate} from './rh-step-target.js';
beforeEach(()=>{sessionStorage.clear();});
it('mantém funcionário/data por leitura repetida e limpa somente no destino certo',()=>{
  const entry={target:'point',employeeId:'e',competence:'2026-10',date:'2026-10-28'};
  expect(writeRhStepTarget(entry)).toBe(true);expect(readRhStepTarget('point')).toEqual(entry);expect(readRhStepTarget('point')).toEqual(entry);
  clearRhStepTarget('point-close');expect(readRhStepTarget('point')).toEqual(entry);
  clearRhStepTarget('point');expect(readRhStepTarget('point')).toBeNull();
});
it('recusa contexto inválido e lida com armazenamento bloqueado',()=>{
  sessionStorage.setItem(RH_STEP_TARGET_KEY,JSON.stringify({target:'point',employeeId:'e',competence:'2026-10',date:'2026-02-31'}));
  expect(readRhStepTarget('point')).toBeNull();
  const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('bloqueado');});
  expect(writeRhStepTarget({})).toBe(false);spy.mockRestore();
});
it.each([['2026-01-03',2025,11,'2'],['2026-10-06',2026,9,'1'],['2026-10-28',2026,9,'2']])('abre a quinzena que realmente contém %s',(date,year,month,q)=>{
  expect(pointCycleForDate(date)).toEqual({year,month,q});
});
