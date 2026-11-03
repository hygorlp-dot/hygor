// Critério operacional de suspeita, não tolerância trabalhista. Nunca elimina
// evento, corrige seu tipo ou escolhe automaticamente qual marcação é válida.
export const JANELA_REPETICAO_MS=5*60_000;
export const AVISO_DUPLICIDADE='Possível batida duplicada. Confira no RH; as marcações originais foram preservadas e não formam jornada automaticamente.';
const tipos=new Set(['entrada','intervalo','retorno','saida']);
const dia=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'America/Recife'});

export function detectarDuplicidadesBatidas(events=[]) {
  const sorted=[...events].filter(e=>e?.marcadoEm&&(e.tipoRegistro||'ponto')==='ponto'&&Number.isFinite(Date.parse(e.marcadoEm)))
    .sort((a,b)=>Date.parse(a.marcadoEm)-Date.parse(b.marcadoEm));
  const anteriores=new Map(),duplicidades=[];
  for(const event of sorted){
    const obra=String(event.obraCapturaId||event.obraId||'');
    if(!obra)continue;
    const key=JSON.stringify([String(event.employeeId||''),dia(event.marcadoEm)]);
    const previous=anteriores.get(key);anteriores.set(key,event);
    if(!previous)continue;
    if(String(previous.obraCapturaId||previous.obraId||'')!==obra)continue;
    const sameId=String(event.eventId||event.id||'')&&String(event.eventId||event.id)===String(previous.eventId||previous.id);
    const distance=Date.parse(event.marcadoEm)-Date.parse(previous.marcadoEm);
    if(sameId&&distance===0)continue; // reentrega do mesmo fato, não nova batida
    const typed=tipos.has(event.tipoEvento),previousTyped=tipos.has(previous.tipoEvento);
    if((typed&&previousTyped&&event.tipoEvento===previous.tipoEvento)
      ||((!typed||!previousTyped)&&distance<=JANELA_REPETICAO_MS)){
      duplicidades.push({anterior:previous,repetida:event});
    }
  }
  return duplicidades;
}
