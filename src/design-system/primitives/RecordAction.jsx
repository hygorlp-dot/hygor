import {forwardRef} from 'react';
import './record-action.css';

// Abrir/selecionar um registro, indicador ou valor em tabela. Comandos como
// Salvar e Cancelar usam Button; esta receita conserva o layout do registro.
/** @typedef {import("react").ButtonHTMLAttributes<HTMLButtonElement> & {layout?:string, style?:import("react").CSSProperties & Record<`--${string}`,string|number|undefined>}} RecordActionProps */
export const RecordAction=forwardRef(/** @param {RecordActionProps} props */ function RecordAction({className='',type='button',layout,...props},ref){
 return <button ref={ref} type={type} className={`mrc-record-action ${className}`.trim()} data-record-layout={layout} {...props}/>;
});
