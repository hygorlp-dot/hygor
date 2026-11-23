import { Button } from '../../../components/ui/button.jsx';
import { contar } from '../../../design-system/copy.js';
import { fmtDate } from '../../../legacy/format.js';
import { dashboardPriorities } from '../priority-context.js';
import './dashboard-priorities.css';

function WorkLabel({item}) {
  if (!item.names?.length) return item.setor;
  if (item.hasOtherRecords) return `${contar(item.names.length, 'obra identificada', 'obras identificadas')} e outros registros`;
  if (item.names.length > 2) return `${item.names[0]} e ${contar(item.names.length - 1, 'outra obra', 'outras obras')}`;
  return item.names.join(' · ');
}

export function DashboardPriorities({queue, onOpen}) {
  const priorities = dashboardPriorities(queue);
  if (!priorities.length) return null;
  return <section className="dashboard-priorities" aria-labelledby="dashboard-priorities-title">
    <div className="dashboard-priorities__header">
      <h2 id="dashboard-priorities-title">Atenção agora</h2>
      <Button asChild variant="link" size="sm"><a href="#dashboard-missoes">Ver todas as pendências</a></Button>
    </div>
    <ol className="dashboard-priorities__list">
      {priorities.map((item, index) => <li key={item.id} className="dashboard-priorities__item" data-critical={item.severidade === 3}>
        <div className="dashboard-priorities__detail">
          <strong>{item.titulo}</strong>
          <p>{item.detalhe}</p>
          <p><WorkLabel item={item}/>{item.date && <> · {item.dateLabel} <time dateTime={item.date}>{fmtDate(item.date)}</time></>}</p>
        </div>
        <Button type="button" variant={index === 0 ? 'primary' : 'outline'} size="sm"
          aria-label={`Abrir ${item.titulo.toLocaleLowerCase('pt-BR')}`} onClick={() => onOpen(item)}>Abrir</Button>
      </li>)}
    </ol>
  </section>;
}
