import { describe,it,expect,vi } from 'vitest';
import { binaryPreviewKind,loadPreviewResource } from './preview-resource.js';
import { licensingDocumentContext } from './licensing-documents.js';
import { sourceDocuments } from './source-documents.js';
const bytes=value=>new TextEncoder().encode(value);
describe('Consulta nativa de anexos',()=>{
  it('resolve referência protegida e lê PDF sem navegação externa',async()=>{
    const resolveFile=vi.fn(async()=>({ok:true,url:'/api/local-files/11111111-1111-4111-8111-111111111111'}));
    const fetchFile=vi.fn(async()=>new Response('%PDF-1.4\n',{headers:{'content-type':'application/pdf'}}));
    const resource=await loadPreviewResource({url:'/api/microsoft/onedrive?action=file&driveId=d&itemId=i'},{resolveFile,fetchFile});
    expect(resolveFile).toHaveBeenCalledWith({driveId:'d',itemId:'i'});expect(resource.kind).toBe('pdf');expect(fetchFile).toHaveBeenCalledOnce();
  });
  it('não lê bytes quando o acesso ao anexo é negado',async()=>{
    const fetchFile=vi.fn();await expect(loadPreviewResource({driveId:'d',itemId:'i'},{resolveFile:async()=>({ok:false,status:403,error:'Acesso negado'}),fetchFile})).rejects.toThrow('Acesso negado');expect(fetchFile).not.toHaveBeenCalled();
  });
  it('recusa HTML de login e mantém texto como texto',async()=>{
    await expect(loadPreviewResource({url:'https://example.org/file'},{fetchFile:async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})})).rejects.toThrow(/página de acesso/);
    expect(binaryPreviewKind(bytes('<script>x</script>'),'text/plain')).toBe('text');
    expect(binaryPreviewKind(bytes('<svg onload=x />'),'image/svg+xml')).toBe('unsupported');
  });
  it('classifica pelo conteúdo e recusa arquivo acima do limite antes de ler',async()=>{
    expect(binaryPreviewKind(bytes('%PDF-1.7'),'application/octet-stream')).toBe('pdf');
    await expect(loadPreviewResource({url:'https://example.org/a.pdf'},{fetchFile:async()=>new Response('x',{headers:{'content-length':String(30*1024*1024)}})})).rejects.toThrow(/25 MB/);
  });
  it('separa Prefeitura, Cartório e Condomínio conservando a etapa',()=>{
    expect(licensingDocumentContext({id:'l'},'titulo',{status:'entregue'})).toMatchObject({area:'cartorio',stage:'Título de propriedade',stageStatus:'entregue'});
    expect(licensingDocumentContext({id:'l'},'iptu')).toMatchObject({area:'prefeitura'});
    expect(licensingDocumentContext({id:'l',tipo:'terras_alpha_caruaru'},'cortes')).toMatchObject({area:'condominio'});
    expect(licensingDocumentContext({id:'l',tipo:'terras_alpha_caruaru'},'prefeitura_aprovada')).toMatchObject({area:'prefeitura'});
  });
  it('traz anexos reais do checklist com MIME e identificador estável, por obra',()=>{
    const data={obras:[{id:'a'}],licencas:[{id:'l',obraId:'a',itens:{titulo:{status:'entregue',documentos:[{id:'doc',nome:'Matrícula.pdf',tipo:'application/pdf',url:'https://example.org/a.pdf'}]}}},{id:'private',obraId:'b',itens:{titulo:{documentos:[{id:'other',url:'https://example.org/private.pdf'}]}}}]};
    const rows=sourceDocuments(data,'a');expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({id:'license:l:titulo:doc',area:'cartorio',readOnly:true,revisions:[{mime:'application/pdf',fileName:'Matrícula.pdf'}]});
    const before=rows[0].id;data.licencas[0].itens.taxa={documentos:[{id:'tax',url:'https://example.org/t.pdf'}]};expect(sourceDocuments(data,'a').find(item=>item.name==='Matrícula.pdf').id).toBe(before);
  });
});
