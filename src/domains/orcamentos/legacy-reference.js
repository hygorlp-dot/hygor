// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { referenceTotalOf } from "../compras/unit-conversion";
import { pedidoVivo } from "../compras/purchase-position";
import { statusPagamentoPedido } from "../compras/calculations";

// IndicadoresView nasceu fora de LegacyApp.jsx (não é extração, é tela
// nova) - achado "RH analytics" de docs/AUDITORIA_RH.md.
// A tela "Minhas aprovações pendentes" foi extraída para
// src/domains/aprovacoes/components/AprovacoesPendentesView.jsx em
// 2026-08-18, mesma técnica de extração das telas anteriores.
// A Central do Administrador (orquestrador de auditoria/usuários/aprovações)
// foi extraída para
// src/domains/administracao/components/CentralAdministradorView.jsx em
// 2026-08-16 - importada como `CentralAdministrador` acima, mesmo nome de
// sempre. GestaoUsuarios/GestaoAprovacoes continuam aqui (exportados),
// GestaoUsuarios também é usado pela tela Config.

//
// ORÇAMENTO - planilha orçamentária com base SINAPI / ORSE
//
//
// ARQUITETURA (importante):
// A base SINAPI oficial é persistida de forma normalizada no Supabase: preços
// de composições, insumos e relações analíticas. O orçamento recebe apenas um
// snapshot dos itens usados; assim, uma reimportação corrige o detalhamento
// sem reprecificar nem alterar o orçamento já aprovado.
//

export const ETAPAS_PADRAO = [
  "SERVIÇOS PRELIMINARES",
  "MOVIMENTO DE TERRA",
  "INFRAESTRUTURA / FUNDAÇÕES",
  "SUPRAESTRUTURA",
  "PAREDES E PAINÉIS",
  "COBERTURA",
  "IMPERMEABILIZAÇÃO",
  "INSTALAÇÕES HIDROSSANITÁRIAS",
  "INSTALAÇÕES ELÉTRICAS",
  "ESQUADRIAS",
  "REVESTIMENTOS DE PAREDE E TETO",
  "PISOS E PAVIMENTAÇÕES",
  "PINTURA",
  "LOUÇAS E METAIS",
  "SERVIÇOS COMPLEMENTARES",
  "LIMPEZA FINAL",
];


//
// BDI - Acórdão 2622/2013-TCU-Plenário
//
//
// Faixas referenciais de BDI por tipo de obra. O TCU não fixa um valor:
// fixa um INTERVALO (1º quartil  3º quartil). Adotar valor fora dele não
// é proibido, mas exige justificativa técnica no processo - é exatamente
// isso que a auditoria cobra.

// Faixas dos componentes para CONSTRUÇÃO DE EDIFÍCIOS (Acórdão 2622/2013).
// Servem de baliza no modo detalhado; os demais tipos de obra têm tabelas
// próprias - por isso o alerta de faixa usa sempre o BDI total, que é o que
// o TCU efetivamente audita.

// Fórmula do TCU:
//   BDI = [ (1+AC+S+R+G) x (1+DF) x (1+L) / (1  I) ]  1
// I = tributos incidentes sobre o faturamento (PIS + COFINS + ISS + CPRB)
// ==============================================================
//  CONFERENCIA DIMENSIONAL DO ORCAMENTO
//  Compara as quantidades de servicos por AREA com a area construida
//  da obra. Ex.: forro costuma ser ~area construida; se o orcamento
//  tem 300 m de forro numa obra de 200 m, ha 100 m de divergencia.
//  Roda LOCALMENTE (sem IA) - a IA so enriquece quando disponivel.
// ==============================================================

// Familias de servico por AREA e a relacao esperada com a area construida.
// fator: quanto o servico costuma medir em relacao a area construida.
//   1.0  = ~igual (forro, piso, contrapiso, laje, impermeab. de laje)
//   ~2.5 = paredes tem 2 faces e pe-direito (reboco, chapisco, pintura parede)
// tol: tolerancia (fracao) antes de virar alerta.
// RESPONSIVIDADE
//
//
// O app é estilizado inline, então media query pura não alcança os
// componentes. Este hook expõe o breakpoint ao React, permitindo trocar
// não só medidas, mas o próprio LAYOUT (barra inferior  sidebar).
//
// Usa matchMedia em vez de listener de resize: dispara só quando cruza o
// limite, e não a cada pixel arrastado.
// narrow = celulares pequenos (iPhone SE, Android de entrada). Abaixo de 420px
// não adianta encolher fonte: certos pares lado a lado precisam EMPILHAR.
export const MAX_NIVEL = 5;


//  CURVA ABC
//  Principio de Pareto aplicado a orcamento: poucos itens respondem pela maior
//  parte do custo. Ordena os itens por custo decrescente, acumula o percentual
//  e corta em faixas:
//    A - ate 80% do valor acumulado  (poucos itens, quase todo o dinheiro)
//    B - de 80% a 95%
//    C - o restante (muitos itens, pouco valor)
//  Itens repetidos (mesmo codigo em etapas diferentes) sao agrupados, senao a
//  curva mente: o mesmo servico apareceria varias vezes com valor fatiado.
export const CLASSE_ABC = { A:{ cor:"#C62828", limite:80 }, B:{ cor:"#EF6C00", limite:95 }, C:{ cor:"#2E7D32", limite:100 } };

export const SINAPI_UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];


// Visão executiva do orçamento por etapa de primeiro nível. Cada valor só é
// apropriado quando a origem aponta para uma linha real do orçamento; valores
// sem vínculo ficam separados para não produzirmos uma precisão fictícia.
// Usada tanto por OrcamentoView.jsx (extraído) quanto por ObraDetalhe, aqui
// mesmo - por isso não pode ficar só dentro de um dos dois.
export const calcControleCustosOrcamento = (data, orc) => {
  if(!orc)return{etapas:[],total:{},semApropriacao:{solicitado:0,comprometido:0,recebido:0,aplicado:0}};
  const etapas=orc.etapas||[];const etapaPorId=new Map(etapas.map(e=>[e.id,e]));
  const itemPorId=new Map((orc.itens||[]).filter(i=>i.tipo!=="titulo").map(i=>[i.id,i]));
  const raizDaEtapa=id=>{let e=etapaPorId.get(id),n=0;while(e?.parentId&&n++<30)e=etapaPorId.get(e.parentId)||e;return e;};
  const raizDoItem=id=>{const item=itemPorId.get(id);return item?raizDaEtapa(item.etapaId):null;};
  const raizVinculo=i=>etapaPorId.get(i?.orcNivel1Id)?raizDaEtapa(i.orcNivel1Id):raizDoItem(i?.orcItemId);
  const mapa=new Map();
  const linha=e=>{const id=e?.id||"sem_etapa";if(!mapa.has(id))mapa.set(id,{id,nome:e?.nome||"Sem etapa",ordem:Number(e?.ordem||0),orcado:0,solicitado:0,comprometido:0,recebido:0,aplicado:0,pago:0});return mapa.get(id);};
  itemPorId.forEach(item=>{linha(raizDaEtapa(item.etapaId)).orcado+=Number(item.quantidade||0)*Number(item.precoUnit||0);});
  const sem={solicitado:0,comprometido:0,recebido:0,aplicado:0};
  (data.solicitacoesCompra||[]).filter(s=>s.obraId===orc.obraId&&!['cancelada','rejeitada'].includes(s.status)).forEach(s=>(s.itens||[]).forEach(i=>{
    const valor=referenceTotalOf(i),raiz=raizVinculo(i);
    if(raiz)linha(raiz).solicitado+=valor;else sem.solicitado+=valor;
  }));
  const transacaoPorId=new Map((data.transacoes||[]).map(t=>[t.id,t]));
  (data.pedidos||[]).filter(p=>p.obraId===orc.obraId&&pedidoVivo(p)).forEach(p=>{
    const pago=statusPagamentoPedido(p)==="pago"||(!!p.transacaoId&&transacaoPorId.get(p.transacaoId)?.status==="conciliado");
    (p.itens||[]).forEach(i=>{const raiz=raizVinculo(i),total=Number(i.qtd||0)*Number(i.precoUnit||0),recebido=Number(i.qtdRecebida||0)*Number(i.precoUnit||0);
      if(raiz){const l=linha(raiz);l.comprometido+=total;l.recebido+=recebido;if(pago)l.pago+=total;}else{sem.comprometido+=total;sem.recebido+=recebido;}
    });
  });
  (data.movEstoque||[]).filter(m=>m.obraId===orc.obraId&&m.tipo==="consumo").forEach(m=>{const valor=Number(m.qtd||0)*Number(m.valorUnit||0),raiz=raizVinculo(m);if(raiz)linha(raiz).aplicado+=valor;else sem.aplicado+=valor;});
  const lista=[...mapa.values()].map(l=>({...l,saldo:l.orcado-l.comprometido,projecao:Math.max(l.orcado,l.comprometido),percentual:l.orcado?l.comprometido/l.orcado*100:0})).sort((a,b)=>a.ordem-b.ordem||a.nome.localeCompare(b.nome));
  const total=lista.reduce((a,l)=>{Object.keys(a).forEach(k=>a[k]+=Number(l[k]||0));return a;},{orcado:0,solicitado:0,comprometido:0,recebido:0,aplicado:0,pago:0,saldo:0,projecao:0});
  return{etapas:lista,total,semApropriacao:sem};
};
