import nodemailer from 'nodemailer';
import {FINANCE_SENDER} from './client-statement-delivery.js';
export const LARK_SMTP={host:'smtp.larksuite.com',port:465,secure:true};
const validEmail=value=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value||'');
export function financeSmtpOptions(password){
 if(typeof password!=='string'||!password.trim()||password.length>2048)throw new Error('Informe a senha dedicada do Lark.');
 return {...LARK_SMTP,auth:{user:FINANCE_SENDER.email,pass:password},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true,servername:LARK_SMTP.host},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true};
}
export async function verifyFinanceEmail(password,{createTransport=nodemailer.createTransport}={}){
 const transport=createTransport(financeSmtpOptions(password));
 try{await transport.verify();return {authenticated:true,sender:FINANCE_SENDER.email,verifiedAt:new Date().toISOString(),messagesSent:0};}finally{transport.close();}
}
export function financeEmailMessage(job,{simulation=false}={}){
 if(job.sender!==FINANCE_SENDER.email||!validEmail(job.recipient)||!Buffer.isBuffer(job.pdf)||job.pdf.subarray(0,5).toString()!=='%PDF-')throw new Error('Confira remetente, destinatário e PDF.');
 return {from:{name:'Financeiro MARCELL',address:FINANCE_SENDER.email},to:job.recipient,replyTo:FINANCE_SENDER.email,
  subject:`${simulation?'SIMULAÇÃO LOCAL · ':''}Cobrança e prestação de contas MARCELL`,text:job.text,
  messageId:`<${job.key}@marcelleng.com.br>`,headers:simulation?{'X-Unsent':'1','X-MARCELL-Simulation':'true'}:{},
  attachments:[{filename:job.filename,content:job.pdf,contentType:'application/pdf'}],disableFileAccess:true,disableUrlAccess:true};
}
export function createFinanceEmailTransport({password,createTransport=nodemailer.createTransport}){
 return async job=>{
  const transport=createTransport(financeSmtpOptions(password));
  try{const info=await transport.sendMail(financeEmailMessage(job));if(!info.accepted?.some(value=>String(value).toLowerCase()===job.recipient.toLowerCase()))throw new Error('O servidor não confirmou o destinatário.');return {id:info.messageId};}finally{transport.close();}
 };
}
export async function simulateFinanceEmail(job){
 const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'windows',disableFileAccess:true,disableUrlAccess:true});
 return (await transport.sendMail(financeEmailMessage(job,{simulation:true}))).message;
}
