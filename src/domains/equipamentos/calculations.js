// Domínio puro de equipamentos. Não depende de React, DOM, API ou estilos.
// Pode ser testado e reutilizado por Engenharia, Financeiro e Compras.
import { availabilityOnDate } from "./availability.js";

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
  const snapshot=loc?.commercialSnapshot?.tarifas;
  if(PACOTES_TARIFA.some(p=>Number(snapshot?.[p.id]||0)>0))return snapshot;
  const contrato=loc?.tarifas||{};
  if(PACOTES_TARIFA.some(p=>Number(contrato[p.id]||0)>0))return contrato;
  if(Number(loc?.valorDiaria||0)>0&&!equip?.tarifas)return {dia:Number(loc.valorDiaria)};
  return equip?.tarifas||(Number(loc?.valorDiaria||0)>0?{dia:Number(loc.valorDiaria)}:{});
};

export const tarifasCustoDaLocacao = (loc,equip) => {
  const snapshot=loc?.commercialSnapshot?.tarifasCusto;
  if(PACOTES_TARIFA.some(p=>Number(snapshot?.[p.id]||0)>0))return snapshot;
  const contrato=loc?.tarifasCusto||{};
  if(PACOTES_TARIFA.some(p=>Number(contrato[p.id]||0)>0))return contrato;
  if(Number(loc?.custoDiaria||0)>0&&!equip?.tarifasCusto)return {dia:Number(loc.custoDiaria)};
  return equip?.tarifasCusto
    ||(Number(loc?.custoDiaria||0)>0?{dia:Number(loc.custoDiaria)}:null)
    ||(Number(equip?.custoDiaria||0)>0?{dia:Number(equip.custoDiaria)}:{});
};

export const cobrancaLocacao = (loc,equip,dias) => {
  const quantidade=Math.max(1,Number(loc?.quantidade||1));
  const unitario=melhorTarifa(tarifasDaLocacao(loc,equip),dias);
  const brutoCentavos=Math.max(0,Math.round(unitario.total*quantidade*100));
  const bruto=brutoCentavos/100;
  const snapshot=loc?.commercialSnapshot;
  const descontoPct=Math.min(100,Math.max(0,Number(snapshot?.descontoPct??loc?.descontoPct??0)));
  const descontoPercentualCentavos=Math.round(brutoCentavos*descontoPct/100);
  const saldoAposPercentual=Math.max(0,brutoCentavos-descontoPercentualCentavos);
  const descontoFixoSolicitado=Math.max(0,Math.round(Number(snapshot?.descontoValor??loc?.descontoValor??0)*100));
  const descontoFixoCentavos=Math.min(saldoAposPercentual,descontoFixoSolicitado);
  const liquidoCentavos=saldoAposPercentual-descontoFixoCentavos;
  const liquido=liquidoCentavos/100;
  const desconto=(brutoCentavos-liquidoCentavos)/100;
  const descontoEfetivoPct=brutoCentavos>0?(brutoCentavos-liquidoCentavos)/brutoCentavos*100:0;
  return {quantidade,brutoUnitario:unitario.total,bruto,composicao:unitario.composicao,
    semTarifa:unitario.semTarifa,descontoPct,descontoValor:descontoFixoCentavos/100,
    desconto,liquido,descontoEfetivoPct,descontoElevado:descontoEfetivoPct>=20};
};

export const validateRentalDiscounts=(loc,equip,dias=30)=>{
  const percentual=Number(loc?.descontoPct||0),fixo=Number(loc?.descontoValor||0);
  if(!Number.isFinite(percentual)||percentual<0||percentual>100)return {ok:false,reason:"O desconto percentual deve estar entre 0% e 100%."};
  if(!Number.isFinite(fixo)||fixo<0)return {ok:false,reason:"O desconto fixo não pode ser negativo."};
  const base={...loc,descontoPct:0,descontoValor:0,commercialSnapshot:null};
  const bruto=cobrancaLocacao(base,equip,dias).bruto;
  const saldo=Math.max(0,Math.round(bruto*100)-Math.round(bruto*100*percentual/100))/100;
  if(fixo>saldo)return {ok:false,reason:`O desconto fixo não pode superar o saldo de R$ ${saldo.toFixed(2).replace(".",",")} após o desconto percentual.`};
  return {ok:true,bruto,saldo};
};

export const unidadesEmUsoNoDia = (data,equipId,iso) =>
  (data.locacoesEquip||[])
    .filter(l=>l.status!=="cancelada"&&l.equipamentoId===equipId&&l.inicio&&l.inicio<=iso&&(!l.fim||l.fim>=iso))
    .reduce((s,l)=>s+Math.max(1,Number(l.quantidade||1)),0);

export const disponibilidadeNoDia = (data,equip,iso) => {
  const availability=availabilityOnDate(data,equip,iso);
  const emUso=availability.total-availability.livre;
  return {total:availability.total,emUso,livre:availability.livre,excedido:emUso>availability.total,...availability};
};

export const picoUsoNoPeriodo = (data,equip,days) => {
  const total=Math.max(1,Number(equip?.quantidadeTotal||1));
  let pico=0,diasExcedidos=0;
  (days||[]).forEach(iso=>{
    const availability=availabilityOnDate(data,equip,iso);
    const emUso=availability.total-availability.livre;
    if(emUso>pico)pico=emUso;
    if(availability.exceeded||emUso>total)diasExcedidos++;
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
  const locacoes=(data.locacoesEquip||[])
    .filter(l=>l.equipamentoId===equipId&&l.status!=="cancelada");
  let receita=0,custoDono=0,diasContrato=0,unidadeDias=0,descontos=0,locacoesPeriodo=0;
  locacoes.forEach(locacao=>{
    const dias=diasLocacaoNoPeriodo(locacao,inicio,fim);
    if(!dias)return;
    locacoesPeriodo++;
    diasContrato+=dias;
    unidadeDias+=dias*Math.max(1,Number(locacao.quantidade||1));
    const cobranca=cobrancaLocacao(locacao,equip,dias);
    receita+=cobranca.liquido;
    descontos+=cobranca.desconto;
    // Tarifa de custo só é repasse quando existe proprietário terceiro. Em
    // equipamento próprio ela é referência interna e não gera obrigação -
    // mesma regra aplicada no motor do servidor (server/dre-projection.js).
    if (equip?.proprietarioId) {
      custoDono+=melhorTarifa(tarifasCustoDaLocacao(locacao,equip),dias).total
        *Math.max(1,Number(locacao.quantidade||1));
    }
  });
  const manut=(data.manutencoesEquip||[])
    .filter(m=>m.equipamentoId===equipId&&(m.data||"").slice(0,7)===ym&&m.pagoPor!=="proprietario")
    .reduce((s,m)=>s+Number(m.custo||0),0);
  const custo=custoDono+manut;
  return {receita,descontos,custoDono,manut,custo,lucro:receita-custo,
    diasContrato,unidadeDias,diasTotais:diasContrato,locacoes:locacoesPeriodo};
};

export const calcEquipamentosMes = (data,ym) => {
  const {inicio,fim}=limitesDoMes(ym);
  const rentalsInPeriod=(data?.locacoesEquip||[]).filter(locacao=>
    locacao?.status!=="cancelada"&&diasLocacaoNoPeriodo(locacao,inicio,fim)>0);
  const rentedIds=new Set(rentalsInPeriod.map(locacao=>locacao.equipamentoId).filter(Boolean));
  const registered=(data?.equipamentos||[]).filter(e=>e?.ativo!==false||rentedIds.has(e.id));
  const registeredIds=new Set(registered.map(e=>e.id));
  const missing=[...rentedIds].filter(id=>!registeredIds.has(id)).map(id=>({
    id,nome:"Equipamento sem cadastro",ativo:false,cadastroAusente:true,
  }));
  const equips=[...registered,...missing];
  const linhas=equips.map(e=>{
    const fin=calcEquipMes(data,e.id,ym);
    const proprio=!e.proprietarioId;
    return {equip:e,proprio,...fin};
  });
  const total=linhas.reduce((acc,line)=>({
    receita:acc.receita+line.receita,
    custoDono:acc.custoDono+line.custoDono,
    manut:acc.manut+line.manut,
    custo:acc.custo+line.custo,
    lucro:acc.lucro+line.lucro,
    descontos:acc.descontos+line.descontos,
  }),{receita:0,custoDono:0,manut:0,custo:0,lucro:0,descontos:0});
  return {
    linhas,
    total,
    proprios:linhas.filter(line=>line.proprio),
    terceiros:linhas.filter(line=>!line.proprio),
    lucroProprios:linhas.filter(line=>line.proprio).reduce((sum,line)=>sum+line.lucro,0),
    lucroTerceiros:linhas.filter(line=>!line.proprio).reduce((sum,line)=>sum+line.lucro,0),
    emManutencao:equips.filter(e=>e.status==="manutencao").length,
    locados:equips.filter(e=>e.status==="locado").length,
    disponiveis:equips.filter(e=>e.status==="disponivel").length,
  };
};

const limitesDoMes=ym=>{
  const [ano,mes]=String(ym||"").split("-").map(Number);
  return {
    inicio:`${ym}-01`,
    fim:`${ym}-${String(new Date(ano,mes,0).getDate()).padStart(2,"0")}`,
  };
};

const isoDiasEntre=(inicio,fim)=>{
  const dias=[];
  if(!inicio||!fim||fim<inicio)return dias;
  const cursor=new Date(`${inicio}T00:00:00Z`);
  const limite=new Date(`${fim}T00:00:00Z`);
  while(cursor<=limite){
    dias.push(cursor.toISOString().slice(0,10));
    cursor.setUTCDate(cursor.getUTCDate()+1);
  }
  return dias;
};

// Matriz de cobrança: uma linha por equipamento e uma coluna por obra. A
// célula preserva três medidas diferentes para não esconder lotes:
// - dias: dias de calendário em que o equipamento esteve na obra;
// - unidadeDias: soma diária das unidades alocadas (base auditável da cobrança);
// - quantidadePico: maior quantidade simultânea no período.
export const calcEquipamentosPorObra=(data,ym)=>{
  const {inicio,fim}=limitesDoMes(ym);
  const locacoes=(data?.locacoesEquip||[]).filter(locacao=>
    locacao?.status!=="cancelada"&&diasLocacaoNoPeriodo(locacao,inicio,fim)>0);
  const equipamentos=(data?.equipamentos||[]).filter(equipamento=>
    equipamento?.ativo!==false||locacoes.some(locacao=>locacao.equipamentoId===equipamento.id));
  const obraIdsMovimentadas=new Set(locacoes.map(locacao=>locacao.obraId).filter(Boolean));
  const obras=(data?.obras||[])
    .filter(obra=>obra?.status==="active"||obraIdsMovimentadas.has(obra.id))
    .sort((a,b)=>{
      const movimento=Number(obraIdsMovimentadas.has(b.id))-Number(obraIdsMovimentadas.has(a.id));
      return movimento||String(a.name||"").localeCompare(String(b.name||""));
    });

  const linhas=equipamentos.map(equipamento=>{
    const porObra={};
    obras.forEach(obra=>{
      const contratos=locacoes.filter(locacao=>
        locacao.equipamentoId===equipamento.id&&locacao.obraId===obra.id);
      const unidadesPorDia=new Map();
      const detalhes=[];
      let receita=0,custoDono=0,descontos=0;
      contratos.forEach(locacao=>{
        const dias=diasLocacaoNoPeriodo(locacao,inicio,fim);
        const quantidade=Math.max(1,Number(locacao.quantidade||1));
        const cobranca=cobrancaLocacao(locacao,equipamento,dias);
        const custoUnitario=melhorTarifa(tarifasCustoDaLocacao(locacao,equipamento),dias);
        // Mesma regra de calcEquipMes: repasse só existe com proprietário terceiro.
        const custoLocacao=equipamento?.proprietarioId?custoUnitario.total*quantidade:0;
        const primeiro=String(locacao.inicio||"")<inicio?inicio:String(locacao.inicio||"");
        const ultimo=!locacao.fim||String(locacao.fim)>fim?fim:String(locacao.fim);
        receita+=cobranca.liquido;
        descontos+=cobranca.desconto;
        custoDono+=custoLocacao;
        detalhes.push({
          locacaoId:locacao.id,
          obraId:locacao.obraId,
          equipmentLotId:locacao.equipmentLotId||"",
          equipmentUnitId:locacao.equipmentUnitId||"",
          equipmentUnitIds:[...(locacao.equipmentUnitIds||[])],
          inicio:primeiro,
          fim:ultimo,
          quantidade,
          dias,
          unidadeDias:dias*quantidade,
          bruto:cobranca.bruto,
          descontos:cobranca.desconto,
          descontoEfetivoPct:cobranca.descontoEfetivoPct,
          descontoElevado:cobranca.descontoElevado,
          receita:cobranca.liquido,
          custoDono:custoLocacao,
          lucro:cobranca.liquido-custoLocacao,
          composicao:cobranca.composicao,
          composicaoCusto:custoUnitario.composicao,
          semTarifa:cobranca.semTarifa,
          tarifaNegociada:locacao.tarifaNegociada===true,
          status:locacao.fim?"encerrada":"em_andamento",
          observacao:String(locacao.obs||""),
        });
        isoDiasEntre(primeiro,ultimo).forEach(iso=>
          unidadesPorDia.set(iso,(unidadesPorDia.get(iso)||0)+quantidade));
      });
      const quantidades=[...unidadesPorDia.values()];
      porObra[obra.id]={
        obraId:obra.id,
        dias:unidadesPorDia.size,
        unidadeDias:quantidades.reduce((s,q)=>s+q,0),
        quantidadePico:quantidades.length?Math.max(...quantidades):0,
        receita,custoDono,descontos,lucro:receita-custoDono,
        locacoes:contratos.length,
        detalhes,
      };
    });
    const total=Object.values(porObra).reduce((acc,celula)=>({
      dias:acc.dias+celula.dias,
      unidadeDias:acc.unidadeDias+celula.unidadeDias,
      receita:acc.receita+celula.receita,
      custoDono:acc.custoDono+celula.custoDono,
      descontos:acc.descontos+celula.descontos,
      lucro:acc.lucro+celula.lucro,
    }),{dias:0,unidadeDias:0,receita:0,custoDono:0,descontos:0,lucro:0});
    return {equip:equipamento,porObra,total};
  });
  const totaisPorObra=Object.fromEntries(obras.map(obra=>[
    obra.id,
    linhas.reduce((acc,linha)=>{
      const celula=linha.porObra[obra.id];
      acc.dias+=celula.dias;
      acc.unidadeDias+=celula.unidadeDias;
      acc.receita+=celula.receita;
      acc.custoDono+=celula.custoDono;
      acc.descontos+=celula.descontos;
      acc.lucro+=celula.lucro;
      return acc;
    },{dias:0,unidadeDias:0,receita:0,custoDono:0,descontos:0,lucro:0}),
  ]));
  return {
    inicio,fim,obras,linhas,
    totaisPorObra,
    total:linhas.reduce((acc,linha)=>({
      dias:acc.dias+linha.total.dias,
      unidadeDias:acc.unidadeDias+linha.total.unidadeDias,
      receita:acc.receita+linha.total.receita,
      custoDono:acc.custoDono+linha.total.custoDono,
      descontos:acc.descontos+linha.total.descontos,
      lucro:acc.lucro+linha.total.lucro,
    }),{dias:0,unidadeDias:0,receita:0,custoDono:0,descontos:0,lucro:0}),
  };
};

export const calcEquipCustoObra = (data,obraId,ym,periodStart="",periodEnd="") => {
  const [year,month]=ym.split("-").map(Number);
  const start=periodStart||`${ym}-01`;
  const end=periodEnd||`${ym}-${String(new Date(year,month,0).getDate()).padStart(2,"0")}`;
  return (data?.locacoesEquip||[])
    .filter(locacao=>locacao?.obraId===obraId&&locacao?.status!=="cancelada")
    .reduce((total,locacao)=>{
      const days=diasLocacaoNoPeriodo(locacao,start,end);
      if(!days)return total;
      const equipamento=(data?.equipamentos||[])
        .find(item=>item.id===locacao.equipamentoId);
      return total+cobrancaLocacao(locacao,equipamento,days).liquido;
    },0);
};

export const calcEquipFaturamentoEmpresa = (data,ym) => {
  const report=calcEquipamentosMes(data,ym);
  return {
    receita:report.total.receita,
    receitaBruta:report.total.receita+report.total.descontos,
    descontos:report.total.descontos,
    custoDono:report.total.custoDono,
    manut:report.total.manut,
    lucro:report.total.lucro,
    receitaProprios:report.proprios.reduce((sum,line)=>sum+line.receita,0),
    receitaTerceiros:report.terceiros.reduce((sum,line)=>sum+line.receita,0),
  };
};
