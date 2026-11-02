const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function rankOriginalCandidate(original,file){
 const sameId=normalize(original.itemId)===normalize(file.id)&&normalize(original.driveId)===normalize(file.driveId);
 const sameName=normalize(original.name)===normalize(file.name);
 const sameSize=Number(original.size)>0&&Number(original.size)===Number(file.size);
 if(!sameId&&!sameName&&!sameSize)return null;
 const sizeConflict=sameName&&Number(original.size)>0&&Number(file.size)>0&&!sameSize;
 return {score:sameId?100:sameName&&!sizeConflict?(sameSize?100:90):sameName?50:30,
  evidence:[...(sameId?['same-item-id']:[]),...(sameName?['same-file-name']:[]),...(sameSize?['same-byte-size']:[]),...(sizeConflict?['different-byte-size']:[])],
  confidence:sameId?'same-reference':sameName&&!sizeConflict?'name-match':'manual-comparison'};
}
export function proposedOriginalCorrection(original,candidates){
 const confirmed=candidates.filter(c=>c.confidence==='same-reference'&&c.evidence.includes('same-file-name')&&c.evidence.includes('same-byte-size'));
 if(confirmed.length===1)return {status:'reference-confirmed',original,candidates,proposed:null,applied:false,
  recommendation:confirmed[0].contentVerified?'keep-existing-reference':'repair-local-reader-and-retest'};
 const strong=candidates.filter(c=>c.score>=90&&c.contentVerified);
 return {status:strong.length===1?'ready-for-review':strong.length>1?'ambiguous':'not-located',
  original,candidates,proposed:strong.length===1?{driveId:strong[0].driveId,itemId:strong[0].id,path:strong[0].path,
   webUrl:strong[0].webUrl||null,requiresFreshSignedUrl:true}:null,
  applied:false};
}
