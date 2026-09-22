// @vitest-environment node
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {extrairProjetoEstrutural,aplicarQuantitativosEstruturais} from './structural-import';
import {extrairResumoAco} from './estrutural-pdf-extrator';
import {alturasReferenciaSapata,resumoSapatas,calcularSapataTipo} from './memoria-calculo-estrutural';
const foundation=readFileSync(new URL('./fixtures/foundation-extraction.txt',import.meta.url),'utf8');
const table=(name,volume='2.400',steel='310')=>`${name}\nElemento\nFôrmas\n(m2)\nSuperfície\n(m2)\nVolume\n(m3)\nBarras\n(kg)\nLajes de vigotas\n-\n90.38\n7.950\n164\nVigas\n120.58\n23.90\n12.090\n795\nPilares\n46.91\n-\n${volume}\n${steel}\nTotal`;
const steel=(kind,kg,bar='Ø10')=>`Resumo Aço\n${kind}\nComp. total\n(m)\nPeso+10%\n(kg)\n${bar}\n19.6\n${kg}\nTotal\n${kg}\nTotal`;

describe('importação estrutural conferida',()=>{
  it('extrai 19 sapatas, incluindo P19 depois das armaduras superiores da P18',()=>{
    const result=extrairProjetoEstrutural(foundation);
    expect(result.sapatas).toHaveLength(14);
    expect(result.sapatas.reduce((s,p)=>s+p.qtd,0)).toBe(19);
    expect(result.sapatas.find(s=>s.tipo==='P19')).toMatchObject({largura:2,comprimento:1.4,armaduraX:{quantidade:13,comprimento:2.11},armaduraY:{quantidade:19,comprimento:1.51}});
    const p18=result.sapatas.find(s=>s.tipo==='P18');
    expect(p18.armaduraX.comprimento).toBe(1.49);
    expect(p18.armaduraY.comprimento).toBe(.88);
    expect(p18.armadurasSuperiores.map(a=>a.comprimento)).toEqual([1.5,.92]);
    const totals=resumoSapatas(result.sapatas);
    expect(totals.totais.pesoAco).toBeGreaterThan(210);
    expect(totals.acoPorBitola.reduce((s,b)=>s+b.kg,0)).toBeCloseTo(totals.totais.pesoAco,8);
  });
  it('compara o aço da fundação somente com a folha da fundação',()=>{
    const result=extrairProjetoEstrutural(foundation+'\fPilares do Térreo\n'+steel('Pilares',213));
    expect(result.resumoAcoSapatas.totalKg).toBe(212);
  });
  it('extrai alturas e topo dos cortes e calcula o trecho inclinado',()=>{
    const p=extrairProjetoEstrutural(foundation).sapatas[0];
    expect(p).toMatchObject({alturasProjetoCm:'30 / 20',geometriaPendente:false,alturaBase:.2,alturaTronco:.1});
    expect(calcularSapataTipo(p).volumeSapataTotal).toBeCloseTo(.3391666666666667,10);
    expect(calcularSapataTipo({...p,volumeConferidoM3:.2,formaConferidaM2:1}).volumeSapataTotal).toBe(.4);
  });
  it('preserva aço de lajes sem fabricar bitolas e usa o quadro-resumo dos pilares',()=>{
    const r=extrairProjetoEstrutural(table('1º Pavimento'));
    expect(r.pilares.pavimento1[0].concretoUnit).toBe(2.4);
    expect(r.lajesAcoPorBitola.pavimento1).toEqual({totalKg:164,porBitola:[],semBitolas:true});
    expect(r.avisos.join(' ')).toContain('sem discriminação');
  });
  it('separa pilares de vigas em uma folha mista do reservatório',()=>{
    const r=extrairProjetoEstrutural(table('Reservatório','0.120','19')+'\n'+steel('Pilares',19,'CA-50 Ø10')+'\n'+steel('Desenho de vigas',48));
    expect(r.pilares.reservatorio[0].concretoUnit).toBe(.12);
    expect(r.pilaresAcoPorBitola.reservatorio.totalKg).toBe(19);
    expect(r.pilaresAcoPorBitola.reservatorio.porBitola[0].pesoKg).toBe(19);
    expect(r.vigasAcoPorBitola.reservatorio.totalKg).toBe(48);
  });
  it('lê o prefixo CA-50 junto da bitola sem perder peso',()=>{
    expect(extrairResumoAco(steel('Pilares',19,'CA-50 Ø10')).porBitola).toEqual([{bitola:'10',pesoKg:19}]);
  });
  it('preserva valores ausentes, aceita zero explícito e reimporta sem duplicar',()=>{
    const m={reservatorio:{viga:{formaM2:7.23},laje:{areaVigotaM2:7.38,acoTotalProjetoKg:8}}};
    const groups=[{pavimento:'Reservatório',concretoVigasM3:.74,formaVigasM2:null,volumeLajesM3:0,avisoConcretoIncorreto:true}];
    const next=aplicarQuantitativosEstruturais(m,groups);
    expect(next.reservatorio).toMatchObject({viga:{concretoM3:.74,formaM2:7.23,avisoConcretoIncorreto:true},laje:{volumeM3:0,areaVigotaM2:7.38,acoTotalProjetoKg:8}});
    expect(aplicarQuantitativosEstruturais(next,groups)).toEqual(next);
    expect(m.reservatorio.viga.concretoM3).toBeUndefined();
  });
});


describe('alturas de referência dos dados já importados',()=>{
  it.each([['30 / 20',.2,.1],['40 / 20',.2,.2],['35 / 20',.2,.15],['50 / 30',.3,.2]])('mostra base e trecho inclinado para %s, sem usar zeros legados',(cotas,base,inclinado)=>{
    const tipo={alturasProjetoCm:cotas,alturaBase:0,alturaTronco:0,geometriaPendente:true};
    expect(alturasReferenciaSapata(tipo)).toMatchObject({base,trechoInclinado:inclinado});
    expect(tipo.alturaBase).toBe(0);
    expect(tipo.geometriaPendente).toBe(true);
  });
  it.each(['','30 /','20 / 30','0 / 0','inválido'])('não fabrica alturas para referência inválida %s',alturasProjetoCm=>{
    expect(alturasReferenciaSapata({alturasProjetoCm})).toBeNull();
  });
});
