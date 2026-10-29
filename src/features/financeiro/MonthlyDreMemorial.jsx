import {useEffect,useRef} from "react";
import {Button} from "../../components/ui/button.jsx";
import DreMemorial from "./DreMemorial.jsx";
import "./annual-dre.css";

export default function MonthlyDreMemorial({detail,onClose,onOpenWork}){
  const dialog=useRef(null);
  useEffect(()=>{
    const element=dialog.current;
    element.showModal();
    return()=>element.close();
  },[]);
  const close=()=>{dialog.current.close();onClose();};
  return <dialog ref={dialog} className="annual-dre__dialog" aria-labelledby="monthly-memorial-title" onCancel={event=>{event.preventDefault();close();}}>
    <header><h3 id="monthly-memorial-title">{detail.row.label} · {detail.period}</h3><Button variant="ghost" onClick={close} aria-label="Fechar memorial">×</Button></header>
    <DreMemorial row={detail.row} month={detail.month} onOpenWork={onOpenWork?obraId=>{close();onOpenWork(obraId);}:undefined}/>
    <p>Total: <strong>{detail.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></p>
    <footer><Button variant="outline" onClick={close}>Fechar</Button></footer>
  </dialog>;
}
