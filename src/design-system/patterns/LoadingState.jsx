import {useEffect,useState} from 'react';
import {Spinner} from '../primitives/Spinner.jsx';
import './styles.css';
import {UI_TEXT} from '../copy.js';

// A moldura nasce com a espera; texto e anúncio só aparecem se ela persistir.
/** @param {{label?:string, title?:string, description?:string}} props */
export function LoadingState({label,title,description}){
 const [visible,setVisible]=useState(false);
 const message=label?`${UI_TEXT.feedback.loading} ${label}…`:title||UI_TEXT.feedback.loading;
 useEffect(()=>{const timer=setTimeout(()=>setVisible(true),200);return()=>clearTimeout(timer);},[]);
 return <div className="arcd-page-loading mrc-loading-state">{visible&&<><Spinner label={message}/><div><span aria-hidden="true">{message}</span>{description&&<p>{description}</p>}</div></>}</div>;
}
