import {useRef} from 'react';
import {Button} from '../primitives/Button.jsx';
import './file-picker.css';

export function FilePicker({accept,multiple=false,disabled=false,onChange,inputProps={},buttonLabel='Selecionar arquivo',children,...props}){
 const input=useRef(null);
 const {key:inputKey,...fileProps}=inputProps;
 return <div {...props} className={`mrc-file-picker ${props.className||''}`.trim()}>
  {children&&<div className="mrc-file-picker__content">{children}</div>}
  <Button variant="secondary" disabled={disabled} onClick={()=>input.current?.click()}>{buttonLabel}</Button>
  <input {...fileProps} key={inputKey} ref={input} type="file" hidden accept={accept} multiple={multiple} disabled={disabled} onChange={onChange}/>
 </div>;
}
