// Maintenance only: close sharing on an exact legacy tree, preserving files,
// owners and version history. Never receives or returns OAuth credentials.
export async function protectLegacyCompanyDrive({request,driveId,rootId,expectedSourceRoots,privateRootIds=[],apply=false,log=()=>{}}){
 const enc=encodeURIComponent,path=id=>`/drives/${enc(driveId)}/items/${enc(id)}`;
 const json=async url=>{const r=await request(url);if(!r.ok)throw Error('Legacy drive read refused');return r.json();};
 const pages=async url=>{const values=[];for(let i=0;url;i++){if(i>=100)throw Error('Legacy pagination limit');const data=await json(url);values.push(...data.value||[]);url=data['@odata.nextLink'];}return values;};
 const root=await json(path(rootId)+'?$select=id,name,folder,parentReference,remoteItem');
 if(root.id!==rootId||root.name!=='App'||!root.folder||root.remoteItem||root.parentReference?.driveId!==driveId||privateRootIds.includes(rootId))throw Error('Legacy root identity not confirmed');
 const nodes=[root],ids=new Set([rootId]);
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i];if(!node.folder)continue;
  const children=await pages(path(node.id)+'/children?$select=id,name,size,folder,file,parentReference,remoteItem,eTag');
  for(const child of children){if(child.remoteItem||child.parentReference?.id!==node.id||child.parentReference?.driveId!==driveId||ids.has(child.id)||privateRootIds.includes(child.id))throw Error('Legacy tree has an unverified or private descendant');ids.add(child.id);nodes.push(child);}
  if(nodes.length>10000)throw Error('Legacy inventory limit');
 }
 if(!expectedSourceRoots.length||expectedSourceRoots.some(id=>!ids.has(id)))throw Error('Legacy source workspace identity missing');
 const permissionPath=id=>path(id)+'/permissions',owner=p=>Array.isArray(p.roles)&&p.roles.length>0&&p.roles.every(r=>r==='owner')&&!p.link;
 const removed=[];
 if(apply){
  // Breadth-first order removes inherited sharing at its known source first.
  for(const node of nodes){const permissions=await pages(permissionPath(node.id));for(const p of permissions){if(owner(p))continue;if(!p.id||p.inheritedFrom&&!ids.has(p.inheritedFrom.id))throw Error('Sharing inherited outside reviewed legacy tree');const response=await request(permissionPath(node.id)+'/'+enc(p.id),{method:'DELETE'});if(!response.ok&&response.status!==404)throw Error('Legacy permission removal refused');removed.push({itemId:node.id,permissionId:p.id});}if(removed.length)log({phase:'legacy-sharing',visited:removed.length});}
 }
 const checks=[];
 for(let i=0;i<nodes.length;i+=4){const results=await Promise.all(nodes.slice(i,i+4).map(async node=>{const permissions=await pages(permissionPath(node.id));return {id:node.id,folder:!!node.folder,size:node.size??null,ownerOnly:permissions.length>0&&permissions.every(owner),permissionCount:permissions.length};}));checks.push(...results);log({phase:'legacy-permissions-checked',checked:checks.length,total:nodes.length});}
 return {at:new Date().toISOString(),passed:checks.every(x=>x.ownerOnly),applied:apply,driveId,rootId,expectedSourceRootsVerified:expectedSourceRoots.length,files:checks.filter(x=>!x.folder).length,folders:checks.filter(x=>x.folder).length,filesAndVersionsPreserved:true,privateRootsUntouched:true,remoteWrites:removed.length,removedPermissions:removed,checks};
}
