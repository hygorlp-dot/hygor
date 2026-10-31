import { describe,it,expect } from 'vitest';
import { FILE_COMMAND as C } from './commands.js';
import { applyOperationalCommand } from '../sync/operational-commands.js';
import { validateFileCabinetScope } from '../../../server/work-file-cabinet-policy.js';
import { projectDataForUser } from '../../../server/data-projection.js';
import { sourceDocuments } from './source-documents.js';
import { fileMime, fileUrl, fileValidation } from './model.js';
const actor={id:'u',role:'engenheiro',nome:'Ana',active:true,obraId:'a'};
const initial=()=>({obras:[{id:'a',name:'Obra A'},{id:'b',name:'Obra B'}],usuarios:[actor],workFileCabinets:[]});
let sequence=0;
function command(type,payload={},version=0){return {type,payload:{obraId:'a',...payload},expectedVersion:version,idempotencyKey:`files-test-operation-${++sequence}`,actorId:actor.id,actorRole:actor.role,actorName:actor.nome,now:'2026-10-31T12:00:00Z'};}
const document={id:'d',revisionId:'r1',name:'Projeto',kind:'link',url:'https://example.org/r1.pdf',label:'R01',folderId:'',note:'Primeira emissão'};
describe('Central de arquivos da obra',()=>{
  it('cria subpastas, move documento e mantém revisões imutáveis e auditoria',()=>{
    let data=initial();for(const [type,payload] of [[C.FOLDER_SAVED,{id:'f',name:'Projetos'}],[C.FOLDER_SAVED,{id:'s',name:'Arquitetura',parentId:'f'}],[C.DOCUMENT_ADDED,document],[C.DOCUMENT_MOVED,{id:'d',folderId:'s'}],[C.REVISION_ADDED,{...document,revisionId:'r2',label:'R02',url:'https://example.org/r2.pdf'}]]){const before=structuredClone(data);const result=applyOperationalCommand(data,command(type,payload,data.workFileCabinets[0]?.version||0));expect(result.ok,result.reason).toBe(true);expect(data).toEqual(before);data=result.data;}
    const cabinet=data.workFileCabinets[0];expect(cabinet.documents[0].folderId).toBe('s');expect(cabinet.documents[0].revisions.map(r=>r.url)).toEqual(['https://example.org/r1.pdf','https://example.org/r2.pdf']);expect(cabinet.history).toHaveLength(5);
  });
  it('reenvio da mesma operação é idempotente mesmo após a janela de recibos',()=>{
    const c=command(C.DOCUMENT_ADDED,document),first=applyOperationalCommand(initial(),c);
    const result=applyOperationalCommand({...first.data,operationalCommandReceipts:[]},c);expect(result.ok).toBe(true);expect(result.data.workFileCabinets[0].documents).toHaveLength(1);expect(result.data.workFileCabinets[0].history).toHaveLength(1);
  });
  it('rejeita versões concorrentes e rótulos de revisão repetidos',()=>{
    const first=applyOperationalCommand(initial(),command(C.DOCUMENT_ADDED,document));
    expect(applyOperationalCommand(first.data,command(C.REVISION_ADDED,{...document,revisionId:'r2'})).ok).toBe(false);
    expect(applyOperationalCommand(first.data,command(C.REVISION_ADDED,{...document,revisionId:'r2'},1)).reason).toMatch(/já existe/);
  });
  it('não permite ciclos e pastas duplicadas',()=>{
    const first=applyOperationalCommand(initial(),command(C.FOLDER_SAVED,{id:'f',name:'Projetos'}));
    const second=applyOperationalCommand(first.data,command(C.FOLDER_SAVED,{id:'s',name:'Arquitetura',parentId:'f'},1));
    expect(applyOperationalCommand(second.data,command(C.FOLDER_SAVED,{id:'f',name:'Projetos',parentId:'s'},2)).ok).toBe(false);
    expect(applyOperationalCommand(first.data,command(C.FOLDER_SAVED,{id:'g',name:'projetos'},1)).ok).toBe(false);
  });
  it('rejeita documento ou pasta de outra obra',()=>{
    const first=applyOperationalCommand(initial(),command(C.DOCUMENT_ADDED,{...document,obraId:'b'}));
    expect(applyOperationalCommand(first.data,command(C.REVISION_ADDED,{...document,label:'R02'})).ok).toBe(false);
    expect(applyOperationalCommand(initial(),command(C.DOCUMENT_ADDED,{...document,folderId:'foreign'})).ok).toBe(false);
  });
  it('aplica modelo sem duplicar pastas existentes',()=>{
    const first=applyOperationalCommand(initial(),command(C.TEMPLATE_APPLIED));const second=applyOperationalCommand(first.data,command(C.TEMPLATE_APPLIED,{},1));expect(second.data.workFileCabinets[0].folders).toHaveLength(7);
  });
  it.each(['javascript:alert(1)','data:text/html,x','https://u:secret@example.org/x','/secret','/api/local-files/../../secret'])('rejeita endereço inseguro %s',url=>{expect(fileUrl(url)).toBeNull();expect(applyOperationalCommand(initial(),command(C.DOCUMENT_ADDED,{...document,url})).ok).toBe(false);});
  it('valida formato e tamanho dos uploads no reducer',()=>{
    for(const [fileName,size] of [['p.exe',4],['p.pdf',4*1024*1024],['p.pdf',0]])expect(applyOperationalCommand(initial(),command(C.DOCUMENT_ADDED,{...document,kind:'file',fileName,size})).ok).toBe(false);
    expect(fileValidation({name:'estrutura.ifc',size:500})).toBe('');
  });
  it('obriga acesso à aba e restringe a obra no servidor',()=>{
    expect(validateFileCabinetScope({user:actor,data:initial(),command:command(C.TEMPLATE_APPLIED)}).ok).toBe(true);
    expect(validateFileCabinetScope({user:actor,data:initial(),command:command(C.TEMPLATE_APPLIED,{obraId:'b'})}).ok).toBe(false);
    expect(validateFileCabinetScope({user:{...actor,accessTabs:['home']},data:initial(),command:command(C.TEMPLATE_APPLIED)}).ok).toBe(false);
    expect(validateFileCabinetScope({user:{...actor,role:'visualizador',accessTabs:['arquivos']},data:initial(),command:command(C.TEMPLATE_APPLIED)}).ok).toBe(false);
  });
  it('projeta somente os arquivos da obra autorizada',()=>{
    const data={...initial(),workFileCabinets:[{obraId:'a'},{obraId:'b'}]};
    expect(projectDataForUser(data,actor).workFileCabinets).toEqual([{obraId:'a'}]);
    expect(projectDataForUser(data,{...actor,accessTabs:['home']}).workFileCabinets).toBeUndefined();
  });
  it('reúne links de projetos sem duplicar registros ou misturar obras',()=>{
    const data={...initial(),engineeringProjects:[{id:'p',obraId:'a',links:[{id:'l',title:'Planta',url:'https://example.org/p.pdf'}]},{id:'p2',obraId:'b',links:[{id:'l2',url:'https://example.org/private.pdf'}]}]};
    const original=structuredClone(data),sources=sourceDocuments(data,'a');expect(sources).toHaveLength(1);expect(sources[0].readOnly).toBe(true);expect(data).toEqual(original);
  });
  it('inclui anexos do checklist de licenciamento e normaliza MIME pelo formato',()=>{
    const data={...initial(),licencas:[{id:'license',obraId:'a',itens:{art:{documentos:[{nome:'ART',url:'https://example.org/art.pdf'}]}}}]};
    expect(sourceDocuments(data,'a')[0]).toMatchObject({name:'ART',source:'Licenciamento',readOnly:true});
    expect(fileMime('documento.txt')).toBe('text/plain');expect(fileMime('projeto.dwg')).toBe('application/octet-stream');
  });
});
