// Same drive is not proof of ownership: the ancestor must be the configured
// company root. This guard runs before reads and writes, including backups.
export async function assertDriveItemInCompanyRoot({driveId,itemId,root,readParent}){
  const denied=()=>Object.assign(new Error('O arquivo ou pasta está fora da raiz autorizada desta empresa.'),{status:403});
  if(!root?.id||!root?.parentReference?.driveId||String(driveId)!==String(root.parentReference.driveId))throw denied();
  const visited=new Set();let current=String(itemId||'');
  for(let depth=0;depth<64&&current;depth++){
    if(current===String(root.id))return true;
    if(visited.has(current))throw denied();visited.add(current);
    current=String((await readParent(current))?.parentReference?.id||'');
  }
  throw denied();
}

export function driveItemFromGraphPath(path){
  const match=/^\/drives\/([^/]+)\/items\/([^/:?]+)(?:[:/?]|$)/.exec(path);
  return match?{driveId:decodeURIComponent(match[1]),itemId:decodeURIComponent(match[2])}:null;
}
