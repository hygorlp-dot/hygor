import {createContext,useContext,useRef,useEffect} from 'react';
import {Button} from '../../components/ui/button.jsx';
export const SaveRecoveryContext=createContext(null);
export function useRecoveredEditor(active=true){const context=useContext(SaveRecoveryContext),initial=useRef(context?.revision),editorId=useRef(null);if(!editorId.current)editorId.current=crypto.randomUUID();useEffect(()=>{if(!active)initial.current=context?.revision;},[active,context?.revision]);return {context,editorId:editorId.current,stale:initial.current!==context?.revision};}
export function SaveRecoveryShortcut({stale=false}){
 const context=useContext(SaveRecoveryContext);
 if(stale)return <p role="status">Edição atualizada pela recuperação. Feche e reabra o registro antes de editar novamente.</p>;
 return context?.visible?<Button variant="outline" onClick={context.open}>Resolver salvamento</Button>:null;
}
