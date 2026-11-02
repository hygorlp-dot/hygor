import {createServer} from 'vite';
import {randomUUID} from 'node:crypto';
import {data as initial} from './fixtures/workflow-priorities-data.mjs';
import {applyOperationalCommand} from '../src/domains/sync/operational-commands.js';
import {authorizeOperationalCommand} from '../api/data.js';
import {validateOperationalCommandScope} from '../server/operational-command-policy.js';
import {projectDataForUser} from '../server/data-projection.js';
import {operatorPilotTemplate} from './lib/operator-pilot.mjs';

// Synthetic, loopback-only session. No handler forwards a request to a remote API or database.
const roles={engineering:'engenheiro',purchases:'compras',finance:'financeiro'};
const profiles=operatorPilotTemplate().participants.map(person=>({id:person.id,nome:`Piloto ${person.id}`,email:`${person.id.toLowerCase()}@piloto.local`,role:roles[person.role],active:true,...(person.role==='engineering'?{obraId:'a'}:{})}));
let data={...structuredClone(initial),usuarios:profiles};const sessions=new Map();
const failure=process.env.WF_PILOT_FAILURE||'';let failed=false;
if(!['','network-before','lost-response','expired'].includes(failure))throw new Error('WF_PILOT_FAILURE inválido.');
const port=Number(process.env.WF_OPERATOR_PORT||4234);
const server=await createServer({server:{host:'127.0.0.1',port,strictPort:true,watch:{ignored:['**/artifacts/**']}},plugins:[{name:'wf10-local-pilot',configureServer(vite){
 vite.middlewares.use('/api',async(req,res)=>{
  const respond=(status,result)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(result));};
  try{
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2_000_000)return respond(413,{ok:false,error:'Carga maior que o limite da prévia local.'});}
   const body=raw?JSON.parse(raw):{};
   if(body.action==='profiles')return respond(200,{usuarios:profiles,precisaSetup:false});
   let user=sessions.get(String(req.headers.authorization||'').replace(/^Bearer\s+/i,''));
   if(body.action==='auth-login'){
    user=profiles.find(profile=>profile.email===String(body.email||'').toLowerCase());
    if(!user||body.password!=='piloto-local')return respond(401,{ok:false,error:'Use uma conta de demonstração e a senha do roteiro local.'});
    const token=randomUUID();sessions.set(token,user);return respond(200,{ok:true,usuario:user,accessToken:token,refreshToken:token,data:projectDataForUser(data,user),updatedAt:new Date().toISOString()});
   }
   if(body.action==='auth-refresh'){
    user=sessions.get(body.refreshToken);if(!user)return respond(401,{ok:false,error:'Reentre na conta de demonstração desta prévia.'});
    return respond(200,{ok:true,usuario:user,accessToken:body.refreshToken,refreshToken:body.refreshToken});
   }
   if(!user)return respond(401,{ok:false,error:'Entre na prévia local com sua conta de demonstração.'});
   if(body.action==='operational-command'){
    const command={...body.command,actorId:user.id,actorName:user.nome};const authorization=authorizeOperationalCommand(command.type,user.role);
    if(!authorization.ok)return respond(authorization.status||403,authorization);
    const scope=validateOperationalCommandScope({user,data,command});if(!scope.ok)return respond(403,scope);
    if(!failed&&failure==='expired'){failed=true;for(const [token,owner] of sessions)if(owner.id===user.id)sessions.delete(token);return respond(401,{ok:false,error:'Sessão expirada no cenário sintético. Renove a mesma conta.'});}
    if(!failed&&failure==='network-before'){failed=true;return res.destroy();}
    const result=applyOperationalCommand(data,command);if(result.ok)data=result.data;
    if(result.ok&&!failed&&failure==='lost-response'){failed=true;return res.destroy();}
    return respond(result.ok?200:409,{...result,data:projectDataForUser(data,user),updatedAt:new Date().toISOString()});
   }
   if(['save','save-sections','financial-command'].includes(body.action))return respond(409,{ok:false,error:'Esta prévia aceita somente os comandos operacionais isolados. Registre a limitação no roteiro, sem alterar dados reais.'});
   if(['financial-dre-report','financial-company-dre-report'].includes(body.action))return respond(200,{ok:true,current:null,history:[]});
   if(req.url.startsWith('/microsoft/'))return respond(200,{ok:false,connected:false,error:'Provedor documental não conectado nesta prévia sintética.'});
   return respond(200,{ok:true,usuario:user,data:projectDataForUser(data,user),updatedAt:new Date().toISOString(),items:[],bases:[],presencas:[]});
  }catch{return respond(400,{ok:false,error:'Operação indisponível na prévia sintética. Registre a limitação com o facilitador.'});}
 });
}}]});
await server.listen();console.log(`Piloto sintético local: http://127.0.0.1:${port}`);console.log('Contas: e01/e02/c01/c02/f01/f02@piloto.local | senha de demonstração: piloto-local');console.log('Estado somente em memória; reinicie entre participantes para restaurar a referência.');
