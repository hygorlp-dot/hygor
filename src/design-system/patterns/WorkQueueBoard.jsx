import './work-queue-board.css';

// Projection of the filtered list. Moving a card delegates to the domain form;
// this component never updates records, dates, approvals or payments.
export function WorkQueueBoard({label, groups, itemKey, renderItem, onMove}) {
  return <div className="mrc-work-board" role="region" aria-label={label} tabIndex={0}>
    {groups.map(group => <section key={group.id} className="mrc-work-board__column" aria-label={group.label}
      onDragOver={onMove ? event => event.preventDefault() : undefined}
      onDrop={onMove ? event => {event.preventDefault(); const key = event.dataTransfer.getData('text/marcell-record'); if(key) onMove(key, group.id);} : undefined}>
      <header><h3>{group.label}</h3><p>{group.items.length} registro(s){group.summary ? ` · ${group.summary}` : ''}</p></header>
      <ul>{group.items.map(item => <li key={itemKey(item)} data-record={itemKey(item)} draggable={Boolean(onMove)}
        onDragStart={onMove ? event => {event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/marcell-record',itemKey(item));} : undefined}>
        {renderItem(item)}
      </li>)}</ul>
      {!group.items.length && <p className="mrc-work-board__empty">Nenhum registro</p>}
    </section>)}
  </div>;
}
