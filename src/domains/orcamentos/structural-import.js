import { extrairGeometriaSapata } from "./sapata-geometria.js";
import {CHAVE_PAVIMENTO,extrairElementosEstruturais,extrairResumoAco,extrairSapatasFundacao} from './estrutural-pdf-extrator.js';

// O quadro de locação mede o pavimento; as caixas de detalhamento podem
// incluir trechos/arranques distintos. Preservamos ambos e a divergência.
export function extrairResumosPavimentos(texto){
  const result={};
  for(const [index,page] of String(texto||'').split('\f').entries()){
    const lines=page.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    for(let i=0;i<lines.length;i++){
      const pav=CHAVE_PAVIMENTO[lines[i]];
      if(!pav||lines[i+1]!=='Elemento'||!/^F[oô]rmas/.test(lines[i+2]||''))continue;
      const rows={pagina:index+1};
      for(let j=i+2;j<lines.length&&lines[j]!=='Total';j++){
        const kind={'Pilares':'pilar','Vigas':'viga','Lajes de vigotas':'laje'}[lines[j]];
        if(!kind)continue;
        const values=lines.slice(j+1,j+5);
        if(values.length!==4||values.some(v=>!/^(-|\d+(?:[.,]\d+)?)$/.test(v)))continue;
        const [formaM2,areaM2,concretoM3,acoKg]=values.map(v=>v==='-'?null:Number(v.replace(',','.')));
        rows[kind]={formaM2,areaM2,concretoM3,acoKg};
      }
      result[pav]=rows;
    }
  }
  return result;
}

export function extrairProjetoEstrutural(texto){
  const pages=String(texto||'').split('\f');
  const foundation=pages.filter(p=>/QUADRO DE ELEMENTOS DE FUNDA/i.test(p)).join('\f');
  const elementos=extrairElementosEstruturais(texto);
  const resumos=extrairResumosPavimentos(texto);
  const avisos=[];
  const sapatas=extrairSapatasFundacao(foundation).map(s=>{
    const geometriaProjeto=extrairGeometriaSapata(foundation,s);
    const total=s.alturaBase, borda=s.alturaTronco;
    return {...s, alturasProjetoCm:`${Math.round(total*100)} / ${Math.round(borda*100)}`,
      alturaBase:geometriaProjeto?borda:0, alturaTronco:geometriaProjeto?Math.round((total-borda)*1e8)/1e8:0,
      geometriaProjeto, geometriaPendente:!geometriaProjeto};
  });
  if(sapatas.some(s=>s.geometriaPendente))avisos.push('Fundação: não foi possível identificar os dois cortes de todas as sapatas no PDF. Geometrias não identificadas não são calculadas como zero medido.');
  for(const [pav,resumo] of Object.entries(resumos)){
    const detalhes=elementos.pilares[pav]||[];
    if(resumo.pilar){
      const volume=detalhes.reduce((s,p)=>s+p.concretoUnit*p.qtd,0);
      const forma=detalhes.reduce((s,p)=>s+p.formaUnit*p.qtd,0);
      const divergencia=detalhes.length&&(Math.abs(volume-resumo.pilar.concretoM3)>0.02||Math.abs(forma-resumo.pilar.formaM2)>0.02);
      if(divergencia)avisos.push(`${pav}: pilares usam o quadro-resumo da página ${resumo.pagina} (${resumo.pilar.concretoM3} m³ / ${resumo.pilar.formaM2} m²); detalhamentos somam ${volume.toFixed(2)} m³ / ${forma.toFixed(2)} m². Conferir o critério de medição.`);
      elementos.pilares[pav]=[{tipo:`Resumo da página ${resumo.pagina}`,qtd:1,concretoUnit:resumo.pilar.concretoM3,formaUnit:resumo.pilar.formaM2,acoUnit:resumo.pilar.acoKg}];
    }
    if(resumo.laje&&!elementos.lajesAcoPorBitola[pav]){
      elementos.lajesAcoPorBitola[pav]={porBitola:[],totalKg:resumo.laje.acoKg,semBitolas:true};
      avisos.push(`${pav}: ${resumo.laje.acoKg} kg de aço de laje no quadro-resumo, sem discriminação por bitola. Não somar novamente ao aço estimado das vigotas.`);
    }
  }
  // Folhas mistas (reservatório): isolar cada bloco antes de classificar.
  for(const page of pages){
    if(!/Reservatório\s+Elemento\s+F[oô]rmas/.test(page))continue;
    const blocks=page.split(/(?=Resumo A.o)/i).slice(1);
    for(const block of blocks){
      const resumo=extrairResumoAco(block);
      if(!resumo)continue;
      if(/^Resumo A.o\s+Pilares/i.test(block))elementos.pilaresAcoPorBitola.reservatorio=resumo;
      if(/^Resumo A.o\s+Desenho de vigas/i.test(block))elementos.vigasAcoPorBitola.reservatorio=resumo;
    }
  }
  for(const collection of ['pilares','pilaresAcoPorBitola','vigasAcoPorBitola','lajesAcoPorBitola']){
    elementos[collection].reservatorio??=collection==='pilares'?[]:null;
  }
  return {...elementos,sapatas,resumos,avisos,resumoAcoSapatas:extrairResumoAco(foundation)};
}

export function aplicarQuantitativosEstruturais(memoria,grupos){
  const nova={...memoria};
  for(const grupo of grupos){
    const pav=CHAVE_PAVIMENTO[grupo.pavimento];
    if(!pav)continue;
    const atual=nova[pav]||{};
    const viga={...atual.viga,avisoConcretoIncorreto:grupo.avisoConcretoIncorreto};
    const laje={...atual.laje};
    for(const [dest,src] of Object.entries({concretoM3:'concretoVigasM3',formaM2:'formaVigasM2',areaPlantaVigasM2:'areaPlantaVigasM2'})){
      if(grupo[src]!=null)viga[dest]=grupo[src];
    }
    for(const [dest,src] of Object.entries({volumeM3:'volumeLajesM3',volumeMacicasM3:'lajeMacicasM3',volumeVigotasM3:'lajeVigotasM3',areaMacicaM2:'areaMacicaLajeM2',areaVigotaM2:'areaVigotaLajeM2'})){
      if(grupo[src]!=null)laje[dest]=grupo[src];
    }
    nova[pav]={...atual,viga,laje};
  }
  return nova;
}
