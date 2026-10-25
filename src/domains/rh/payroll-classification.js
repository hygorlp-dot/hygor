import {remunerationModeOnDate} from './remuneration-mode.js';
import {employmentRelationshipOnDate} from './employment-relationship.js';

// Shared by preparation and payment reports. A daily rate never turns an
// explicitly registered CLT employee into a simple daily-pay settlement.
export function isCltPayrollOnDate(employee,date){
  return remunerationModeOnDate(employee,date)==='clt'||employmentRelationshipOnDate(employee,date)==='clt';
}
