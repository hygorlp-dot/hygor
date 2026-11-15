import {it,expect,vi} from 'vitest';
import {financeSmtpOptions,verifyFinanceEmail,createFinanceEmailTransport,simulateFinanceEmail} from './client-billing-email.js';
import {prepareStatementDelivery,dispatchStatementDelivery,createWahaStatementTransport} from './client-statement-delivery.js';
const job=()=>prepareStatementDelivery({report:{projectId:'w',projectName:'Obra fictícia',month:'2026-11',simulation:true,charges:[{balance:50}]},recipient:{id:'c',email:'cliente@example.test',whatsapp:'81999990000'},pdf:Buffer.from('%PDF-fixture')}).jobs[0];
it('usa TLS validado e autentica a caixa solicitada sem enviar mensagem na verificação',async()=>{
 const transport={verify:vi.fn(async()=>true),sendMail:vi.fn(),close:vi.fn()},createTransport=vi.fn(()=>transport);
 expect(await verifyFinanceEmail('senha-ficticia',{createTransport})).toMatchObject({authenticated:true,messagesSent:0});
 expect(createTransport.mock.calls[0][0]).toMatchObject({host:'smtp.larksuite.com',port:465,secure:true,auth:{user:'financeiro@marcelleng.com.br'},tls:{rejectUnauthorized:true},logger:false,debug:false});
 expect(transport.sendMail).not.toHaveBeenCalled();expect(transport.close).toHaveBeenCalledOnce();
 expect(()=>financeSmtpOptions('')).toThrow();
});
it('gera MIME local com o mesmo PDF sem abrir SMTP',async()=>{
 const mime=(await simulateFinanceEmail(job())).toString();expect(mime).toContain('financeiro@marcelleng.com.br');expect(mime).toContain('X-Unsent: 1');expect(mime).toContain('Content-Type: application/pdf');expect(mime).toContain(Buffer.from('%PDF-fixture').toString('base64'));
});
it('só confirma aceitação do destinatário exato e mantém o remetente fixo',async()=>{
 const transport={sendMail:vi.fn(async()=>({accepted:['other@example.test'],messageId:'x'})),close:vi.fn()},send=createFinanceEmailTransport({password:'fake',createTransport:()=>transport});
 await expect(send(job())).rejects.toThrow('destinatário');
 await expect(send({...job(),sender:'outro@example.test'})).rejects.toThrow('remetente');
 expect(transport.sendMail).toHaveBeenCalledOnce();expect(transport.close).toHaveBeenCalledTimes(2);
});
it('integra SMTP e WhatsApp ao dispatcher com PDF e bloqueia nova execução, usando provedores simulados',async()=>{
 const delivery=prepareStatementDelivery({report:{projectId:'w',projectName:'Teste',month:'2026-11',simulation:false,charges:[{balance:50}]},recipient:{id:'c',email:'cliente@example.test',whatsapp:'81999990000'},pdf:Buffer.from('%PDF-fixture')});
 const states=new Map(),journal={reserve:(key,value)=>{if(states.has(key))return false;states.set(key,value);return true;},finish:(key,value)=>states.set(key,value)};
 const smtp={sendMail:vi.fn(async message=>({accepted:[message.to],messageId:'smtp-accepted'})),close:vi.fn()};
 const request=vi.fn(async(path,payload)=>path.startsWith('/api/sessions')?{status:'WORKING',me:{id:'5581989751300@c.us'}}:path.includes('check-exists')?{numberExists:true,chatId:'5581999990000@c.us'}:{id:'waha-accepted'});
 const transports={email:createFinanceEmailTransport({password:'fake',createTransport:()=>smtp}),whatsapp:createWahaStatementTransport({request,session:'marcell-test'})};
 const first=await dispatchStatementDelivery({delivery,journal,transports,mode:'live',enabled:true});expect(first.every(row=>row.state==='accepted')).toBe(true);
 expect(smtp.sendMail.mock.calls[0][0].attachments[0].content).toEqual(delivery.jobs[0].pdf);expect(request.mock.calls.at(-1)[1].file.data).toBe(delivery.jobs[0].pdf.toString('base64'));
 const repeat=await dispatchStatementDelivery({delivery,journal,transports,mode:'live',enabled:true});expect(repeat.every(row=>row.state==='already_attempted')).toBe(true);expect(smtp.sendMail).toHaveBeenCalledOnce();expect(request.mock.calls.filter(([path])=>path==='/api/sendFile')).toHaveLength(1);
});
