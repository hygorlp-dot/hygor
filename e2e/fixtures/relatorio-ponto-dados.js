// Exclusivamente sintético: nenhum nome, telefone ou pagamento real.
export const employees=[{id:'p',name:'Pessoa sintética de conferência',role:'Pedreiro',workdayHours:8,cltPayroll:{profile:{registration:'M001'}}},{id:'q',name:'Legado sem classificação',role:'Servente',workdayHours:8},{id:'n',name:'Noturno sintético',role:'Vigia',workdayHours:8}];
const b=(employeeId,dia,hora,tipoEvento)=>({id:`auditoria-${employeeId}-${dia}-${hora}`,employeeId,obraCapturaId:'a',obraId:'a',tipoRegistro:'ponto',horaConfiavel:true,metodo:'facial',tipoEvento,marcadoEm:`${dia}T${hora}-03:00`});
export const marcacoes=Array.from({length:28},(_,i)=>{
 const dia=`2026-11-${String(i+1).padStart(2,'0')}`;
 return i===9?[b('p',dia,'07:00:17','entrada'),b('p',dia,'11:00:17','saida'),b('p',dia,'13:00:17','entrada'),b('p',dia,'17:00:17','saida')]
  :[b('p',dia,'07:00:17','entrada'),b('p',dia,'16:00:17','saida')];
}).flat().concat([b('q','2026-11-03','07:10:21',null),b('q','2026-11-03','16:05:22',null),b('n','2026-11-05','22:00:09','entrada'),b('n','2026-11-06','06:00:09','saida')]);
