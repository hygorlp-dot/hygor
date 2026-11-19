import {createHash} from 'node:crypto';
import {companySourceView} from './company-source-view.js';
import {decodeAppData} from './data-codec.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const projectFields=['obraId','projectId','project_id','obra_id','workId','obraOrigemId','obraDestinoId'];
const validSegment=value=>typeof value==='string'&&value.length>0&&!/^[. ]|[. ]$|[<>:"/\\|?*\x00-\x1f]/.test(value)&&!['.','..'].includes(value)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
const reference=value=>{
  if(!value||typeof value!=='object')return null;
  if(value.driveId&&value.itemId)return {driveId:String(value.driveId),itemId:String(value.itemId)};
  if(typeof value.url!=='string'||!value.url.startsWith('/api/microsoft/onedrive?'))return null;
  const url=new URL(value.url,'https://local.invalid'),driveId=url.searchParams.get('driveId'),itemId=url.searchParams.get('itemId');
  return driveId&&itemId?{driveId,itemId}:null;
};

// No provider SDK or network access: symbolic destinations are deliberately
// separate from actual Graph IDs, which require a later cloud inspection.
export function prepareCompanyFileSeparation(plan,audit,targets){
  if(!plan.sourceHash||plan.sourceHash!==audit.sourceHash)throw new Error('O inventário pertence a outra captura.');
  if(!Array.isArray(targets)||targets.length!==2||new Set(targets.map(target=>target.projectId)).size!==2)throw new Error('Informe as duas obras por identidades distintas.');
  const views=Object.fromEntries(['arcd','mrc'].map(company=>[company,companySourceView(plan.companies[company].tables,company).data]));
  const references=[];
  const visit=(node,company,path,scope=[])=>{
    if(!node||typeof node!=='object')return;
    let own=projectFields.filter(key=>node[key]!==undefined&&node[key]!==null&&node[key]!=='').map(key=>String(node[key]));
    if(/^\/current\/obras\/\d+$/.test(path)&&node.id)own=[String(node.id)];
    if(/^\/tables\/core_projects\/[^/]+$/.test(path)&&node.id&&plan.projects[String(node.id)]===company)own=[String(node.id)];
    const projects=own.length?[...new Set(own)]:scope,ref=reference(node);
    if(ref)references.push({...ref,company,path,projects});
    for(const [key,value]of Object.entries(node))if(value&&typeof value==='object')visit(value,company,`${path}/${key}`,projects);
  };
  for(const company of ['arcd','mrc']){
    visit(views[company],company,'/current');
    for(const row of plan.companies[company].tables.company_app_data||[])if(row.key.startsWith('arced_chat_msg__')||row.key.startsWith('rh_doc_'))visit(decodeAppData(row.value),company,`/company_app_data/${row.key}`);
    for(const [table,rows]of Object.entries(plan.companies[company].tables))if(table!=='company_app_data'&&!table.startsWith('budget_reference_'))for(const row of rows)visit(row,company,`/tables/${table}/${row.id||row.event_id||hash(row)}`);
  }
  const workspaces=targets.map(target=>{
    if(!['arcd','mrc'].includes(target.company)||plan.projects[target.projectId]!==target.company||!validSegment(target.projectId))throw new Error('Destino de obra incompatível com a empresa.');
    const matches=views[target.company].obras.filter(work=>String(work.id)===target.projectId);
    if(matches.length!==1)throw new Error('Obra ausente ou ambígua na cópia.');
    const work=matches[0];
    if(!work.oneDriveDriveId||!work.oneDriveFolderId)throw new Error('Pasta de origem sem identidade comprovada.');
    const categories=Object.entries(work.oneDriveFolders||{}).map(([name,folderId])=>{
      const segments=name.split('/');if(!segments.every(validSegment)||!folderId)throw new Error('Categoria de pasta inválida.');
      return {name,sourceFolderId:String(folderId),destinationSegments:['obras',target.projectId,...segments],remoteFolderId:null};
    });
    const relevant=references.filter(ref=>ref.company===target.company&&ref.projects.includes(target.projectId));
    const identities=[...new Set(relevant.map(ref=>JSON.stringify([ref.driveId,ref.itemId])))];
    const documents=identities.map(identity=>{
      const [driveId,itemId]=JSON.parse(identity),all=references.filter(ref=>ref.driveId===driveId&&ref.itemId===itemId);
      const conflicts=all.filter(ref=>ref.company!==target.company||ref.projects.length!==1||ref.projects[0]!==target.projectId);
      const sourcePaths=all.filter(ref=>ref.company===target.company&&ref.projects.length===1&&ref.projects[0]===target.projectId).map(ref=>ref.path);
      return {driveId,itemId,sourcePaths:[...new Set(sourcePaths)],state:conflicts.length?'blocked-shared-or-ambiguous':'copy-candidate-pending-cloud-inspection',conflicts,destinationCompany:target.company,destinationProjectId:target.projectId,remoteItemId:null,
        action:'copy-identified-item-only',requiredChecks:['source-item-exists','source-inside-shared-root','content-sha256','destination-private-permissions','destination-hash-matches','all-references-updated-after-copy']};
    });
    return {company:target.company,projectId:target.projectId,projectName:work.name,source:{driveId:String(work.oneDriveDriveId),folderId:String(work.oneDriveFolderId)},destination:{companyRootRef:`company-root:${target.company}`,segments:['obras',target.projectId],remoteDriveId:null,remoteFolderId:null},categories,documents,
      sourceRootAction:'preserve-until-full-inventory-and-segregation-reviewed',unlistedChildren:'unassigned-pending-cloud-inventory',rootLinkAction:'replace-only-after-exclusive-root-verification'};
  });
  if(workspaces[0].source.driveId!==workspaces[1].source.driveId||workspaces[0].source.folderId!==workspaces[1].source.folderId)throw new Error('As obras informadas não correspondem ao conflito de pasta capturado.');
  const photos=audit.objects.filter(object=>object.public&&object.bucket==='diario-obra').map(object=>{
    if(object.company!=='arcd'||!object.projectId||plan.projects[object.projectId]!=='arcd'||!object.localCopy||object.quarantine||!object.name.split('/').every(validSegment))throw new Error('Foto pública sem proprietário e cópia conferidos.');
    const refs=audit.references.filter(ref=>ref.provider==='storage'&&ref.company===object.company&&ref.host===object.originHost&&ref.bucket===object.bucket&&ref.name===object.name);
    const persistedReferences=[];
    const findStoredReferences=(value,path,row)=>{
      if(typeof value==='string'&&/^https?:\/\//i.test(value)){
        try{
          const url=new URL(value),match=/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/.exec(url.pathname);
          if(url.host===object.originHost&&match&&decodeURIComponent(match[1])===object.bucket&&decodeURIComponent(match[2])===object.name)persistedReferences.push({company:object.company,rowKey:row.key,rowUpdatedAt:row.updated_at||null,decodedRowHash:hash(decodeAppData(row.value)),pointer:path,oldValueHash:hash(value),replaceAfterPrivateReaderAndCopyVerification:true});
        }catch{ /* Non-file strings do not establish a link. */ }
      }else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))findStoredReferences(item,`${path}/${key.replace(/~/g,'~0').replace(/\//g,'~1')}`,row);
    };
    for(const row of plan.companies[object.company].tables.company_app_data||[])if(['arced_ponto_v1','arced_ponto_v1__rdo'].includes(row.key))findStoredReferences(decodeAppData(row.value),'',row);
    return {objectId:object.id,company:object.company,projectId:object.projectId,source:{bucket:object.bucket,name:object.name,updatedAt:object.updatedAt},sourceLocalCopy:structuredClone(object.localCopy),sha256:object.localCopy.sha256,bytes:Number(object.size),mime:object.mime,
      destination:{bucket:'company-files-private',public:false,name:`${object.company}/${object.name}`},references:refs.map(ref=>({path:ref.path,replaceAfterVerification:true})),persistedReferences,attachToNewRecord:false,state:'prepared-local-only',remoteObjectId:null,
      sourcePublicAccess:'unchanged-until-cloud-cutover',sourceRemoval:'not-authorized-by-this-plan'};
  });
  if(photos.length!==2||new Set(photos.map(photo=>photo.objectId)).size!==2)throw new Error('Esperadas exatamente duas fotos públicas distintas.');
  const result={version:1,sourceHash:plan.sourceHash,planHash:hash(plan),auditHash:hash(audit),localOnly:true,networkAllowed:false,remoteWrites:0,activationReady:false,workspaces,photos,
    storageContract:{bucket:'company-files-private',public:false,clientDirectAccess:false,prefix:'<company>/<project>/<year>/<object>',read:'authenticated-company-scoped-api',preserveOriginals:true},
    cutoverOrder:['recheck-current-origin-and-complete-cloud-inventory','verify-exclusive-company-roots-and-permissions','copy-identified-items-without-moving-shared-root','verify-destination-content-and-permissions','replace-exact-references-with-optimistic-concurrency','renew-links-and-test-both-company-profiles','review-public-origin-revocation-separately','reconcile-data-before-any-activation'],
    dre:{createsFinancialEvents:false,changesFinancialFacts:false,changesRecognition:false,changesPayments:false}};
  const summary={
    workspaces:workspaces.length,
    categories:workspaces.reduce((n,ws)=>n+ws.categories.length,0),
    identifiedDocuments:workspaces.reduce((n,ws)=>n+ws.documents.length,0),
    blockedDocuments:workspaces.reduce((n,ws)=>n+ws.documents.filter(doc=>doc.state.startsWith('blocked')).length,0),
    photos:photos.length,
    photoBytes:photos.reduce((n,photo)=>n+photo.bytes,0),
    activePhotoReferences:photos.reduce((n,photo)=>n+photo.references.length,0),
  };
  return {...result,preparationHash:hash(result),summary};
}
