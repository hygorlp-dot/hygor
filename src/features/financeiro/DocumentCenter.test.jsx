import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import DocumentCenter from './DocumentCenter.jsx';

it('busca cliente sem acentos e parcela na central, mantendo a identificação no memorial',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
 const data={obras:[{id:'o',name:'Obra de teste',cliente:'Cliente José'}],medicoes:[{id:'m',obraId:'o',descricao:'Medição',competencia:'2026-10',dataEmissao:'2026-10-01',numeroParcela:'PAR-42',valorPrevisto:100}]};
 let detail;const props={data,obraId:'o',competence:'2026-10',onViewChange:()=>{},onOpen:value=>{detail=value;}};
 try{
  for(const query of ['cliente jose','par-42']){
   act(()=>root.render(<DocumentCenter {...props} view={{query,filter:'all',selected:'medicao:m'}}/>));
   expect(el.querySelectorAll('article')).toHaveLength(1);expect(el.querySelector('aside').textContent).toContain('Cliente José');
  }
  act(()=>[...el.querySelectorAll('button')].find(b=>b.textContent==='Ver memorial').click());
  expect(detail.items[0]).toMatchObject({counterparty:'Cliente José',documentNumber:'PAR-42'});
 }finally{act(()=>root.unmount());el.remove();}
});

it('a conferência distingue link indisponível de arquivo protegido com o mesmo critério do registro',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
 const note={id:'n',obraId:'a',numero:'123',status:'recebida',emissao:'2026-10-01',valorBruto:100,documentos:[{url:'javascript:alert(1)'}]};
 const props={obraId:'a',competence:'2026-10',view:{query:'',filter:'all',selected:'nota_fiscal:n'},onViewChange:()=>{},onReview:()=>{},onOpen:()=>{}};
 try{
  act(()=>root.render(<DocumentCenter {...props} data={{notasFiscais:[note]}}/>));
  expect(el.querySelector('aside').textContent).toContain('Nenhum documento com link disponível.');expect(el.querySelector('aside a')).toBeNull();
  const url='/api/microsoft/onedrive?action=file&driveId=a&itemId=b&sig=c';
  act(()=>root.render(<DocumentCenter {...props} data={{notasFiscais:[{...note,documentos:[{url,nome:'Original'}]}]}}/>));
  expect(el.querySelector('aside a').getAttribute('href')).toBe(url);expect(el.querySelector('aside').textContent).not.toContain('Nenhum documento com link disponível.');
 }finally{act(()=>root.unmount());el.remove();}
});
