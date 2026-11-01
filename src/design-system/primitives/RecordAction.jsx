import {forwardRef} from 'react';
import './record-action.css';

// Abrir/selecionar um registro, indicador ou valor em tabela. Comandos como
// Salvar e Cancelar usam Button; esta receita conserva o layout do registro.
export const RecordAction=forwardRef(function RecordAction({className='',type='button',...props},ref){
 return <button ref={ref} type={type} className={`mrc-record-action ${className}`.trim()} {...props}/>;
});
