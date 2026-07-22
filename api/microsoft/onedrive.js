import { fileSignature, getOrCreateFolder, graph, refresh, safeName, seal, setCookie, verifyAppUser, workspace } from "./_graph.js";

export const config={api:{bodyParser:{sizeLimit:"8mb"}}};
const categoryNames={capa:"06 - Capa da Obra",diario:"04 - Diário de Obras",fotos:"05 - Fotos",conferencia:"07 - Conferências Técnicas",financeiro:"08 - Financeiro e Fiscal",compras:"09 - Compras e Suprimentos",licenciamento:"10 - Licenciamento",contratos:"01 - Contratos",projetos:"02 - Projetos",documentos:"03 - Documentos"};

export default async function handler(req,res){
  try{
    const action=req.query.action||req.body?.action||"status";
    const appUser=action==="file"?null:await verifyAppUser(req.body?.userId,req.body?.pin,req.body?.accessToken);
    if(action!=="file"&&!appUser)return res.status(401).json({error:"Sessão do aplicativo inválida."});
    if(action==="file"&&req.query.sig!==fileSignature(req.query.driveId,req.query.itemId))return res.status(403).end();
    const {accessToken,session}=await refresh(req); setCookie(res,"arcd_ms",seal(session));
    if(action==="status")return res.json({ok:true,connected:true});
    if(action==="file"){
      const r=await graph(accessToken,`/drives/${encodeURIComponent(req.query.driveId)}/items/${encodeURIComponent(req.query.itemId)}/content`,{redirect:"follow"});
      res.setHeader("content-type",r.headers.get("content-type")||"application/octet-stream");
      res.setHeader("cache-control","private, max-age=300"); return res.send(Buffer.from(await r.arrayBuffer()));
    }
    const body=req.body||{};
    if(action==="file-link"){
      if(!body.driveId||!body.itemId)return res.status(400).json({error:"Arquivo sem identificação no OneDrive."});
      const sig=fileSignature(body.driveId,body.itemId);
      const url=`/api/microsoft/onedrive?action=file&driveId=${encodeURIComponent(body.driveId)}&itemId=${encodeURIComponent(body.itemId)}&sig=${encodeURIComponent(sig)}`;
      return res.json({ok:true,url});
    }
    if(action==="create-workspace"){
      const ws=await workspace(accessToken,body.obraName);
      return res.json({ok:true,...ws,...(appUser.role==="admin"?{}:{webUrl:undefined})});
    }
    if(action==="create-folder"){
      const folder=await getOrCreateFolder(accessToken,body.driveId,body.parentId,safeName(body.name));
      return res.json({ok:true,folder:appUser.role==="admin"?folder:{...folder,webUrl:undefined}});
    }
    if(action==="upload"){
      let ws={driveId:body.driveId,folderId:body.folderId,folders:body.folders};
      if(!ws.driveId||!ws.folderId||!ws.folders)ws=await workspace(accessToken,body.obraName);
      const categoryName=categoryNames[body.category]||categoryNames.documentos;
      let parentId=ws.folders?.[categoryName]||ws.folderId;
      if(!ws.folders?.[categoryName]){
        const categoryFolder=await getOrCreateFolder(accessToken,ws.driveId,ws.folderId,categoryName);
        parentId=categoryFolder.id;
        ws={...ws,folders:{...(ws.folders||{}),[categoryName]:parentId}};
      }
      if(["diario","conferencia"].includes(body.category)&&body.date)parentId=(await getOrCreateFolder(accessToken,ws.driveId,parentId,body.date)).id;
      const subpastas=String(body.subfolder||"").split("/").map(x=>x.trim()).filter(Boolean).slice(0,3).map(safeName);
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
