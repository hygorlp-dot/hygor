import {it,expect} from 'vitest';
import {documentEvidenceInfo,entryEvidenceDocuments,documentReadError} from './document-evidence.js';
it('reconhece referência protegida e identidade do provedor sem aceitar um endereço inseguro',()=>{
 expect(documentEvidenceInfo({url:'/api/microsoft/onedrive?action=file&driveId=d&itemId=i'})).toMatchObject({resolvable:true,reference:{driveId:'d',itemId:'i'}});
 expect(documentEvidenceInfo({driveId:'d',id:'i'}).resolvable).toBe(true);
 expect(documentEvidenceInfo({url:'javascript:alert(1)'}).resolvable).toBe(false);
 expect(documentEvidenceInfo({url:'https://login:password@example.test/file.pdf'}).resolvable).toBe(false);
});
it('distingue sessão, permissão, arquivo ausente, expiração e falha de prévia',()=>{
 expect([401,403,404,410,500].map(status=>documentReadError(status).code)).toEqual(['session','access','not_found','expired','preview']);
 expect(documentReadError(500,'access').code).toBe('access_unavailable');
});
it('mantém o comprovante do pagamento escolhido e exclui notas de outra obra',()=>{
 const a={nome:'Comprovante escolhido'},b={nome:'Outro pagamento'},c={nome:'Recebimento físico'};
 const docs=entryEvidenceDocuments({obraId:'a',effect:'cash_out',sourceSubId:'pg',record:{pagamentos:[{id:'pg',comprovantes:[a]},{id:'other',comprovantes:[b]}],itens:[{recebimentos:[{documentos:[c]}]}]},invoices:[{obraId:'b',documentos:[{nome:'Outra obra'}]}]});
 expect(docs).toEqual([a,c]);
});
it('não confunde a identidade de um rateio com a identidade de um pagamento',()=>{
 const documents=entryEvidenceDocuments({sourceType:'nota_fiscal',effect:'payable_increase',sourceSubId:'shared',record:{pagamentos:[{id:'shared',comprovantes:[{nome:'Primeiro'}]},{id:'other',comprovantes:[{nome:'Segundo'}]}]}});
 expect(documents.map(document=>document.nome)).toEqual(['Primeiro','Segundo']);
});
