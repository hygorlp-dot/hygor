import {expect,it} from 'vitest';
import {criarRegistroIdentidades} from '../../domains/conciliacao/identity.js';
import {assistedIdentityMatches,assistedDocuments,buildAssistedQueue,matchesAssistedQuery} from './assisted-review.js';

it('cruza documentos e nomes em fornecedores, funcionários e clientes, expondo conflitos',()=>{
 const registry=criarRegistroIdentidades({fornecedores:[{id:'f',nome:'JOÃO SILVA LTDA',cnpj:'12345678000199'}],employees:[{id:'e',name:'João Silva',cpf:'98765432100'}],comercial:{clientes:[{id:'c',nome:'João Silva',documento:'12345678901'}]}});
 const found=assistedIdentityMatches({contraparteNome:'Joao Silva',cpfCnpj:'12.345.678/0001-99'},registry);
 expect(found).toHaveLength(3);expect(found.find(p=>p.tipo==='fornecedor')).toMatchObject({nameMatch:true,documentMatch:true,documentConflict:false});
 expect(found.find(p=>p.tipo==='operario')).toMatchObject({nameMatch:true,documentMatch:false,documentConflict:true});expect(found.find(p=>p.tipo==='cliente')).toBeTruthy();
});
it('não trata CPF mascarado ou nome parcial como prova de identidade',()=>{
 const registry=criarRegistroIdentidades({employees:[{id:'e',name:'Ana Maria',cpf:'12345678901'}]});
 expect(assistedIdentityMatches({contraparteNome:'Ana',cpfCnpj:'***456789**'},registry)).toEqual([]);
 expect(assistedIdentityMatches({contraparteNome:'Ana Maria',cpfCnpj:'***456789**'},registry)[0]).toMatchObject({nameMatch:true,documentMatch:false,documentConflict:false});
});
it('busca CPF formatado e nomes com ou sem acento em todo o caso',()=>{
 const row={tr:{descricao:'João',cpfCnpj:'12345678901'},analise:{melhorCandidata:{titulo:'Destino'}},matches:[]};
 expect(matchesAssistedQuery(row,'123.456.789-01')).toBe(true);expect(matchesAssistedQuery(row,'joao')).toBe(true);expect(matchesAssistedQuery(row,'sem resultado')).toBe(false);
});
it('separa comprovantes bancários dos documentos do cadastro e não inventa documentos',()=>{
 const data={employees:[{id:'e',documentos:[{nome:'Cadastro.png',url:'https://example.test/cadastro.png'}]}]};
 const row={tr:{documentos:[{nome:'Banco.png',url:'https://example.test/banco.png'}]},analise:{melhorCandidata:{tipo:'funcionario',entidadeId:'e'}}};
 const original=JSON.stringify(data);expect(assistedDocuments(data,row)).toMatchObject({bank:[{nome:'Banco.png'}],target:[{nome:'Cadastro.png'}]});expect(JSON.stringify(data)).toBe(original);
 row.analise.melhorCandidata.entidadeId='ausente';expect(assistedDocuments(data,row).target).toEqual([]);
});
it('inclui somente pendentes ativos com candidato e sem automação elegível, sem alterar os registros',()=>{
 const data={fornecedores:[{id:'f',nome:'Loja',chavePix:'loja@pix'}],notasFiscais:[{id:'n',fornecedorId:'f',status:'aprovada',valorLiquido:300,vencimento:'2026-10-20',pagamentos:[]}],transacoes:[{id:'review',status:'pendente',data:'2026-10-20',valor:-150,chavePix:'loja@pix',fitid:'review'},{id:'archived',extratoId:'old',status:'pendente',data:'2026-10-20',valor:-150,chavePix:'loja@pix',fitid:'archived'},{id:'unknown',status:'pendente',data:'2026-10-20',valor:1}],extratos:[{id:'old',status:'arquivado'}]};
 const before=JSON.stringify(data);expect(buildAssistedQueue(data).map(row=>row.tr.id)).toEqual(['review']);expect(JSON.stringify(data)).toBe(before);
});
