import { Button } from '../../../components/ui/button.jsx';
import { fmtDate, today } from '../../../legacy/format.js';
import { previousOperationDay, summarizeOperationDay } from '../daily-operation.js';
import './dashboard-daily-operation.css';

export function DashboardDailyOperation({ data, workId, diaryWorks, tabs, onTab }) {
  const attendanceTab = ['ponto_geral', 'ponto'].find(tab => tabs.includes(tab));
  const showDiaries = tabs.includes('rdo');
  if (!attendanceTab && !showDiaries) return null;

  const day = today();
  const scope = {
    workId,
    diaryWorks: showDiaries ? new Set(diaryWorks.map(work => String(work.id))) : null,
    showAttendance: Boolean(attendanceTab),
  };
  return <section className="dashboard-daily" aria-labelledby="dashboard-daily-title">
    <header className="dashboard-daily__header">
      <h2 id="dashboard-daily-title">Operação em campo</h2>
      <div className="dashboard-queue-filters">
        {attendanceTab && <Button type="button" variant="link" size="sm" onClick={() => onTab(attendanceTab)}>Abrir Ponto</Button>}
        {showDiaries && <Button type="button" variant="link" size="sm" onClick={() => onTab('rdo')}>Abrir Diário de obra</Button>}
      </div>
    </header>
    <div className="dashboard-daily__days">
      {[day, previousOperationDay(day)].map(date => {
        const isToday = date === day;
        const { attendance, diaries } = summarizeOperationDay(data, date, scope);
        return <div className="dashboard-daily__day" key={date}>
          <div className="dashboard-daily__header">
            <h3>{isToday ? 'Hoje' : 'Ontem'}</h3>
            <time dateTime={date}>{fmtDate(date)}</time>
          </div>
          <dl className="dashboard-daily__metrics">
            {attendanceTab && <>
              <div><dt>Presenças</dt><dd>{attendance?.present ?? '—'}</dd></div>
              <div><dt>Faltas</dt><dd>{attendance?.absent ?? '—'}</dd></div>
            </>}
            {showDiaries && <div><dt>Diários concluídos</dt><dd>{diaries?.total ? `${diaries.completed} de ${diaries.total}` : '—'}</dd></div>}
          </dl>
          {isToday && diaries?.total > 0 && <progress aria-label="Meta diária de obras com diário concluído" value={diaries.completed} max={diaries.total}/>}
        </div>;
      })}
    </div>
  </section>;
}
