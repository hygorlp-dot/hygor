import {UI_TEXT} from '../../design-system/copy.js';
import {SelectControl} from '../../design-system/primitives/Select.jsx';
import {COMPANY_OPTIONS} from '../../lib/company-scope.js';

export function CompanySelector({companyId,canSwitch,busy,onChange}){
  return <div className="company-selector">
    <label htmlFor="erp-company">{UI_TEXT.companyScope.label}</label>
    {canSwitch?<SelectControl id="erp-company" value={companyId} disabled={busy} aria-busy={busy} onChange={event=>onChange(event.target.value)}>
      {COMPANY_OPTIONS.map(company=><option key={company.value} value={company.value}>{company.label}</option>)}
    </SelectControl>:<strong>{COMPANY_OPTIONS.find(company=>company.value===companyId)?.label}</strong>}
    {busy&&<span role="status">{UI_TEXT.companyScope.switching}</span>}
  </div>;
}
