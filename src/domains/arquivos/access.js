export function folderAccess(cabinet,folderId,user,mode='read') {
  if(!user||user.active===false)return false;
  if(user.role==='admin')return true;
  if(user.obraId&&String(user.obraId)!==String(cabinet.obraId))return false;
  const visited=new Set();let id=folderId;
  while(id){
    if(visited.has(id))return false;visited.add(id);
    const folder=(cabinet.folders||[]).find(item=>item.id===id);if(!folder)return false;
    if(folder.access?.restricted){
      if(!(folder.access.readers||[]).includes(user.id))return false;
      if(mode==='write'&&!(folder.access.editors||[]).includes(user.id))return false;
    }
    id=folder.parentId;
  }
  return true;
}
export function projectFileCabinet(cabinet,user){
  if(user.role==='admin')return cabinet;
  return {...cabinet,...(cabinet.folders?{folders:cabinet.folders.filter(item=>folderAccess(cabinet,item.id,user))}:{}),...(cabinet.documents?{documents:cabinet.documents.filter(item=>folderAccess(cabinet,item.folderId,user))}:{}),...(cabinet.history?{history:cabinet.history.filter(event=>Array.isArray(event.folderIds)&&event.folderIds.every(id=>folderAccess(cabinet,id,user)))}:{})};
}
export function cabinetFileAccess(data,user,reference){
  let registered=false,allowed=true;
  for(const cabinet of data.workFileCabinets||[])for(const document of cabinet.documents||[]){
    if(!(document.revisions||[]).some(revision=>{if(reference.localId)return revision.url===`/api/local-files/${reference.localId}`;let driveId=revision.driveId,itemId=revision.itemId;if(!driveId||!itemId){try{const url=new URL(revision.url,'https://local.invalid');driveId=url.searchParams.get('driveId');itemId=url.searchParams.get('itemId');}catch{return false;}}return driveId&&itemId&&String(driveId)===String(reference.driveId)&&String(itemId)===String(reference.itemId);} ))continue;
    registered=true;
    if(!user||!folderAccess(cabinet,document.folderId,user))allowed=false;
  }
  return {registered,allowed:!registered||allowed};
}
