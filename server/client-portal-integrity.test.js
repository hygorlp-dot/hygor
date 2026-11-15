import {it,expect} from 'vitest';
import {portalFixture} from './client-portal.fixture.js';
import {buildClientPortalPublicationRows,clientPortalProgress} from './client-portal-publication.js';
import {buildClientContractPosition} from './client-portal-contract.js';
const asOf='2026-11-14',publishedAt='2026-11-14T15:00:00Z';
const rows=data=>buildClientPortalPublicationRows({data,projectId:'obra-local',publishedAt});
it('não compensa o excedente de uma parcela contra outra nem esconde vencimento ausente',()=>{
 const data=portalFixture();data.medicoes=[
  {id:'excedente',obraId:'obra-local',valorPrevisto:100,recebimentos:[{id:'r',data:'2026-11-10',valor:150}]},
  {id:'pendente',obraId:'obra-local',valorPrevisto:100,recebimentos:[]},
 ];
 expect(rows(data).find(row=>row.domain==='financial_summary').payload.openAmount).toBe(100);
 expect(buildClientContractPosition({data,projectId:'obra-local',asOf}).payload.openInstallments).toMatchObject([{id:'pendente',balance:100,dueDate:''}]);
});
it('não antecipa competência futura sem data de emissão e não publica percentual de parcela fixa',()=>{
 const data=portalFixture();data.medicoes=[{id:'fixa',obraId:'obra-local',tipo:'mensal_fixo',competencia:'2026-11',valorPrevisto:100,percentualAcumulado:0},{id:'futura',obraId:'obra-local',tipo:'percentual',competencia:'2026-12',valorPrevisto:200,percentualAcumulado:80}];
 const result=rows(data);
 expect(result.filter(row=>row.domain==='measurement')).toHaveLength(1);
 expect(result.find(row=>row.domain==='measurement').payload.percentage).toBeNull();
});
it('o extrato não expõe anexos de nota marcada como rascunho',()=>{
 const data=portalFixture();data.notasFiscais[0].rascunho=true;
 expect(rows(data).find(row=>row.domain==='cash_movement'&&row.payload.id==='caixa-local').payload.invoiceDocuments).toEqual([]);
});
it('preserva o valor líquido zero e não o substitui pelo bruto',()=>{
 const data=portalFixture();data.notasFiscais[0].valorLiquido=0;
 expect(rows(data).find(row=>row.domain==='invoice').payload.netAmount).toBe(0);
});
it('distingue avanço desconhecido de zero confirmado e mantém casas decimais',()=>{
 expect(clientPortalProgress({data:{},obraId:'a'})).toMatchObject({value:null,source:'sem_dados'});
 expect(clientPortalProgress({data:{medicoesObra:[{obraId:'a',status:'aprovada',avancoFisico:0}]},obraId:'a'}).value).toBe(0);
 expect(clientPortalProgress({data:{medicoesObra:[{obraId:'a',status:'aprovada',avancoFisico:42.75}]},obraId:'a'}).value).toBe(42.75);
});
it('considera a data da medição técnica na posição de avanço atual',()=>{
 const data=portalFixture();data.medicoesObra[0].dataMedicao='2026-12-01';
 expect(rows(data).find(row=>row.domain==='project_summary').payload.progress).toBe(40);
});
it('não duplica registros com o mesmo ID nem escolhe entre duplicatas conflitantes',()=>{
 const data=portalFixture();data.caixaObra.push({...data.caixaObra[0]});
 data.medicoes.push(structuredClone(data.medicoes[0]));
 data.medicoes[0].recebimentos.push({...data.medicoes[0].recebimentos[0]});
 // Os dois espelhos da medição agora diferem: a origem deve ser conferida.
 expect(()=>rows(data)).toThrow('mesmo ID');
 data.medicoes.pop();
 const result=rows(data);
 expect(result.find(row=>row.domain==='cash_summary').payload.totalContributions).toBe(10000);
 expect(result.find(row=>row.domain==='financial_summary').payload.paid).toBe(2500);
 expect(result.filter(row=>row.domain==='payment')).toHaveLength(1);
 data.caixaObra.at(-1).valor=99999;expect(()=>rows(data)).toThrow('mesmo ID');
});
it('mantém os totais monetários em centavos sem resíduo de ponto flutuante',()=>{
 const data=portalFixture();data.caixaObra=[{id:'a',obraId:'obra-local',tipo:'aporte',data:asOf,valor:0.1},{id:'b',obraId:'obra-local',tipo:'aporte',data:asOf,valor:0.2}];
 expect(rows(data).find(row=>row.domain==='cash_summary').payload.balance).toBe(0.3);
});
