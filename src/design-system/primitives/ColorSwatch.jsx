import {Button} from './Button.jsx';
import './color-swatch.css';

// A cor é conteúdo de autoria; a moldura e a seleção seguem o tema.
export function ColorSwatch({color,label,selected,onClick}){
 return <Button variant="secondary" size="icon" aria-label={`Cor ${label}`} title={label} aria-pressed={selected} onClick={onClick}><span className="mrc-color-swatch" aria-hidden="true" style={{backgroundColor:color}}/></Button>;
}
