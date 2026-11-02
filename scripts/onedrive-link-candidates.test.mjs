import {it,expect} from 'vitest';
import {rankOriginalCandidate,proposedOriginalCorrection} from './onedrive-link-candidates.mjs';
const original={name:'invoice.JPEG',size:42,driveId:'D',itemId:'OLD'};
it('não confunde nome coincidente com conteúdo de tamanho diferente',()=>{
 expect(rankOriginalCandidate(original,{name:'invoice.jpeg',size:43})).toMatchObject({score:50,confidence:'manual-comparison'});
 expect(rankOriginalCandidate(original,{name:'other.jpeg',size:42}).score).toBe(30);
 expect(rankOriginalCandidate(original,{name:'other.jpeg',size:43})).toBeNull();
});
it('compara nome e identificadores sem alterar o ID local do anexo',()=>{
 expect(rankOriginalCandidate(original,{id:'old',driveId:'d',name:'renamed.jpeg'}).confidence).toBe('same-reference');
 expect(rankOriginalCandidate(original,{name:'invoice.jpeg',size:42}).score).toBe(100);
});
it('só prepara proposta com candidato forte verificado e único; nunca aplica',()=>{
 const candidate={score:100,contentVerified:true,id:'new',driveId:'D',path:'Obra/Compras/invoice.jpeg'};
 expect(proposedOriginalCorrection(original,[candidate])).toMatchObject({status:'ready-for-review',applied:false,proposed:{itemId:'new',requiresFreshSignedUrl:true}});
 expect(proposedOriginalCorrection(original,[candidate,{...candidate,id:'duplicate'}]).status).toBe('ambiguous');
 expect(proposedOriginalCorrection(original,[{...candidate,contentVerified:false}]).proposed).toBeNull();
});
it('preserva referência existente confirmada por ID, nome e tamanho, mesmo quando o leitor falha',()=>{
 const file={id:'old',driveId:'d',name:'invoice.jpeg',size:42};
 const candidate={...file,...rankOriginalCandidate(original,file),downloadStatus:404};
 expect(proposedOriginalCorrection(original,[candidate])).toMatchObject({status:'reference-confirmed',proposed:null,applied:false,recommendation:'repair-local-reader-and-retest'});
});
