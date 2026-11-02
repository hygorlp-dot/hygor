// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { C } from "../../legacy/palette.js";
import { prazoObra } from "../obras/legacy-deadline.js";


//
export const COM_ETAPAS=[
  ["novo","Novo lead"],["primeiro_contato","Primeiro contato"],["qualificacao","Em qualificação"],["reuniao_agendada","Reunião agendada"],
  ["reuniao_realizada","Reunião realizada"],["aguardando_info","Aguardando informações"],["escopo","Escopo em elaboração"],
  ["proposta_elaboracao","Proposta em elaboração"],["proposta_enviada","Proposta enviada"],["negociacao","Em negociação"],
  ["aguardando_decisao","Aguardando decisão"],["contrato_elaboracao","Contrato em elaboração"],["contrato_enviado","Contrato enviado"],
  ["aguardando_assinatura","Aguardando assinatura"],["contrato_assinado","Contrato assinado"],["aguardando_entrada","Aguardando pagamento da entrada"],
  ["contratado","Contratado"],["transferido","Transferido para engenharia"],["perdido","Perdido"],["arquivado","Arquivado"],
];

export const COM_PERDAS=["Preço","Prazo","Falta de orçamento","Desistência","Contratação de concorrente","Falta de retorno","Serviço fora do escopo","Condições de pagamento","Outro"];

// JORNADA DO CLIENTE - Kanban de fases maiores. As 20 etapas granulares do
// funil mapeiam para 6 fases que contam a história do cliente: da chegada ao
// fechamento. Cada etapa pertence a uma fase; assim o lead anda pelo Kanban
// SOZINHO conforme o sistema muda sua etapa (proposta enviada, contrato
// assinado, etc.), sem ninguém arrastar. A ordem aqui é a ordem da jornada.
export const COM_JORNADA=[
  { id:"captura",    label:"Captura",       desc:"Lead chegou, primeiro contato", cor:C.blue,
    etapas:["novo","primeiro_contato"] },
  { id:"qualifica",  label:"Qualificação",  desc:"Entender necessidade e fit",    cor:C.purple,
    etapas:["qualificacao","aguardando_info"] },
  { id:"reuniao",    label:"Reunião",       desc:"Encontro e levantamento",       cor:C.orange,
    etapas:["reuniao_agendada","reuniao_realizada","escopo"] },
  { id:"proposta",   label:"Proposta",      desc:"Orçamento na mão do cliente",   cor:C.yellowD,
    etapas:["proposta_elaboracao","proposta_enviada","negociacao","aguardando_decisao"] },
  { id:"contrato",   label:"Contrato",      desc:"Fechamento e assinatura",       cor:C.green,
    etapas:["contrato_elaboracao","contrato_enviado","aguardando_assinatura","contrato_assinado","aguardando_entrada"] },
  { id:"ganho",      label:"Cliente",       desc:"Contratado e transferido",      cor:C.text,
    etapas:["contratado","transferido"] },
];

export const comFaseDaEtapa=etapa=>COM_JORNADA.find(f=>f.etapas.includes(etapa))?.id||null;


// ==============================================================
//  MOTOR DE INDICACAO
//  A ARCD vive de indicacao de cliente. Entao o que importa nao e
//  quantos leads entraram, e sim QUEM os trouxe e se o motor esta
//  girando. Estas funcoes respondem: quem indica, quanto isso rende,
//  se a carteira esta produzindo e onde o funil vaza.
// ==============================================================

// Quem indicou, quantos trouxe, quantos viraram contrato e quanto renderam.
// Aceita indicador cadastrado (clienteId) ou anotado a mao (nome livre).
export const rankingIndicadores = (com) => {
  const leads = com?.leads || [], vendas = com?.vendas || [], clientes = com?.clientes || [];
  const mapa = {};
  const chave = l => l.indicadoPorClienteId || (l.indicadoPorNome ? `nome:${l.indicadoPorNome}` : "");
  leads.forEach(l => {
    const k = chave(l);
    if (!k) return;
    if (!mapa[k]) mapa[k] = {
      chave: k, clienteId: l.indicadoPorClienteId || "",
      nome: l.indicadoPorClienteId
        ? (clientes.find(c => c.id === l.indicadoPorClienteId)?.nome || "Cliente")
        : l.indicadoPorNome,
      indicados: [], ganhos: 0, perdidos: 0, emAberto: 0, valorGerado: 0,
    };
    const r = mapa[k];
    r.indicados.push(l.id);
    const venda = vendas.find(v => v.leadId === l.id);
    if (venda) { r.ganhos++; r.valorGerado += Number(venda.valor || 0); }
    else if (l.status === "perdido" || l.etapa === "perdido") r.perdidos++;
    else r.emAberto++;
  });
  return Object.values(mapa).map(r => ({
    ...r, total: r.indicados.length,
    conversao: r.indicados.length ? (r.ganhos / r.indicados.length) * 100 : 0,
  })).sort((a, b) => b.valorGerado - a.valorGerado || b.total - a.total);
};


// O termometro do motor: quantas indicacoes cada obra entregue gerou e
// que fatia da carteira ja indicou alguem. Se cai, o lead cai daqui a meses.
export const taxaIndicacao = (com, obras) => {
  const entregues = (obras || []).filter(o => o.status === "done").length;
  const leads = com?.leads || [];
  const indicacoes = leads.filter(l => l.indicadoPorClienteId || l.indicadoPorNome).length;
  const clientesQueIndicaram = new Set(leads.map(l => l.indicadoPorClienteId).filter(Boolean)).size;
  const totalClientes = (com?.clientes || []).length;
  return {
    obrasEntregues: entregues, indicacoes,
    porObraEntregue: entregues ? indicacoes / entregues : 0,
    clientesQueIndicaram, totalClientes,
    pctClientesAtivos: totalClientes ? (clientesQueIndicaram / totalClientes) * 100 : 0,
  };
};


// NPS da entrega: 9-10 promotor, 7-8 neutro, 0-6 detrator.
// Promotor e candidato a indicar; detrator precisa de acao antes de falar mal.
export const npsResumo = (pesquisas) => {
  const ps = (pesquisas || []).filter(p => Number(p.nota) >= 0 && p.data);
  if (!ps.length) return { total: 0, promotores: 0, neutros: 0, detratores: 0, nps: null, media: 0 };
  const prom = ps.filter(p => p.nota >= 9).length;
  const neut = ps.filter(p => p.nota >= 7 && p.nota <= 8).length;
  const detr = ps.filter(p => p.nota <= 6).length;
  return {
    total: ps.length, promotores: prom, neutros: neut, detratores: detr,
    nps: ((prom - detr) / ps.length) * 100,
    // Number() é obrigatório aqui: o filtro acima só garante Number(p.nota)>=0,
    // p.nota em si pode chegar como string (formulário/planilha) - sem isto a
    // soma vira concatenação (achado de 25/08/2026, ver BLUEPRINT).
    media: ps.reduce((s, p) => s + Number(p.nota), 0) / ps.length,
  };
};


// Conversao agrupada por FASE da jornada (6 fases em vez de 20 etapas).
// Com o volume de leads de uma construtora de alto padrao, 20 barras nao
// dizem nada; 6 fases mostram na hora onde o negocio morre.
export const conversaoPorFase = (leads) => {
  const fases = COM_JORNADA;
  const ordemEtapa = {};
  fases.forEach((f, i) => f.etapas.forEach(e => { ordemEtapa[e] = i; }));
  const linhas = fases.map((f, i) => ({
    id: f.id, label: f.label, cor: f.cor,
    alcancaram: (leads || []).filter(l => {
      const base = (l.etapa === "perdido" || l.etapa === "arquivado")
        ? (l.etapaMaxima || l.etapa) : l.etapa;
      const oi = ordemEtapa[base];
      return oi != null && oi >= i;
    }).length,
  }));
  return linhas.map((l, i) => {
    const ant = i > 0 ? linhas[i-1].alcancaram : linhas[0].alcancaram;
    return { ...l,
      taxaDaAnterior: ant ? (l.alcancaram / ant) * 100 : 0,
      perdaNaFase: i > 0 ? ant - l.alcancaram : 0 };
  });
};


// Ciclo de venda: do primeiro contato ao contrato. Sem isso nao da para
// prever caixa nem saber se um lead de 90 dias ainda esta vivo.
export const cicloMedioVenda = (com) => {
  const leads = com?.leads || [], vendas = com?.vendas || [];
  const dias = [];
  vendas.forEach(v => {
    const l = leads.find(x => x.id === v.leadId);
    if (!l || !l.createdAt || !v.fechadaEm) return;
    const d = Math.floor((new Date(v.fechadaEm) - new Date(l.createdAt)) / 86400000);
    if (d >= 0) dias.push(d);
  });
  if (!dias.length) return { n: 0, medio: 0, minimo: 0, maximo: 0, mediana: 0 };
  const ord = [...dias].sort((a, b) => a - b);
  return { n: dias.length,
    medio: dias.reduce((s, d) => s + d, 0) / dias.length,
    minimo: ord[0], maximo: ord[ord.length-1], mediana: ord[Math.floor(ord.length/2)] };
};


// Momentos de pedir indicacao. Sao os tres picos de propensao: a entrega,
// o marco visivel da obra e o pos-obra. Devolve as acoes pendentes.
export const momentosIndicacao = (data) => {
  const com = data?.comercial || {};
  const acoes = [];
  (data?.obras || []).forEach(o => {
    const cliente = (com.clientes || []).find(c => c.obraId === o.id || c.nome === o.cliente);
    const pesquisa = (com.pesquisas || []).find(p => p.obraId === o.id);
    // 1) Obra entregue sem pesquisa de satisfacao
    if (o.status === "done" && !pesquisa) {
      acoes.push({ tipo:"nps", obraId:o.id, obraNome:o.name, clienteId:cliente?.id||"",
        clienteNome:cliente?.nome||o.cliente||"", titulo:"Pesquisa de satisfação na entrega",
        motivo:"Obra entregue e ainda sem nota do cliente." });
    }
    // 2) Promotor que ainda nao foi convidado a indicar
    if (pesquisa && pesquisa.nota >= 9 && !pesquisa.pediuIndicacao) {
      acoes.push({ tipo:"pedir", obraId:o.id, obraNome:o.name, clienteId:cliente?.id||"",
        clienteNome:cliente?.nome||o.cliente||"", titulo:"Pedir indicação ao cliente",
        motivo:`Deu nota ${pesquisa.nota} - é promotor e ainda não foi convidado a indicar.` });
    }
    // 3) Detrator: agir antes que ele fale mal
    if (pesquisa && pesquisa.nota <= 6) {
      acoes.push({ tipo:"recuperar", obraId:o.id, obraNome:o.name, clienteId:cliente?.id||"",
        clienteNome:cliente?.nome||o.cliente||"", titulo:"Recuperar cliente insatisfeito",
        motivo:`Deu nota ${pesquisa.nota}. Trate antes que vire indicação negativa.` });
    }
    // 4) Obra em andamento com progresso alto = marco visivel
    if (o.status === "active" && o.contractEnd && o.contractStart) {
      const prz = prazoObra(o);
      if (prz && prz.pct >= 60 && prz.pct < 100) {
        acoes.push({ tipo:"marco", obraId:o.id, obraNome:o.name, clienteId:cliente?.id||"",
          clienteNome:cliente?.nome||o.cliente||"", titulo:"Convidar para visita / pedir indicação",
          motivo:`Obra em ${prz.pct.toFixed(0)}% - fase de marco visível, bom momento para mostrar.` });
      }
    }
  });
  return acoes;
};

export const COM_TEMPERATURA={frio:C.blue,morno:C.orange,quente:C.red};

export const comEtapaLabel=id=>COM_ETAPAS.find(([v])=>v===id)?.[1]||id;

export const comDias=iso=>iso?Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/86400000)):0;

export const comDateTime=iso=>iso?new Date(iso).toLocaleString("pt-BR"):"-";

export const COM_IMOBILIARIO_SECTIONS=[
  {id:"overview",label:"Visão geral",icon:"chart"},
  {id:"developments",label:"Empreendimentos",icon:"building"},
  {id:"properties",label:"Imóveis avulsos",icon:"home"},
  {id:"units",label:"Unidades",icon:"grid"},
  {id:"reservations",label:"Reservas",icon:"clock"},
  {id:"sales",label:"Vendas",icon:"dollar"},
  {id:"visits",label:"Agenda e visitas",icon:"calendar"},
  {id:"brokers",label:"Corretores e parceiros",icon:"users"},
  {id:"documents",label:"Arquivos dos imóveis",icon:"file"},
  {id:"reports",label:"Relatórios",icon:"trending"},
];

export const COM_ROUTE_SECTION={com_funil:"crm",com_leads:"crm",com_propostas:"proposals",com_negociacoes:"proposals",com_metas:"commissions"};
