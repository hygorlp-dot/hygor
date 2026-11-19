import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const financePrivateDirectory=path.join(homedir(),'.codex/private-config/client-billing');
const helper=fileURLToPath(new URL('./client-billing-private.py',import.meta.url));
export function privateBridge(operation,bytes=Buffer.alloc(0)){
 return new Promise((resolve,reject)=>{
  const child=spawn('python',[helper,operation],{windowsHide:true,stdio:['pipe','pipe','pipe']}),parts=[];
  const timer=setTimeout(()=>child.kill(),25000);child.stdout.on('data',chunk=>parts.push(chunk));child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(new Error('A conexão privada local não está disponível.'));});child.on('close',code=>{clearTimeout(timer);code===0?resolve(Buffer.concat(parts)):reject(new Error('Não foi possível acessar a conexão privada local.'));});child.stdin.end(bytes);
 });
}
export async function saveFinancePassword(password){
 const ciphertext=await privateBridge('protect',Buffer.from(password));await mkdir(financePrivateDirectory,{recursive:true});
 const temporary=path.join(financePrivateDirectory,'smtp.dpapi.tmp');await writeFile(temporary,ciphertext,{mode:0o600});await rename(temporary,path.join(financePrivateDirectory,'smtp.dpapi'));
 await writeFile(path.join(financePrivateDirectory,'connection.json'),JSON.stringify({sender:'financeiro@marcelleng.com.br',provider:'Lark',verifiedAt:new Date().toISOString(),automaticDelivery:false},null,2),{mode:0o600});
}
export async function loadFinancePassword(){return (await privateBridge('unprotect',await readFile(path.join(financePrivateDirectory,'smtp.dpapi')))).toString('utf8');}
export async function financeConnectionStatus(){
 let email={authenticated:false,sender:'financeiro@marcelleng.com.br'};
 try{const info=JSON.parse(await readFile(path.join(financePrivateDirectory,'connection.json'),'utf8'));await readFile(path.join(financePrivateDirectory,'smtp.dpapi'));email={...email,authenticated:true,verifiedAt:info.verifiedAt};}catch{}
 let whatsapp={connected:false,sender:'5581989751300'};try{whatsapp=JSON.parse((await privateBridge('waha-status')).toString());}catch{}
 return {email,whatsapp,automaticDelivery:false,messagesSent:0};
}
