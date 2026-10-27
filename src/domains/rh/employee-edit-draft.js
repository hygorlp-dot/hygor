const text=value=>value==null?'':String(value);
export function employeeEditDraft(employee={}){
  const profile=employee.cltPayroll?.profile||{};
  return {...employee,
    employmentRelationship:employee.employmentRelationship||'',
    employmentRelationshipEffectiveFrom:employee.employmentRelationshipEffectiveFrom||'',
    employmentRelationshipReason:employee.employmentRelationshipReason||'',
    remunerationMode:employee.remunerationMode==='clt'?'clt':'daily',
    monthlySalary:text(Number(employee.monthlySalary)>0?employee.monthlySalary:Number(profile.salary)>0?profile.salary:''),
    remunerationEffectiveFrom:employee.remunerationEffectiveFrom||'',
    dailyRate:text(employee.dailyRate),vtDaily:text(employee.vtDaily),vrDaily:text(employee.vrDaily),
    workdayHours:text(employee.workdayHours??8),workStart:employee.workStart||'07:00',
    attendancePunchMode:employee.attendancePunchMode==='entry_exit'?'entry_exit':'with_break',
    workBreakStart:employee.workBreakStart||'12:00',workBreakEnd:employee.workBreakEnd||'13:00',
    timeBankEnabled:employee.timeBankEnabled===true,
    overtimeAdditionalPercent:text(employee.overtimeAdditionalPercent??50),examExpiresAt:employee.examExpiresAt||'',
    cltPayroll:employee.cltPayroll?structuredClone(employee.cltPayroll):null,
    trainings:structuredClone(employee.trainings||{}),
    address:employee.address&&typeof employee.address==='object'?structuredClone(employee.address):employee.address||'',
    emergencyContact:structuredClone(employee.emergencyContact||{}),
  };
}
