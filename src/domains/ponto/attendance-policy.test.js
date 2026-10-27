import {describe,it,expect} from 'vitest';
import {attendancePolicyForEmployee,expectedWorkedMinutes,suggestedTimeBankMinutes,validateBreakSchedule} from './attendance-policy.js';

describe('política de jornada do funcionário',()=>{
  it('mantém quatro batidas como padrão legado e permite entrada/saída com intervalo previsto',()=>{
    expect(attendancePolicyForEmployee({})).toMatchObject({punchMode:'with_break',expectedPunchCount:4,plannedBreakMinutes:60,timeBankEnabled:false});
    expect(attendancePolicyForEmployee({attendancePunchMode:'entry_exit',workBreakStart:'11:30',workBreakEnd:'12:30',timeBankEnabled:true}))
      .toMatchObject({punchMode:'entry_exit',expectedPunchCount:2,plannedBreakMinutes:60,timeBankEnabled:true});
  });
  it('valida intervalo e calcula jornada esperada e sugestão sem duplicar hora extra paga',()=>{
    expect(validateBreakSchedule({attendancePunchMode:'entry_exit',workBreakStart:'12:00',workBreakEnd:'13:00'})).toMatchObject({ok:true,minutes:60});
    expect(validateBreakSchedule({attendancePunchMode:'entry_exit',workBreakStart:'13:00',workBreakEnd:'12:00'}).ok).toBe(false);
    const employee={workdayHours:8,timeBankEnabled:true};
    expect(expectedWorkedMinutes(employee,'P')).toBe(480);
    expect(expectedWorkedMinutes(employee,'M')).toBe(240);
    expect(suggestedTimeBankMinutes({employee,status:'P',workedMinutes:570,paidOvertimeHours:1})).toBe(30);
    expect(suggestedTimeBankMinutes({employee,status:'P',workedMinutes:450,paidOvertimeHours:0})).toBe(-30);
  });
});
