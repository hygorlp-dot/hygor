import {Children,cloneElement,isValidElement,useLayoutEffect,useRef} from 'react';

// Contrato restrito ao uso de react-smooth pelo Recharts: publicar o estado
// final imediatamente. Não é um substituto genérico para uma biblioteca de motion.
export default function ChartFinalState({children,to={},onAnimationEnd}){
 const done=useRef(onAnimationEnd);done.current=onAnimationEnd;
 const target=JSON.stringify(to);
 useLayoutEffect(()=>{done.current?.();},[target]);
 if(typeof children==='function')return children(to);
 return Children.map(children,child=>isValidElement(child)?cloneElement(child,{style:{...child.props.style,...to}}):child);
}
