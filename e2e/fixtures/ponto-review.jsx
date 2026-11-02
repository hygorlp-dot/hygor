import * as React from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import Conferencia from "../../src/domains/ponto-eletronico/components/ConferenciaBatidas.jsx";
import Schedule from "../../src/domains/rh/components/WorkScheduleFields.jsx";
import { applyAttendanceCommand } from "../../server/attendance-command.js";
import { applyEmployeeCommand } from "../../src/domains/rh/employee-commands.js";
    const h=React.createElement, date='2026-10-29', user={id:'rh',nome:'RH de teste',role:'rh'};
    const events=['07:04','16:59'].map((clock,i)=>({id:'event-'+i,eventId:'event-'+i,employeeId:'e1',obraId:'o1',tipoRegistro:'ponto',tipoEvento:null,horaConfiavel:true,metodo:'facial',marcadoEm:new Date(date+'T'+clock+':00-03:00').toISOString()}));
    window.submissions=0;
    function Harness(){
      const [data,setData]=React.useState({employees:[{id:'e1',name:'Funcionário de teste',role:'Pedreiro',active:true,startDate:'2026-01-01',dailyRate:180,obra:'o1'}],obras:[{id:'o1',name:'Obra de teste'}],attendance:{}});
      const [draft,setDraft]=React.useState(null);
      return h('main',{style:{padding:16}},h(Schedule,{employee:{...data.employees[0],workScheduleDraft:draft},onChange:setDraft}),
        h('button',{onClick:()=>{const r=applyEmployeeCommand(data,{type:'FUNCIONARIO_SALVO',actorId:'rh',expectedVersion:0,payload:{employee:{...data.employees[0],workScheduleDraft:draft}}},'2026-10-29T20:00:00Z');if(!r.ok)throw new Error(r.reason);setData(r.data);setDraft(null);}},'Salvar funcionário'),
        h(Conferencia,{data,events,date,obraId:'o1',currentUser:user,abrirDetalhe:()=>{},dispatchAttendanceCommand:async cmd=>{
          window.submissions++;const r=applyAttendanceCommand(data,user,cmd,'2026-10-29T21:00:00Z',events);if(r.ok){setData(r.data);window.savedRecord=r.data.attendance.e1[date];}return {...r,reason:r.error};
        }}));
    }
createRoot(document.getElementById('root')).render(h(Harness));
