import {Button as StandardButton} from '../../components/ui/button.jsx';
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Select } from "../../design-system/primitives/Select.jsx";

// A pointer handle supports mouse, pen and touch. Native select/order controls
// expose the same operations to keyboards and assistive technology.
export default function KanbanBoard({ label, columns, items, columnOf, titleOf, renderCard, onMove, busy, canMove = () => true, limits = {}, counts = {} }) {
  const board = useRef(null), pointer = useRef(null);
  const positioned = useRef(false);
  const [drag, setDrag] = useState(null);
  const [notice, setNotice] = useState("");
  function reveal(column, itemId) {
    requestAnimationFrame(() => {
      const lane = [...(board.current?.children || [])].find(element => element.dataset.kanbanColumn === column);
      if (!lane || !board.current) return;
      board.current.scrollLeft += lane.getBoundingClientRect().left - board.current.getBoundingClientRect().left - 2;
      if (itemId) [...lane.querySelectorAll("[data-kanban-card]")].find(card => card.dataset.kanbanCard === itemId)?.querySelector("button")?.focus({ preventScroll: true });
    });
  }
  useEffect(() => {
    if (positioned.current || !items.length) return;
    positioned.current = true;
    const first = columns.find(column => items.some(item => columnOf(item) === column.id));
    if (first) reveal(first.id);
  }, [items.length]);
  const move = async (item, column, beforeId) => {
    if (await onMove(item, column, beforeId || "")) { setNotice(`${titleOf(item)} movido para ${columns.find(entry => entry.id === column)?.label}.`); reveal(column, item.id); }
  };
  function targetAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const lane = hit?.closest("[data-kanban-column]");
    if (!lane || !board.current?.contains(lane)) return null;
    let card = hit.closest("[data-kanban-card]");
    let beforeId = card?.dataset.kanbanCard || "";
    if (card && y > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2) {
      const cards = [...lane.querySelectorAll("[data-kanban-card]")];
      beforeId = cards[cards.indexOf(card) + 1]?.dataset.kanbanCard || "";
    }
    return { column: lane.dataset.kanbanColumn, beforeId };
  }
  function pointerDown(event, item) {
    if (busy || !canMove(item) || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { item, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, commit: onMove };
  }
  function pointerMove(event) {
    const current = pointer.current;
    if (!current) return;
    current.x = event.clientX; current.y = event.clientY;
    if (Math.hypot(current.x - current.startX, current.y - current.startY) < 6 && !current.moved) return;
    current.moved = true;
    setDrag({ id: current.item.id, x: current.x, y: current.y, target: targetAt(current.x, current.y) });
  }
  async function pointerUp(event) {
    const current = pointer.current;
    pointer.current = null; setDrag(null);
    if (!current?.moved) return;
    const target = targetAt(event.clientX, event.clientY);
    if (!target || target.beforeId === current.item.id) return;
    if (await current.commit(current.item, target.column, target.beforeId)) { setNotice(`${titleOf(current.item)} movido para ${columns.find(entry => entry.id === target.column)?.label}.`); reveal(target.column); }
  }
  useEffect(() => {
    if (!drag) return;
    let frame;
    function scroll() {
      const current = pointer.current;
      const rect = board.current?.getBoundingClientRect();
      if (current && rect) {
        const direction = current.x < rect.left + 48 ? -1 : current.x > rect.right - 48 ? 1 : 0;
        if (direction) board.current.scrollLeft += direction * 10;
        if (current.y < 80) window.scrollBy(0, -8);
        if (current.y > window.innerHeight - 90) window.scrollBy(0, 8);
      }
      frame = requestAnimationFrame(scroll);
    }
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [Boolean(drag)]);
  return <>
    <p className="engineering-help">Arraste pelo puxador. Você também pode usar “Mover para” e os botões de ordem em cada cartão.</p>
    <p className="engineering-sr-only" role="status" aria-live="polite">{notice}</p>
    <div ref={board} className="engineering-kanban" role="region" aria-label={label} tabIndex={0} aria-busy={busy}>
      {columns.map(column => {
        const cards = items.filter(item => columnOf(item) === column.id);
        const total = counts[column.id] ?? cards.length;
        const limit = Number(limits[column.id] || 0);
        return <section key={column.id} className="engineering-lane" data-kanban-column={column.id} data-over={drag?.target?.column === column.id || undefined} aria-label={`${column.label} · ${cards.length} cartão(s)`}>
          <header className="engineering-lane-heading"><h4>{column.label}</h4><span>{cards.length !== total ? `${cards.length} de ${total}` : total}{limit ? ` · limite ${limit}` : ""}</span></header>
          {limit > 0 && total >= limit && <p className="engineering-capacity" role="status">{total > limit ? "Acima do limite" : "Limite atingido"}</p>}
          {!cards.length && <p className="engineering-drop-empty">Solte um cartão aqui</p>}
          {cards.map((item, index) => <article key={item.id} className="engineering-kanban-card" data-kanban-card={item.id} data-dragging={drag?.id === item.id || undefined} data-before={drag?.target?.beforeId === item.id || undefined} aria-label={titleOf(item)}>
            <StandardButton variant="secondary" type="button" className="engineering-drag-handle" aria-label={`Arrastar ${titleOf(item)}`} disabled={busy || !canMove(item)} onPointerDown={event => pointerDown(event, item)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pointer.current = null; setDrag(null); }} onKeyDown={event => { if (event.key === "Escape") { pointer.current = null; setDrag(null); } }}><GripVertical size={18} aria-hidden="true" /><span>Mover cartão</span></StandardButton>
            {renderCard(item)}
            <div className="engineering-card-move"><Select label={`Mover para · ${titleOf(item)}`} value={column.id} disabled={busy || !canMove(item)} onChange={event => move(item, event.target.value)} options={columns.map(entry => ({ value: entry.id, label: entry.label }))} /><div className="engineering-actions"><Button type="button" variant="ghost" size="icon" aria-label={`Subir ${titleOf(item)}`} disabled={busy || !canMove(item) || index === 0} onClick={() => move(item, column.id, cards[index - 1].id)}><ArrowUp size={16} /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Descer ${titleOf(item)}`} disabled={busy || !canMove(item) || index === cards.length - 1} onClick={() => move(item, column.id, cards[index + 2]?.id)}><ArrowDown size={16} /></Button></div></div>
          </article>)}
        </section>;
      })}
    </div>
    {drag && <div className="engineering-drag-preview" style={{ left: drag.x + 12, top: drag.y + 12 }} aria-hidden="true">{titleOf(pointer.current?.item || items.find(item => item.id === drag.id) || {})}</div>}
  </>;
}
