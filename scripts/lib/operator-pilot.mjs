export const PILOT_WEIGHTS={flow:.35,nextAction:.2,recovery:.15,consistency:.15,responsive:.1,response:.05};
const assignments={engineering:['J01','J08','J01','J08'],purchases:['J02','J03','J08','J02'],finance:['J04','J05','J06','J07']};
export function operatorPilotTemplate(){
 const participants=['engineering','purchases','finance'].flatMap((role,index)=>[1,2].map(n=>({id:`${['E','C','F'][index]}0${n}`,role})));
 return {version:1,method:'human-observed',participants,runs:participants.flatMap(participant=>assignments[participant.role].map((journey,index)=>({id:`${participant.id}-${index+1}`,participantId:participant.id,journey,device:index%2?'mobile':'desktop',observer:null,finishedAt:null,result:null,elapsedMs:null,systemWaitMs:null,moduleSwitches:null,retypedIdentities:null,contextLost:null,nextActionClear:null,helpNeeded:null,dataLoss:null,duplicateOperation:null,unauthorizedAccess:null,ratings:Object.fromEntries(Object.keys(PILOT_WEIGHTS).map(key=>[key,null])),note:''})))};
}
export function analyzeOperatorPilot(input){
 if(input?.version!==1||input.method!=='human-observed'||!Array.isArray(input.runs)||!Array.isArray(input.participants))throw new Error('Use o modelo de observação humana, versão 1.');
 const participants=new Map();for(const person of input.participants){if(!person.id||!Object.hasOwn(assignments,person.role)||participants.has(person.id))throw new Error('Participante ausente, repetido ou com área inválida.');participants.set(person.id,person);}
 const ids=new Set(),observed=[];
 for(const run of input.runs){
  if(!run.id||ids.has(run.id))throw new Error('Execução sem identidade ou repetida.');ids.add(run.id);
  if(run.result==null)continue;
  if(!participants.has(run.participantId)||!/^J0[1-8]$/.test(run.journey)||!['desktop','mobile'].includes(run.device)||!['completed','partial','failed'].includes(run.result)||!String(run.observer||'').trim()||!Number.isFinite(Date.parse(run.finishedAt)))throw new Error(`Identificação ou observação incompleta: ${run.id}.`);
  if(!Number.isFinite(run.elapsedMs)||run.elapsedMs<=0||!Number.isFinite(run.systemWaitMs)||run.systemWaitMs<0||run.systemWaitMs>run.elapsedMs)throw new Error(`Tempo inválido: ${run.id}.`);
  for(const key of ['moduleSwitches','retypedIdentities'])if(!Number.isInteger(run[key])||run[key]<0)throw new Error(`Contagem inválida: ${run.id}.${key}.`);
  for(const key of ['contextLost','nextActionClear','helpNeeded','dataLoss','duplicateOperation','unauthorizedAccess'])if(typeof run[key]!=='boolean')throw new Error(`Resultado não observado: ${run.id}.${key}.`);
  for(const key of Object.keys(PILOT_WEIGHTS))if(!Number.isFinite(run.ratings?.[key])||run.ratings[key]<1||run.ratings[key]>10)throw new Error(`Nota ausente ou inválida: ${run.id}.${key}.`);
  observed.push(run);
 }
 const n=observed.length,used=new Set(observed.map(run=>run.participantId));
 const byRole=Object.fromEntries(Object.keys(assignments).map(role=>[role,[...used].filter(id=>participants.get(id).role===role).length]));
 const dimensions=Object.fromEntries(Object.keys(PILOT_WEIGHTS).map(key=>[key,n?observed.reduce((sum,run)=>sum+run.ratings[key],0)/n:null]));
 const score=n?Object.entries(PILOT_WEIGHTS).reduce((sum,[key,weight])=>sum+dimensions[key]*weight,0):null;
 const critical=observed.filter(run=>run.dataLoss||run.duplicateOperation||run.unauthorizedAccess).map(run=>run.id);
 const journeys=[...new Set(observed.map(run=>run.journey))].sort(),devices=[...new Set(observed.map(run=>run.device))];
 const sampleReady=n>=20&&Object.values(byRole).every(count=>count>=2)&&journeys.length===8&&devices.length===2;
 const targetMet=sampleReady&&!critical.length&&score>=9.5&&['flow','nextAction','recovery'].every(key=>dimensions[key]>=9.5)&&Object.values(dimensions).every(note=>note>=9);
 return {status:!n?'awaiting-human-observations':sampleReady?'sample-collected':'sample-incomplete',planned:input.runs.length,observed:n,participants:used.size,byRole,journeys,devices,completionRate:n?observed.filter(run=>run.result==='completed').length/n:null,nextActionClarity:n?observed.filter(run=>run.nextActionClear).length/n:null,contextLosses:observed.filter(run=>run.contextLost).length,critical,dimensions,score,targetMet,decision:critical.length?'Corrigir falhas críticas antes de concluir o ciclo.':!sampleReady?'Coleta acompanhada pendente; não atribuir nota validada por usuários.':targetMet?'Meta de nota atingida nesta amostra; revisar também os indicadores de tarefa.':'Amostra coletada; revisar as dimensões abaixo da meta.'};
}
