import { Btn, Inp, today } from "../../../LegacyApp";
import { SCHEDULE_44, SCHEDULE_LABEL } from "../work-schedule.js";

export default function WorkScheduleFields({ employee, onChange }) {
  const history = employee.workSchedules || [];
  const draft = employee.workScheduleDraft;
  return <fieldset className="work-schedule-fields">
    <legend>Escala de trabalho definida pelo RH</legend>
    <p>{SCHEDULE_LABEL}</p>
    {history.length ? <ul>{history.map(s => <li key={s.effectiveFrom}>Vigência a partir de {s.effectiveFrom.split("-").reverse().join("/")}</li>)}</ul>
      : <p>Este funcionário ainda não tem escala para conferência das batidas.</p>}
    {draft ? <div className="work-schedule-fields__actions">
      <Inp label="Início da vigência" type="date" value={draft.effectiveFrom} onChange={effectiveFrom => onChange({ ...draft, effectiveFrom })} />
      <Btn v="ghost" onClick={() => onChange(null)}>Cancelar definição</Btn>
      <p>A escala será vinculada ao salvar o funcionário.</p>
    </div> : <Btn v="ghost" onClick={() => onChange({ code:SCHEDULE_44, effectiveFrom:today() })}>Definir escala de 44h</Btn>}
  </fieldset>;
}
