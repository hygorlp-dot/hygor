// Domínio puro de equipamentos. Não depende de React, DOM, API ou estilos.
// Pode ser testado e reutilizado por Engenharia, Financeiro e Compras.

export const PACOTES_TARIFA = [
  { id:"mes", label:"mês", dias:30 },
  { id:"quinzena", label:"quinzena", dias:15 },
  { id:"semana", label:"semana", dias:7 },
  { id:"dia", label:"dia", dias:1 },
];

export const melhorTarifa = (tarifas, dias) => {
  const n=Math.max(0,Math.floor(Number(dias)||0));
  const disponiveis=PACOTES_TARIFA
    .filter(p=>Number(tarifas?.[p.id]||0)>0)
    .map(p=>({...p,valor:Number(tarifas[p.id])}));
  if(n===0||disponiveis.length===0)return {total:0,composicao:[],semTarifa:disponiveis.length===0};
  const custos=new Array(n+1).fill(Infinity);
  const escolhas=new Array(n+1).fill(null);
  custos[0]=0;
  for(let i=1;i<=n;i++)for(const pacote of disponiveis){
    const restante=Math.max(0,i-pacote.dias);
    const candidato=pacote.valor+custos[restante];
    if(candidato<custos[i]){custos[i]=candidato;escolhas[i]=pacote;}
  }
  const quantidades={};
  let cursor=n;
  while(cursor>0&&escolhas[cursor]){
    const pacote=escolhas[cursor];
    quantidades[pacote.id]=(quantidades[pacote.id]||0)+1;
    cursor=Math.max(0,cursor-pacote.dias);
  }
  const composicao=PACOTES_TARIFA.filter(p=>quantidades[p.id]).map(p=>({
    tipo:p.id,label:p.label,qtd:quantidades[p.id],valorUnit:Number(tarifas[p.id]),
    subtotal:quantidades[p.id]*Number(tarifas[p.id]),
  }));
  return {total:custos[n],composicao,semTarifa:false};
};

export const textoComposicao = comp =>
  (comp||[]).map(c=>`${c.qtd} ${c.label}${c.qtd>1?(c.label==="mês"?"es":"s"):""}`).join(" + ")||"-";

export const tarifasDaLocacao = (loc,equip) => {
  const contrato=loc?.tarifas||{};
  if(PACOTES_TARIFA.some(p=>Number(contrato[p.id]||0)>0))return contrato;
  if(Number(loc?.valorDiaria||0)>0&&!equip?.tarifas)return {dia:Number(loc.valorDiaria)};
  return equip?.tarifas||(Number(loc?.valorDiaria||0)>0?{dia:Number(loc.valorDiaria)}:{});
};

export const tarifasCustoDaLocacao = (loc,equip) => {
  const contrato=loc?.tarifasCusto||{};
  if(PACOTES_TARIFA.some(p=>Number(contrato[p.id]||0)>0))return contrato;
  if(Number(loc?.custoDiaria||0)>0&&!equip?.tarifasCusto)return {dia:Number(loc.custoDiaria)};
  return equip?.tarifasCusto||(Number(loc?.custoDiaria||0)>0?{dia:Number(loc.custoDiaria)}:{});
};

export const cobrancaLocacao = (loc,equip,dias) => {
  const quantidade=Math.max(1,Number(loc?.quantidade||1));
  const unitario=melhorTarifa(tarifasDaLocacao(loc,equip),dias);
  const bruto=unitario.total*quantidade;
  const descontoPct=Number(loc?.descontoPct||0);
  const descontoValor=Number(loc?.descontoValor||0);
  const liquido=Math.max(0,bruto*(1-descontoPct/100)-descontoValor);
  return {quantidade,brutoUnitario:unitario.total,bruto,composicao:unitario.composicao,
    semTarifa:unitario.semTarifa,descontoPct,descontoValor,desconto:bruto-liquido,liquido};
};

export const unidadesEmUsoNoDia = (data,equipId,iso) =>
  (data.locacoesEquip||[])
    .filter(l=>l.equipamentoId===equipId&&l.inicio&&l.inicio<=iso&&(!l.fim||l.fim>=iso))
    .reduce((s,l)=>s+Math.max(1,Number(l.quantidade||1)),0);

export const disponibilidadeNoDia = (data,equip,iso) => {
  const total=Math.max(1,Number(equip?.quantidadeTotal||1));
  const emUso=unidadesEmUsoNoDia(data,equip.id,iso);
  return {total,emUso,livre:total-emUso,excedido:emUso>total};
};

export const picoUsoNoPeriodo = (data,equip,days) => {
  const total=Math.max(1,Number(equip?.quantidadeTotal||1));
  let pico=0,diasExcedidos=0;
  (days||[]).forEach(iso=>{
    const emUso=unidadesEmUsoNoDia(data,equip.id,iso);
    if(emUso>pico)pico=emUso;
    if(emUso>total)diasExcedidos++;
  });
  return {total,pico,livreNoPico:total-pico,excedido:pico>total,diasExcedidos};
};

export const diasLocacaoNoPeriodo = (loc,pi,pf) => {
  const inicio=loc.inicio?new Date(`${loc.inicio}T00:00:00`):null;
  if(!inicio)return 0;
  const fim=loc.fim?new Date(`${loc.fim}T00:00:00`):new Date(`${pf}T00:00:00`);
  const a=new Date(Math.max(inicio.getTime(),new Date(`${pi}T00:00:00`).getTime()));
  const b=new Date(Math.min(fim.getTime(),new Date(`${pf}T00:00:00`).getTime()));
  return b<a?0:Math.floor((b-a)/86400000)+1;
};

export const calcEquipMes = (data,equipId,ym) => {
  const [ano,mes]=ym.split("-").map(Number);
  const inicio=`${ym}-01`;
  const fim=`${ym}-${String(new Date(ano,mes,0).getDate()).padStart(2,"0")}`;
  const equip=(data.equipamentos||[]).find(e=>e.id===equipId);
  const locacoes=(data.locacoesEquip||[]).filter(l=>l.equipamentoId===equipId);
  let receita=0,custoDono=0,diasTotais=0,descontos=0;
  locacoes.forEach(locacao=>{
    const dias=diasLocacaoNoPeriodo(locacao,inicio,fim);
    if(!dias)return;
    diasTotais+=dias;
    const cobranca=cobrancaLocacao(locacao,equip,dias);
    receita+=cobranca.liquido;
    descontos+=cobranca.desconto;
    custoDono+=melhorTarifa(tarifasCustoDaLocacao(locacao,equip),dias).total;
  });
  const manut=(data.manutencoesEquip||[])
    .filter(m=>m.equipamentoId===equipId&&(m.data||"").slice(0,7)===ym&&m.pagoPor!=="proprietario")
    .reduce((s,m)=>s+Number(m.custo||0),0);
  const custo=custoDono+manut;
  return {receita,descontos,custoDono,manut,custo,lucro:receita-custo,diasTotais,locacoes:locacoes.length};
};
