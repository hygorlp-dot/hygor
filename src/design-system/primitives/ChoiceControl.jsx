import {forwardRef} from 'react';
import './choice-control.css';

// Alternativa sem label próprio para listas/tabelas que já têm label associado.
export const ChoiceControl=forwardRef(/** @param {import("react").InputHTMLAttributes<HTMLInputElement>} props */ function ChoiceControl({type='checkbox',className='',...props},ref){
 return <input ref={ref} type={type} className={`arcd-choice-control ${className}`.trim()} {...props}/>;
});
