const text=value=>value==null?'':String(value);
export function employeeEditDraft(employee={}){
  const profile=employee.cltPayroll?.profile||{};
  return {...employee,
    remunerationMode:employee.remunerationMode==='clt'?'clt':'daily',
    monthlySalary:text(Number(employee.monthlySalary)>0?employee.monthlySalary:Number(profile.salary)>0?profile.salary:''),
    remunerationEffectiveFrom:employee.remunerationEffectiveFrom||'',
    dailyRate:text(employee.dailyRate),vtDaily:text(employee.vtDaily),vrDaily:text(employee.vrDaily),
    workdayHours:text(employee.workdayHours??8),workStart:employee.workStart||'07:00',
    overtimeAdditionalPercent:text(employee.overtimeAdditionalPercent??50),examExpiresAt:employee.examExpiresAt||'',
    cltPayroll:employee.cltPayroll?structuredClone(employee.cltPayroll):null,
    trainings:structuredClone(employee.trainings||{}),
  };
}
