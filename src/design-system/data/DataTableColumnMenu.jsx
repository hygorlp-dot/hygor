import {useRef,useState} from 'react';
import {Button} from '../primitives/Button.jsx';
import {Checkbox} from '../primitives/Checkbox.jsx';
import {Dialog} from '../primitives/Dialog.jsx';
import {UI_TEXT} from '../copy.js';

export function DataTableColumnMenu({columns,visible,onChange,onReset,sessionOnly=false,label=UI_TEXT.columns.title,help}){
 const [open,setOpen]=useState(false),trigger=useRef(null);
 return <><Button ref={trigger} variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>{label}</Button>
  <Dialog open={open} onOpenChange={setOpen} triggerRef={trigger} title={label}>
   <div className="grid gap-4">
   {help}
   <p>{UI_TEXT.columns.description}</p>
   <fieldset className="grid gap-3"><legend>{UI_TEXT.columns.fields}</legend>{columns.map(column=><Checkbox key={column.key} label={column.header} checked={visible.includes(column.key)} disabled={column.hideable===false||visible.length===1&&visible.includes(column.key)} onChange={()=>onChange(column.key)}/>)}</fieldset>
   {sessionOnly&&<p role="status">{UI_TEXT.columns.session}</p>}
   <div className="flex flex-wrap gap-2">{onReset&&<Button variant="outline" onClick={onReset}>{UI_TEXT.columns.reset}</Button>}
   <Button onClick={()=>setOpen(false)}>{UI_TEXT.columns.done}</Button>
   </div></div>
  </Dialog>
 </>;
}
