import {it,expect} from 'vitest';
import {documentRegister} from './document-register.js';
it('valida URL e reconhece anexo vinculado à movimentação',()=>{
 const rows=documentRegister({notasFiscais:[{id:'n',status:'recebida',documentos:[{url:'https://'}]}]});
 expect(rows[0].issues).toContain('missing');
 const linked=documentRegister({notasFiscais:[{id:'n',status:'recebida'}],documentosMovimentacoes:[{movimentoId:'nota_fiscal:n',documentos:[{url:'https://example.com/nota.pdf'}]}]});
 expect(linked[0].issues).not.toContain('missing');
});
const note={id:'a',numero:'1',fornecedorNome:'Loja',valorBruto:100,emissao:'2026-10-01',obraId:'o',status:'recebida',chave:'123',documentos:[]};
it('detecta duplicidade fora do mês consultado e ignora registros cancelados',()=>{
 const data={notasFiscais:[note,{...note,id:'b',numero:'2',emissao:'2026-09-01'},{...note,id:'c',status:'cancelada'}]};
 const rows=documentRegister(data,{competence:'2026-10',obraId:'o'});
 expect(rows).toHaveLength(1);expect(rows[0].duplicates).toEqual(['2']);expect(rows[0].issues).toEqual(['review','missing','category','duplicate']);
});
it('não cria duplicidades por campos ausentes e mantém dados de origem',()=>{
 const data={notasFiscais:[{id:'a',status:'aprovada'},{id:'b',status:'aprovada'}]};const before=JSON.stringify(data);
 expect(documentRegister(data).every(r=>!r.issues.includes('duplicate'))).toBe(true);expect(JSON.stringify(data)).toBe(before);
});
it('respeita competência explícita, rateio e links válidos',()=>{
 const rows=documentRegister({notasFiscais:[{...note,competencia:'2026-09',obraId:'',rateios:[{obraId:'o'}],categoria:'material',documentos:[{url:'https://example.com/nf.pdf'}]}]},{competence:'2026-09',obraId:'o'});
 expect(rows).toHaveLength(1);expect(rows[0].issues).toEqual(['review']);expect(rows[0].entry.record.numero).toBe('1');
});
it('reconhece o arquivo protegido do provedor e rejeita links que a prévia não abre',()=>{
 const signed='/api/microsoft/onedrive?action=file&driveId=a&itemId=b&sig=c';
 const rows=documentRegister({notasFiscais:[{...note,documentos:[{url:signed}]},{...note,id:'invalid',documentos:[{url:'https://user:secret@example.com/nota.pdf'}]}]});
 expect(rows[0].issues).not.toContain('missing');expect(rows[1].issues).toContain('missing');
});
