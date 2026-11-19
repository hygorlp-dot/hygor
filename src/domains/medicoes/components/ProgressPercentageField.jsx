import { useId, useRef, useState } from "react";
import {formatProgress} from '../progress-presentation.js';
import "./measurement-entry.css";

export function ProgressPercentageField({ label, value, onChange, previous = 0, disabled = false }) {
  const id = useId();
  const touchStartValue = useRef(null);
  const [editing,setEditing]=useState(false);
  const beforeEdit=useRef(value);
  // Native ranges can change on touch-down before a vertical swipe becomes
  // scrolling. Restore the draft if the browser cancels that gesture.
  const cancelTouch = () => {
    if(touchStartValue.current !== null)onChange(touchStartValue.current);
    touchStartValue.current = null;
  };
  const percentage = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="measurement-percentage">
    <div className="measurement-percentage__heading">
      <label htmlFor={`${id}-number`}>{label}</label>
      <div className="measurement-percentage__number">
        <input id={`${id}-number`} type="text" inputMode="decimal"
          value={editing?String(value).replace('.',','):value===''?'':formatProgress(value)} disabled={disabled} aria-describedby={`${id}-previous`}
          onFocus={()=>{beforeEdit.current=value;setEditing(true);}}
          onChange={event=>{if(/^-?\d*(?:[.,]\d*)?$/.test(event.target.value))onChange(event.target.value.replace(',','.'));}}
          onBlur={()=>{setEditing(false);if(value!==''&&!Number.isFinite(Number(value)))onChange(beforeEdit.current);else if(value!=="" && Number(value)!==percentage)onChange(String(percentage));}} />
        <span aria-hidden="true">%</span>
      </div>
    </div>
    <input className="measurement-percentage__slider" type="range" min="0" max="100" step="0.01"
      value={percentage} disabled={disabled} aria-label={`Ajustar ${label}`} aria-valuetext={`${formatProgress(percentage)}% acumulado`}
      aria-describedby={`${id}-previous`} onChange={event=>onChange(event.target.value)}
      onPointerDown={event=>{if(event.pointerType==="touch")touchStartValue.current=value;}}
      onPointerCancel={cancelTouch} onTouchCancel={cancelTouch}
      onPointerUp={()=>{touchStartValue.current=null;}} />
    <div className="measurement-percentage__scale"><span>0%</span><span id={`${id}-previous`} title={`Precisão original: ${String(previous).replace('.',',')}%`}>Anterior: {formatProgress(previous)}%</span><span>100%</span></div>
  </div>;
}
