import { fileSignature, getOrCreateFolder, graph, refresh, rootItem, safeName, seal, setCookie, verifyAppUser, workspace } from "../../server/microsoft/graph.js";
import { findScopedWork, knownWorkspace, scopedWorks } from "../../server/onedrive-scope.js";

export const config={api:{bodyParser:{sizeLimit:"8mb"}}};
const categoryNames={capa:"06 - Capa da Obra",diario:"04 - Diário de Obras",fotos:"05 - Fotos",conferencia:"07 - Conferências Técnicas",financeiro:"08 - Financeiro e Fiscal",compras:"09 - Compras e Suprimentos",licenciamento:"03 - Documentos",contratos:"01 - Contratos",projetos:"02 - Projetos",documentos:"03 - Documentos",outros:"11 - Outros"};
const assertInsideWorkspace=async(token,context,driveId,itemId)=>{
  const roots=scopedWorks(context).map(knownWorkspace)
    .filter(ws=>ws.driveId&&ws.driveId===String(driveId)&&ws.folderId)
    .map(ws=>ws.folderId);
  if(!roots.length||!itemId)
    throw Object.assign(new Error("A pasta não pertence a uma obra disponível para este usuário."),{status:403});
  let current=String(itemId);
  for(let depth=0;depth<16;depth++){
    if(roots.includes(current))return true;
    const item=await (await graph(token,`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(current)}?$select=id,parentReference`)).json();
    current=String(item?.parentReference?.id||"");
    if(!current)break;
  }
  throw Object.assign(new Error("O item solicitado está fora da pasta protegida da obra."),{status:403});
};

const listarFilhos=async(token,driveId,parentId)=>(await (await graph(token,`/drives/${driveId}/items/${parentId}/children?$select=id,name,webUrl,folder,file,parentReference`)).json()).value||[];
const migrarLicenciamentoLegado=async(token,ws)=>{
  const filhosObra=await listarFilhos(token,ws.driveId,ws.folderId);
  const legado=filhosObra.find(x=>x.folder&&x.name.toLocaleLowerCase("pt-BR")==="10 - licenciamento");
  const destinoId=ws.folders?.["03 - Documentos/Licenciamento"];
  if(!legado||!destinoId)return {movidos:0,conflitos:0};
  const [origem,destino]=await Promise.all([listarFilhos(token,ws.driveId,legado.id),listarFilhos(token,ws.driveId,destinoId)]);
  const nomesDestino=new Set(destino.map(x=>x.name.toLocaleLowerCase("pt-BR")));
  let movidos=0,conflitos=0;
  for(const item of origem){
    if(nomesDestino.has(item.name.toLocaleLowerCase("pt-BR"))){conflitos++;continue;}
    try{
      await graph(token,`/drives/${ws.driveId}/items/${item.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({parentReference:{id:destinoId}})});
      nomesDestino.add(item.name.toLocaleLowerCase("pt-BR"));movidos++;
    }catch{conflitos++;}
  }
  return {movidos,conflitos};
};

export default async function handler(req,res){
  try{
    const action=req.query.action||req.body?.action||"status";
    const appContext=action==="file"?null:await verifyAppUser(req.body?.userId,req.body?.pin,req.body?.accessToken);
    const appUser=appContext?.user;
    if(action!=="file"&&!appContext)return res.status(401).json({error:"Sessão do aplicativo inválida."});
    if(action==="file"&&req.query.sig!==fileSignature(req.query.driveId,req.query.itemId))return res.status(403).end();
    const {accessToken,session}=await refresh(req); setCookie(res,"arcd_ms",seal(session));
    if(action==="status")return res.json({ok:true,connected:true});
    if(action==="file"){
      const r=await graph(accessToken,`/drives/${encodeURIComponent(req.query.driveId)}/items/${encodeURIComponent(req.query.itemId)}/content`,{redirect:"follow"});
      res.setHeader("content-type",r.headers.get("content-type")||"application/octet-stream");
      res.setHeader("cache-control","private, max-age=300"); return res.send(Buffer.from(await r.arrayBuffer()));
    }
    const body=req.body||{};
    const obraEscopo=findScopedWork(appContext,body);
    if(action==="file-link"){
      if(!body.driveId||!body.itemId)return res.status(400).json({error:"Arquivo sem identificação no OneDrive."});
      await assertInsideWorkspace(accessToken,appContext,body.driveId,body.itemId);
      const sig=fileSignature(body.driveId,body.itemId);
      const url=`/api/microsoft/onedrive?action=file&driveId=${encodeURIComponent(body.driveId)}&itemId=${encodeURIComponent(body.itemId)}&sig=${encodeURIComponent(sig)}`;
      return res.json({ok:true,url});
    }
    if(action==="sync-workspaces"){
      if(appUser.role!=="admin")return res.status(403).json({error:"Apenas administradores podem preparar a estrutura das obras."});
      const obras=(Array.isArray(body.obras)?body.obras:[]).filter(o=>o&&String(o.name||"").trim()).slice(0,100);
      if(!obras.length)return res.json({ok:true,resultados:[]});
      const root=await rootItem(accessToken);
      const resultados=[];
      for(let i=0;i<obras.length;i+=4){
        const lote=await Promise.all(obras.slice(i,i+4).map(async obra=>{
          try{
            const ws=await workspace(accessToken,String(obra.name).trim(),root,{driveId:String(obra.driveId||""),folderId:String(obra.folderId||"")});
            const migracao=await migrarLicenciamentoLegado(accessToken,ws);
            return {id:String(obra.id||""),name:String(obra.name),ok:true,workspace:ws,migracao};
          }catch(e){return {id:String(obra.id||""),name:String(obra.name),ok:false,error:String(e.message||e)};}
        }));
        resultados.push(...lote);
      }
      return res.json({ok:resultados.every(x=>x.ok),resultados});
    }
    if(action==="create-workspace"){
      if(!obraEscopo)return res.status(403).json({error:"A obra não está disponível para este usuário."});
      const ws=await workspace(accessToken,obraEscopo.name,null,knownWorkspace(obraEscopo));
      return res.json({ok:true,...ws,...(appUser.role==="admin"?{}:{webUrl:undefined})});
    }
    if(action==="create-folder"){
      await assertInsideWorkspace(accessToken,appContext,body.driveId,body.parentId);
      const folder=await getOrCreateFolder(accessToken,body.driveId,body.parentId,safeName(body.name));
      return res.json({ok:true,folder:appUser.role==="admin"?folder:{...folder,webUrl:undefined}});
    }
    if(action==="list-folder"){
      if(!body.driveId||!body.parentId)return res.status(400).json({error:"Pasta sem identificação no OneDrive."});
      await assertInsideWorkspace(accessToken,appContext,body.driveId,body.parentId);
      const path=`/drives/${encodeURIComponent(body.driveId)}/items/${encodeURIComponent(body.parentId)}/children?$top=200&$select=id,name,folder,file,size,lastModifiedDateTime`;
      const lista=await (await graph(accessToken,path)).json();
      const items=(lista.value||[]).map(item=>{
        const tipo=item.folder?"folder":"file";
        const url=tipo==="file"?`/api/microsoft/onedrive?action=file&driveId=${encodeURIComponent(body.driveId)}&itemId=${encodeURIComponent(item.id)}&sig=${encodeURIComponent(fileSignature(body.driveId,item.id))}`:"";
        return {id:item.id,name:item.name,type:tipo,url,size:Number(item.size||0),childCount:Number(item.folder?.childCount||0),lastModifiedDateTime:item.lastModifiedDateTime||""};
      }).sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}):a.type==="folder"?-1:1);
      return res.json({ok:true,items});
    }
    if(action==="upload"){
      if(!obraEscopo)return res.status(403).json({error:"A obra não está disponível para este usuário."});
      let ws=knownWorkspace(obraEscopo);
      if(!ws.driveId||!ws.folderId)ws=await workspace(accessToken,obraEscopo.name,null,ws);
      if(body.targetFolderId)await assertInsideWorkspace(accessToken,appContext,ws.driveId,body.targetFolderId);
      const categoryName=categoryNames[body.category]||categoryNames.documentos;
      let parentId=body.targetFolderId||ws.folders?.[categoryName]||ws.folderId;
      if(!body.targetFolderId&&!ws.folders?.[categoryName]){
        const categoryFolder=await getOrCreateFolder(accessToken,ws.driveId,ws.folderId,categoryName);
        parentId=categoryFolder.id;
        ws={...ws,folders:{...(ws.folders||{}),[categoryName]:parentId}};
      }
      if(["diario","conferencia"].includes(body.category)&&body.date)parentId=(await getOrCreateFolder(accessToken,ws.driveId,parentId,body.date)).id;
      const caminho=body.category==="licenciamento"?`Licenciamento/${body.subfolder||""}`:String(body.subfolder||"");
      const subpastas=caminho.split("/").map(x=>x.trim()).filter(Boolean).slice(0,3).map(safeName);
      for(const subpasta of subpastas)parentId=(await getOrCreateFolder(accessToken,ws.driveId,parentId,subpasta)).id;
      const match=String(body.dataUrl||"").match(/^data:([^;]+);base64,(.+)$/);
      if(!match) return res.status(400).json({error:"Arquivo inválido."});
      const buffer=Buffer.from(match[2],"base64"); if(buffer.length>6*1024*1024)return res.status(413).json({error:"Arquivo maior que 6 MB."});
      const fileName=safeName(body.fileName||`arquivo-${Date.now()}`);
      const item=await (await graph(accessToken,`/drives/${ws.driveId}/items/${parentId}:/${encodeURIComponent(fileName)}:/content`,{method:"PUT",headers:{"content-type":match[1]},body:buffer})).json();
      const sig=fileSignature(ws.driveId,item.id);
      const url=`/api/microsoft/onedrive?action=file&driveId=${encodeURIComponent(ws.driveId)}&itemId=${encodeURIComponent(item.id)}&sig=${encodeURIComponent(sig)}`;
      return res.json({ok:true,url,path:item.id,item:appUser.role==="admin"?item:{...item,webUrl:undefined},workspace:appUser.role==="admin"?ws:{...ws,webUrl:undefined}});
    }
    res.status(400).json({error:"Ação inválida."});
  }catch(e){res.status(e.status||500).json({error:String(e.message||e),needsConnection:e.status===401});}
}
