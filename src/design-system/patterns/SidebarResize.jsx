import {useEffect, useRef, useState} from 'react';

const MIN = 208;
const MAX = 360;
const DEFAULT = 224;
const KEY = 'arcd-sidebar-largura';
const clamp = value => Math.min(MAX, Math.max(MIN, value));

export function useSidebarWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      return Number.isFinite(saved) && saved > 0 ? clamp(saved) : DEFAULT;
    } catch { return DEFAULT; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, String(width)); }
    catch { /* A largura continua ajustável sem armazenamento local. */ }
  }, [width]);
  return [width, value => setWidth(clamp(value))];
}

export function SidebarResize({width, onChange, onResizing}) {
  const drag = useRef(null);
  const finish = () => { drag.current = null; onResizing(false); };
  return <span
    className="mrc-sidebar-resize"
    role="separator"
    aria-label="Largura do menu lateral"
    aria-orientation="vertical"
    aria-controls="menu-lateral"
    aria-valuemin={MIN}
    aria-valuemax={MAX}
    aria-valuenow={width}
    tabIndex={0}
    title="Arraste para ajustar. Duplo clique para restaurar."
    onDoubleClick={() => onChange(DEFAULT)}
    onKeyDown={event => {
      const values = {ArrowLeft:width - (event.shiftKey ? 32 : 16), ArrowRight:width + (event.shiftKey ? 32 : 16), Home:MIN, End:MAX, Enter:DEFAULT};
      if (event.key in values) { event.preventDefault(); onChange(values[event.key]); }
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {x:event.clientX, width};
      onResizing(true);
    }}
    onPointerMove={event => {
      if (drag.current) onChange(drag.current.width + event.clientX - drag.current.x);
    }}
    onPointerUp={finish}
    onPointerCancel={finish}
    onLostPointerCapture={finish}
  />;
}
