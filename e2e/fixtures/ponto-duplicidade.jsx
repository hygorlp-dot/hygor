import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import '../../src/domains/ponto-eletronico/components/ponto-eletronico.css';
import Conferencia from '../../src/domains/ponto-eletronico/components/ConferenciaBatidas.jsx';
const date='2026-11-03',user={id:'rh',nome:'RH QA',role:'rh'};
const events=['07:21','07:23'].map((h,i)=>({eventId:`e${i}`,employeeId:'e',obraId:'o',tipoRegistro:'ponto',metodo:'facial',horaConfiavel:true,tipoEvento:null,marcadoEm:`${date}T${h}:00-03:00`}));
window.originalEvents=JSON.stringify(events);window.submissions=0;
function Harness(){
 const [data,setData]=React.useState({employees:[{id:'e',name:'Funcionário QA',role:'Encarregado',obra:'o',active:true,workSchedules:[{code:'44h-seg-sex',effectiveFrom:'2026-10-01'}]}],obras:[{id:'o',name:'Obra QA'}],attendance:{},payments:[{amount:7160}]});
 return <main style={{padding:16}}><Conferencia data={data} events={events} date={date} obraId="o" currentUser={user} abrirDetalhe={event=>{window.selectedEvent=event.eventId;}} dispatchAttendanceCommand={async command=>{
  window.submissions++;const r=await window.reviewOnServer({data,user,command,now:`${date}T22:00:00Z`,events});
  if(r.ok){setData(r.data);window.saved=r.data;window.eventsAfter=JSON.stringify(events);}return {...r,reason:r.error};
 }}/></main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
