import {createHash} from 'node:crypto';

export const FINANCE_SENDER={email:'financeiro@marcelleng.com.br',whatsapp:'5581989751300'};
const phone=value=>{const digits=String(value||'').replace(/\D/g,'');return [10,11].includes(digits.length)?`55${digits}`:digits;};
const sameBrazilianPhone=(left,right)=>{
 const normalize=value=>{const digits=phone(value);return /^55\d{2}9\d{8}$/.test(digits)?digits.slice(0,4)+digits.slice(5):digits;};
 return normalize(left)===normalize(right);
};
export function prepareStatementDelivery({report,recipient,pdf,revision=1}){
 if(!recipient?.id||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient.email)||!/^55\d{10,11}$/.test(phone(recipient.whatsapp)))throw new Error('Confira o cliente vinculado, e-mail e WhatsApp antes da entrega.');
 if(!Buffer.isBuffer(pdf)||!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('PDF inválido.');
 const digest=createHash('sha256').update(pdf).digest('hex');
 const outstanding=report.charges.reduce((sum,row)=>sum+Math.round(row.balance*100),0)/100;
 const text=`MARCELL | Prestação de contas de ${report.projectName}, ${report.month}. Cobranças já emitidas em aberto: ${outstanding.toFixed(2).replace('.',',')}. O PDF separa gastos, extrato e previsões. A previsão de administração não é uma nova cobrança.`;
 return {projectId:report.projectId,month:report.month,revision,digest,outstanding,simulation:report.simulation===true,jobs:['email','whatsapp'].map(channel=>({key:createHash('sha256').update(JSON.stringify([report.projectId,report.month,recipient.id,revision,channel])).digest('hex'),channel,recipient:channel==='email'?recipient.email:phone(recipient.whatsapp),sender:FINANCE_SENDER[channel],text,filename:`prestacao-contas-${report.month}.pdf`,pdf}))};
}

// O chamador fornece uma reserva atômica e persistente. Nunca usar o cofre ou
// a fila fiscal dos funcionários: prestação de contas tem identidade própria.
export async function dispatchStatementDelivery({delivery,journal,transports={},mode='simulation',enabled=false}){
 if(!['simulation','live'].includes(mode))throw new Error('Modo de entrega inválido.');
 const results=[];
 for(const job of delivery.jobs){
  if(mode!=='simulation'&&(!enabled||delivery.simulation||typeof transports[job.channel]!=='function')){results.push({channel:job.channel,state:'blocked'});continue;}
  const key=`${mode}:${job.key}`;
  if(!await journal.reserve(key,{state:'reserved',digest:delivery.digest})){results.push({channel:job.channel,state:'already_attempted'});continue;}
  if(mode==='simulation'){await journal.finish(key,{state:'simulated'});results.push({channel:job.channel,state:'simulated'});continue;}
  try{
   const result=await transports[job.channel]?.(job);
   const providerId=typeof result?.id==='string'?result.id:result?.id?._serialized;
   if(!providerId)throw new Error('Resposta sem confirmação do provedor.');
   await journal.finish(key,{state:'accepted',providerId});results.push({channel:job.channel,state:'accepted'});
  }catch{await journal.finish(key,{state:'uncertain'});results.push({channel:job.channel,state:'uncertain'});}
 }
 return results;
}

// Mesmo protocolo WAHA utilizado pelo serviço local de comprovantes. O
// segredo e a sessão são injetados pelo titular; não há credencial no app.
export function createWahaStatementTransport({request,session}){
 return async job=>{
  const sender=await request(`/api/sessions/${encodeURIComponent(session)}`);
  if(sender.status!=='WORKING'||!sameBrazilianPhone(sender.me?.id?.split('@')[0].split(':')[0],job.sender))throw new Error('WhatsApp conectado não corresponde ao financeiro.');
  const contact=await request(`/api/contacts/check-exists?${new URLSearchParams({session,phone:job.recipient})}`);
  if(contact.numberExists!==true||!/^\d+@(lid|c\.us|s\.whatsapp\.net)$/.test(contact.chatId||''))throw new Error('Destinatário não confirmado pelo WhatsApp.');
  return request('/api/sendFile',{session,chatId:contact.chatId.replace('@s.whatsapp.net','@c.us'),file:{mimetype:'application/pdf',filename:job.filename,data:job.pdf.toString('base64')},caption:job.text});
 };
}
