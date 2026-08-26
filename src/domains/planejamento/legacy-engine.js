// ===================================================================
// Motor de cronograma LEGADO — extraído verbatim de src/LegacyApp.jsx
// (linhas 11197-12074) em 2026-08-26, como pré-requisito da Onda 2 do
// raio-X (docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): sem isto, o motor não
// podia ser importado fora de um ambiente de navegador/Vitest com mocks
// de UI, o que impedia qualquer verificação em lote no servidor.
//
// Mesmo corpo, mesma lógica - nenhum comportamento mudou nesta extração.
// Continua sendo o motor que desenha a tela de Planejamento hoje; o
// motor novo e testado (./calculations.js) só audita ao lado (ver
// PlanejamentoView.jsx e legacy-canonical-diff.js). Import circular com
// LegacyApp.jsx (para `today`/`fmtDate`) é o mesmo padrão já usado por
// PlanejamentoView.jsx - seguro porque nada aqui chama essas funções no
// topo do módulo, só dentro de corpos de função.
// ===================================================================

import { getActiveBudgetBaseline } from "../orcamentos/calculations.js";
import {
  buildBudgetTree as construirArvore,
  flattenBudgetTree as achatarArvore,
  budgetSubtreeIds as idsDaSubarvore,
} from "../orcamentos/tree.js";
import { today, fmtDate } from "../../LegacyApp.jsx";

export const diasCorridos = (ini, fim) => {
  if (!ini || !fim) return 0;
  const a = new Date(ini + "T00:00:00");
  const b = new Date(fim + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000));
};

// Soma dias a uma data ISO, devolve ISO.
export const somaDias = (iso, n) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Custo de uma etapa do orcamento = soma dos itens (SEM BDI: e custo, nao preco).
// Inclui itens de sub-etapas, para uma etapa-mae somar seus filhos.
export const custoEtapa = (orc, etapaId) => {
  if (!orc || !etapaId) return 0;
  const filhas = idsDaSubarvore(orc.etapas || [], etapaId); // inclui a propria
  return (orc.itens || [])
    .filter(it => it.tipo !== "titulo" && filhas.includes(it.etapaId))
    .reduce((s, it) => s + Number(it.quantidade || 0) * Number(it.precoUnit || 0), 0);
};

// A única fonte para custos/etapas de uma obra é a baseline explicitamente
// aprovada. Nunca escolha a última linha da lista: uma revisão em rascunho
// não pode mudar planejamento, medições, qualidade ou DRE por acidente.
export const orcamentoDaObra = (data, obraId) => getActiveBudgetBaseline(data, obraId, "controle").budget;


// Monta as tarefas efetivas do Gantt: cada tarefa do plano, enriquecida com
// nome e custo vindos da etapa do orcamento. A ordem visual e SEMPRE a mesma
// do orcamento; datas diferentes nao podem reordenar o planejamento.
export const ordemEtapasOrcamento = (orc) => {
  if (!orc) return [];
  const arvore = construirArvore(orc.etapas || [], orc.itens || []);
  return achatarArvore(arvore).filter(n => n.tipo === "etapa").map(n => n.id);
};

export const montarTarefas = (plano, orc) => {
  if (!plano) return [];
  const ordem = ordemEtapasOrcamento(orc);
  return (plano.tarefas || [])
    .map(t => {
      const etapa = (orc?.etapas || []).find(e => e.id === t.etapaId);
      // Nome: se ha etapa vinculada, ela manda - a menos que o usuario tenha
      // dado um nome proprio (diferente do default "Tarefa").
      const nomeCustom = t.nome && t.nome !== "Tarefa";
      return {
        ...t,
        nome:  nomeCustom ? t.nome : (etapa?.nome || t.nome || "Tarefa"),
        etapaNome: etapa?.nome || "",
        custo: t.etapaId ? custoEtapa(orc, t.etapaId) : 0,
        dias:  diasCorridos(t.inicio, t.fim),
        orfa:  !!t.etapaId && !etapa,  // aponta para etapa que nao existe mais
      };
    })
    .sort((a, b) => {
      const ia = ordem.indexOf(a.etapaId), ib = ordem.indexOf(b.etapaId);
      const oa = ia < 0 ? Number.MAX_SAFE_INTEGER : ia;
      const ob = ib < 0 ? Number.MAX_SAFE_INTEGER : ib;
      return oa - ob;
    });
};

// Janela de tempo do plano: menor inicio e maior fim entre tarefas e marcos.
// Devolve {ini, fim, dias}. Vazio se nao ha nada com data.
export const janelaPlano = (tarefas, marcos) => {
  const datas = [];
  (tarefas || []).forEach(t => { if (t.inicio) datas.push(t.inicio); if (t.fim) datas.push(t.fim); });
  (marcos  || []).forEach(m => { if (m.data)   datas.push(m.data); });
  if (!datas.length) return { ini: "", fim: "", dias: 0 };
  datas.sort();
  return { ini: datas[0], fim: datas[datas.length - 1], dias: diasCorridos(datas[0], datas[datas.length - 1]) };
};

// Resumo financeiro do plano: custo total planejado, custo ja concluido
// (ponderado pelo progresso de cada tarefa) e o previsto do orcamento.
export const resumoPlano = (tarefas, orc) => {
  const planejado = (tarefas || []).reduce((s, t) => s + (t.custo || 0), 0);
  const executado = (tarefas || []).reduce((s, t) => s + (t.custo || 0) * (t.progresso || 0) / 100, 0);
  const orcTotal  = (orc?.itens || [])
    .filter(it => it.tipo !== "titulo")
    .reduce((s, it) => s + Number(it.quantidade || 0) * Number(it.precoUnit || 0), 0);
  return {
    planejado, executado,
    orcTotal,
    // quanto do orcamento ja foi colocado em tarefas do cronograma
    coberto: orcTotal ? Math.min(100, (planejado / orcTotal) * 100) : 0,
  };
};

// Progresso geral do plano: media do progresso ponderada pela duracao.
// Uma tarefa de 30 dias pesa mais que uma de 2 dias.
export const progressoPlano = (tarefas) => {
  const t = (tarefas || []).filter(x => x.dias > 0);
  const totalDias = t.reduce((s, x) => s + x.dias, 0);
  if (!totalDias) return 0;
  return t.reduce((s, x) => s + x.dias * (x.progresso || 0), 0) / totalDias;
};

// ==============================================================
//  CALENDARIO DE TRABALHO
//  Converte duracao em DIAS UTEIS respeitando dias da semana
//  trabalhados e feriados. E a base da curva S e do fisico-financeiro:
//  o trabalho so "anda" em dia util.
// ==============================================================

// Um dia e util se: (a) o dia-da-semana esta na lista trabalhada e
// (b) nao e feriado (quando o plano pula feriados).
export const ehDiaUtil = (iso, cal) => {
  if (!iso) return false;
  const dow = new Date(iso + "T00:00:00").getDay();  // 0=dom..6=sab
  if (!(cal.diasSemana || [1,2,3,4,5,6]).includes(dow)) return false;
  if (cal.pularFeriados && (cal.feriados || []).some(f => f.data === iso)) return false;
  return true;
};

// Conta dias uteis no intervalo [ini, fim] INCLUSIVE.
export const diasUteis = (ini, fim, cal) => {
  if (!ini || !fim) return 0;
  let n = 0, cur = ini;
  let guard = 0;
  while (cur <= fim && guard < 3660) {
    if (ehDiaUtil(cur, cal)) n++;
    cur = somaDias(cur, 1);
    guard++;
  }
  return n;
};

// A partir de uma data, soma N dias UTEIS e devolve a data final.
// Ex.: comeca sexta, +1 dia util com seg-sex -> segunda.
export const somaDiasUteis = (ini, nUteis, cal) => {
  if (!ini || nUteis === 0) return ini;
  if (nUteis < 0) {
    let cur = ini, contados = 0, guard = 0;
    while (contados < Math.abs(nUteis) && guard < 3660) {
      cur = somaDias(cur, -1);
      if (ehDiaUtil(cur, cal)) contados++;
      guard++;
    }
    return cur;
  }
  let cur = ini, contados = 0, guard = 0;
  // O proprio dia de inicio conta como 1 util se for util.
  if (ehDiaUtil(cur, cal)) contados = 1;
  while (contados < nUteis && guard < 3660) {
    cur = somaDias(cur, 1);
    if (ehDiaUtil(cur, cal)) contados++;
    guard++;
  }
  return cur;
};

// Ajusta uma data para um dia trabalhado do calendario. E usado pela IA e
// pelo arraste do Gantt para que barras nao comecem em domingo/feriado.
export const ajustarParaDiaUtil = (iso, cal, direcao = 1) => {
  if (!iso) return "";
  let cur = iso, guard = 0;
  while (!ehDiaUtil(cur, cal) && guard < 3660) {
    cur = somaDias(cur, direcao >= 0 ? 1 : -1);
    guard++;
  }
  return cur;
};

export const proximoDiaUtil = (iso, cal) =>
  ajustarParaDiaUtil(somaDias(iso, 1), cal, 1);

// ==============================================================
//  IA - QUESTIONARIO DE PLANEJAMENTO
//  Monta o cronograma a partir das etapas do orcamento, aplicando
//  boas praticas de sequenciamento construtivo e respeitando o
//  prazo desejado pelo operador. Analise LOCAL e deterministica; a
//  IA opcional so comenta os riscos depois.
//
//  Sequencia construtiva padrao (ordem de execucao na obra):
//  servicos preliminares -> fundacao -> estrutura -> alvenaria ->
//  cobertura -> instalacoes -> revestimentos -> acabamentos ->
//  pintura -> limpeza. Cada etapa do orcamento e classificada numa
//  dessas fases pelo texto; o peso relativo distribui o prazo.
// ==============================================================

// Fases construtivas em ordem, com termos de reconhecimento e peso
// relativo de prazo (quanto tempo tende a consumir na obra).
const FASES_CONSTRUTIVAS = [
  { chave: "preliminares", ordem: 1,  peso: 0.5, termos: ["servico preliminar", "canteiro", "tapume", "locacao", "limpeza do terreno", "demolic", "terraplen", "movimento de terra"] },
  { chave: "fundacao",     ordem: 2,  peso: 1.2, termos: ["fundacao", "sapata", "estaca", "baldrame", "radier", "brocas", "viga baldrame"] },
  { chave: "estrutura",    ordem: 3,  peso: 1.6, termos: ["estrutura", "pilar", "viga", "laje", "concreto", "armadura", "forma", "escoramento"] },
  { chave: "alvenaria",    ordem: 4,  peso: 1.3, termos: ["alvenaria", "parede", "bloco", "tijolo", "vedacao"] },
  { chave: "cobertura",    ordem: 5,  peso: 0.9, termos: ["cobertura", "telhado", "telha", "madeiramento", "estrutura de telhado"] },
  { chave: "instalacoes",  ordem: 6,  peso: 1.2, termos: ["instalacao", "eletrica", "hidraulica", "hidrossanitaria", "tubulacao", "eletrodut", "esgoto", "agua fria", "ar condicionado", "spda"] },
  { chave: "revestimento", ordem: 7,  peso: 1.4, termos: ["revestimento", "reboco", "chapisco", "emboco", "contrapiso", "regularizacao", "impermeabiliz", "azulejo", "ceramica", "porcelanato", "piso"] },
  { chave: "esquadrias",   ordem: 8,  peso: 0.7, termos: ["esquadria", "porta", "janela", "batente", "ferragem", "vidro"] },
  { chave: "forro",        ordem: 9,  peso: 0.6, termos: ["forro", "gesso", "sanca", "teto"] },
  { chave: "pintura",      ordem: 10, peso: 0.9, termos: ["pintura", "massa corrida", "selador", "textura", "verniz"] },
  { chave: "acabamento",   ordem: 11, peso: 0.8, termos: ["acabamento", "louca", "metal", "bancada", "marcenaria", "soleira", "rodape", "peitoril"] },
  { chave: "limpeza",      ordem: 12, peso: 0.3, termos: ["limpeza final", "limpeza geral", "entrega", "vistoria final"] },
];

// Classifica uma etapa do orcamento numa fase construtiva.
const faseDaEtapa = (nome) => {
  const s = String(nome || "").toLowerCase();
  for (const f of FASES_CONSTRUTIVAS) {
    if (f.termos.some(t => s.includes(t))) return f;
  }
  return null;
};

// Matriz tecnica de precedencias. Ela nao altera a ordem visual do orcamento;
// apenas define quais servicos precisam estar liberados antes de outro iniciar.
const REQUISITOS_FASE = {
  fundacao:     ["preliminares"],
  estrutura:    ["fundacao"],
  alvenaria:    ["estrutura"],
  cobertura:    ["estrutura"],
  instalacoes:  ["alvenaria", "estrutura"],
  revestimento: ["instalacoes", "alvenaria"],
  esquadrias:   ["alvenaria"],
  forro:        ["instalacoes"],
  pintura:      ["revestimento", "forro"],
  acabamento:   ["pintura", "revestimento"],
  limpeza:      ["acabamento", "pintura"],
};

// Sugere antecessoras por boas praticas. Em modo sequencial, a antecessora e
// simplesmente a atividade anterior. Com paralelismo, atividades da mesma
// fase podem compartilhar os mesmos pre-requisitos e executar em conjunto.
export const sugerirDependenciasPlanejamento = (tarefas, orc, paralelo = true) => {
  const executaveis = (tarefas || []).filter(t =>
    !t.titulo && !(t.etapaId && etapaEhTitulo(orc, t.etapaId)));
  const classificadas = executaveis.map(t => ({...t, fase:faseDaEtapa(t.nome)?.chave || "outros"}));
  const resultado = {};
  (tarefas || []).forEach(t => { resultado[t.id] = []; });

  classificadas.forEach((t, i) => {
    if (i === 0) return;
    const anteriores = classificadas.slice(0, i);
    if (!paralelo) {
      resultado[t.id] = [anteriores[anteriores.length - 1].id];
      return;
    }
    const requisitos = REQUISITOS_FASE[t.fase] || [];
    const ids = requisitos.map(fase =>
      [...anteriores].reverse().find(a => a.fase === fase)?.id).filter(Boolean);
    // Etapa sem classificacao ou sem requisito encontrado permanece ligada a
    // anterior imediata para nao criar uma atividade solta sem justificativa.
    resultado[t.id] = [...new Set(ids.length ? ids : [anteriores[anteriores.length - 1].id])];
  });
  return resultado;
};

export const idsSucessoras = (tarefas, tarefaId) =>
  (tarefas || []).filter(t => (t.depende || []).includes(tarefaId)).map(t => t.id);


// Monta o cronograma a partir das respostas. Deterministico:
//  1) preserva a ordem do orcamento e classifica cada etapa apenas para estimar duracao;
//  2) distribui o prazo total proporcional ao peso de cada fase;
//  3) calcula inicio/fim de cada tarefa no calendario de trabalho;
//  4) se "paralelo=sim", sobrepoe parcialmente fases compativeis vizinhas.
// Devolve { tarefas:[{etapaId, nome, inicio, fim, progresso}], resumo, avisos }.
export const montarCronogramaIA = (orc, respostas, calBase) => {
  const todasEtapas = ordemEtapasOrcamento(orc)
    .map(id => (orc?.etapas || []).find(e => e.id === id)).filter(Boolean);
  if (!todasEtapas.length) return { tarefas: [], resumo: null, avisos: ["O orcamento nao tem etapas para planejar."] };
  // Titulos puros nao consomem prazo proprio: suas datas sao o roll-up dos
  // filhos. Distribuir dias para eles duplicava tempo e distorcia o limite.
  const etapas = todasEtapas.filter(e => !etapaEhTitulo(orc, e.id));

  const inicioInformado = respostas.inicio || today();
  const prazoMeses = Math.max(1, Number(respostas.prazoMeses || 6));
  const diasSemanaN = Number(respostas.diasSemana || 6);
  const diasSemana = diasSemanaN === 5 ? [1,2,3,4,5] : [1,2,3,4,5,6];
  const cal = { ...calBase, diasSemana };
  const inicio = ajustarParaDiaUtil(inicioInformado, cal, 1);
  const paralelo = respostas.paralelo === "sim";
  const ritmo = respostas.ritmo || "normal";

  // Classifica somente para ponderar duracoes. A posicao de cada etapa continua
  // exatamente igual a do orcamento, inclusive quando a boa pratica sugeriria
  // outra sequencia: a IA pode alertar, mas nao reordenar.
  const comFase = etapas.map((e, i) => {
    const fase = faseDaEtapa(e.nome);
    return { etapa: e, fase, ordem: fase ? fase.ordem : 99, peso: fase ? fase.peso : 1.0, idxOrig: i };
  });

  // O prazo e uma restricao, nao um multiplicador. Obtemos a data limite em
  // dias corridos e contamos exatamente os dias de trabalho dentro dela.
  const prazoAlvoDias = Math.max(1, Math.round(prazoMeses * 30));
  const fimAlvo = somaDias(inicioInformado, prazoAlvoDias - 1);
  const prazoDiasUteis = Math.max(1, diasUteis(inicio, fimAlvo, cal));

  // Distribui os dias uteis proporcional ao peso.
  const pesoTotal = comFase.reduce((s, c) => s + c.peso, 0);
  const avisos = [];

  // O ritmo define reserva sem autorizar estouro: normal ocupa a janela;
  // folgado guarda 10% para contingencia; apertado planeja 15% antes.
  const fatorUso = ritmo === "folgado" ? 0.90 : ritmo === "apertado" ? 0.85 : 1;
  const diasDistribuir = Math.max(comFase.length, Math.floor(prazoDiasUteis * fatorUso));
  comFase.forEach(c => {
    const exato = (c.peso / pesoTotal) * diasDistribuir;
    c.diasUteis = Math.max(1, Math.floor(exato));
    c.resto = exato - Math.floor(exato);
  });
  // Corrige o arredondamento para a soma coincidir com a janela planejada.
  let faltam = diasDistribuir - comFase.reduce((s, c) => s + c.diasUteis, 0);
  [...comFase].sort((a,b) => b.resto - a.resto).forEach(c => {
    if (faltam > 0) { c.diasUteis++; faltam--; }
  });

  // Encadeia as datas. Sem paralelismo: cada tarefa comeca quando a anterior
  // termina. Com paralelismo: fases da MESMA ordem (ex.: instalacoes que rodam
  // junto com revestimento) podem comecar com sobreposicao de ate 40%.
  const tarefas = [];
  let cursor = inicio;
  let fimAnterior = inicio;
  let ordemAnterior = 0;

  comFase.forEach((c, i) => {
    let ini = cursor;
    const faseAtual = c.fase?.chave || "outros";
    const faseAnterior = tarefas[i-1]?._fase || "outros";
    const exigeAnterior = (REQUISITOS_FASE[faseAtual] || []).includes(faseAnterior);
    if (paralelo && i > 0 && Math.abs(c.ordem - ordemAnterior) <= 1 && c.ordem !== 99 && !exigeAnterior) {
      // Sobrepoe 40%: comeca antes de a anterior terminar.
      const recuar = Math.round((tarefas[i-1]?._diasUteis || c.diasUteis) * 0.4);
      ini = somaDiasUteis(fimAnterior, -recuar, cal);
      if ((ini || "").localeCompare(inicio) < 0) ini = inicio;
    }
    const fim = somaDiasUteis(ini, c.diasUteis, cal);
    tarefas.push({
      etapaId: c.etapa.id,
      nome: c.etapa.nome,
      inicio: ini, fim, progresso: 0,
      _diasUteis: c.diasUteis, _fase: c.fase?.chave || "outros",
    });
    fimAnterior = fim;
    cursor = proximoDiaUtil(fim, cal);
    ordemAnterior = c.ordem;
  });

  // Avisos de boas praticas.
  const semFase = comFase.filter(c => !c.fase);
  if (semFase.length) {
    avisos.push(`${semFase.length} etapa(s) sem fase reconhecida mantiveram a posicao original - confira as duracoes: ${semFase.slice(0,3).map(c=>c.etapa.nome).join(", ")}${semFase.length>3?"...":""}.`);
  }
  const temFundacao = comFase.some(c => c.fase?.chave === "fundacao");
  const temEstrutura = comFase.some(c => c.fase?.chave === "estrutura");
  if (temEstrutura && !temFundacao) avisos.push("Ha estrutura mas nenhuma etapa de fundacao foi identificada - verifique.");
  if (paralelo) avisos.push("Servicos compativeis foram sobrepostos para ganhar prazo - garanta equipe suficiente para as frentes simultaneas.");
  if (inicio !== inicioInformado) avisos.push(`A data inicial caiu em dia nao trabalhado e foi ajustada para ${fmtDate(inicio)}.`);
  if (prazoDiasUteis < comFase.length && !paralelo) avisos.push("O prazo possui menos dias uteis que etapas; revise o prazo ou permita frentes paralelas.");
  if (cal.pularFeriados && (cal.feriados || []).length) avisos.push(`${(cal.feriados || []).filter(f => f.data >= inicio && f.data <= fimAlvo).length} feriado(s) da janela foram retirados dos dias de trabalho.`);

  // Recoloca os titulos na ordem original, com inicio/fim derivados de todas
  // as tarefas descendentes. Assim a ordem continua identica ao orcamento.
  const porEtapa = new Map(tarefas.map(t => [t.etapaId, t]));
  const tarefasOrdenadas = todasEtapas.map(e => {
    const efetiva = porEtapa.get(e.id);
    if (efetiva) return efetiva;
    const descendentes = idsDaSubarvore(orc.etapas || [], e.id).filter(id => id !== e.id);
    const filhas = tarefas.filter(t => descendentes.includes(t.etapaId));
    const ini = filhas.reduce((m,t) => !m || t.inicio < m ? t.inicio : m, inicio);
    const fim = filhas.reduce((m,t) => !m || t.fim > m ? t.fim : m, ini);
    return { etapaId:e.id, nome:e.nome, inicio:ini, fim, progresso:0, _diasUteis:0, _fase:"titulo" };
  });
  const fimObra = tarefasOrdenadas.reduce((m,t) => !m || t.fim > m ? t.fim : m, inicio);
  // Limpa campos internos.
  const tarefasLimpa = tarefasOrdenadas.map(({ _diasUteis, _fase, ...t }) => t);

  return {
    tarefas: tarefasLimpa,
    resumo: {
      inicio, fim: fimObra,
      diasCorridos: diasCorridos(inicio, fimObra),
      nEtapas: tarefasOrdenadas.length,
      diasSemana: diasSemanaN,
      dentroDoPrazo: fimObra <= fimAlvo,
      prazoAlvoDias,
      fimAlvo,
      diasUteisProjeto: diasUteis(inicio, fimObra, cal),
      diasUteisDisponiveis: prazoDiasUteis,
      feriadosConsiderados: cal.pularFeriados
        ? (cal.feriados || []).filter(f => f.data >= inicio && f.data <= fimAlvo).length
        : 0,
    },
    avisos,
    diasSemana,
    calendario: { diasSemana, pularFeriados: !!cal.pularFeriados, feriados: cal.feriados || [] },
  };
};

// ==============================================================
//  ROLL-UP DE TITULOS
//  Uma etapa-mae (so titulo, sem itens proprios) nao tem duracao
//  digitada: ela ABRANGE os filhos. Inicio = menor inicio dos filhos,
//  fim = maior fim. Progresso = media ponderada pelo custo dos filhos.
// ==============================================================

// Dado o orcamento, diz se uma etapa e "titulo puro": tem filhas E nao
// tem itens proprios com valor. Essas fazem roll-up.
const etapaEhTitulo = (orc, etapaId) => {
  const temFilhas = (orc?.etapas || []).some(e => e.parentId === etapaId);
  const temItens  = (orc?.itens || []).some(it =>
    it.etapaId === etapaId && it.tipo !== "titulo" &&
    (Number(it.quantidade || 0) * Number(it.precoUnit || 0)) > 0);
  return temFilhas && !temItens;
};

// Enriquece as tarefas com roll-up: tarefas-titulo recebem inicio/fim/progresso
// derivados de seus filhos (tarefas cujas etapas descendem dela).
export const aplicarRollup = (tarefas, orc) => {
  const etapaDe = {};
  (tarefas || []).forEach(t => { if (t.etapaId) etapaDe[t.etapaId] = t; });

  return (tarefas || []).map(t => {
    if (!t.etapaId || !etapaEhTitulo(orc, t.etapaId)) return t;
    // Acha as tarefas-filhas: etapas cujo ancestral e esta etapa.
    const descendentes = idsDaSubarvore(orc.etapas || [], t.etapaId)
      .filter(id => id !== t.etapaId);
    const filhas = (tarefas || []).filter(x => descendentes.includes(x.etapaId) && x.inicio && x.fim);
    if (!filhas.length) return t;
    const inicio = filhas.reduce((m, x) => !m || x.inicio < m ? x.inicio : m, "");
    const fim    = filhas.reduce((m, x) => !m || x.fim > m ? x.fim : m, "");
    const custoTotal = filhas.reduce((s, x) => s + (x.custo || 0), 0);
    const progresso = custoTotal
      ? filhas.reduce((s, x) => s + (x.custo || 0) * (x.progresso || 0), 0) / custoTotal
      : 0;
    return { ...t, inicio, fim, progresso: Math.round(progresso), titulo: true,
             custo: custoTotal, dias: diasCorridos(inicio, fim) };
  });
};

// ==============================================================
//  DISTRIBUICAO MENSAL (financeiro planejado por mes)
//  Espalha o custo de cada tarefa pelos seus dias uteis e soma por
//  mes-competencia. Tarefas-titulo sao ignoradas (senao dobra).
// ==============================================================
// ==============================================================
//  FISICO-FINANCEIRO MENSAL (por etapa × mes)
//  Distribui o custo de cada tarefa pelos meses em que ela ocorre
//  (rateio por dias uteis), montando a matriz etapa × mes que o
//  relatorio classico mostra: cada celula = valor + % da etapa
//  naquele mes; com coluna Total por etapa e linha Total do periodo.
// ==============================================================
export const fisicoFinanceiroMensal = (tarefas, cal, opts = {}) => {
  const usarReal = !!opts.realizado;   // false = previsto (plano), true = realizado
  const linhasBase = (tarefas || []).filter(t => {
    if (t.titulo) return false;
    const ini = usarReal && t.inicioReal ? t.inicioReal : t.inicio;
    const fim = usarReal && t.fimReal ? t.fimReal : t.fim;
    return ini && fim;
  });
  const mesesSet = new Set();

  const linhas = linhasBase.map(t => {
    const custoTarefa = usarReal
      ? (t.custoReal > 0 ? t.custoReal : (t.custo || 0) * (t.progresso || 0) / 100)
      : (t.custo || 0);
    // No modo realizado, se houver datas reais, distribui pelo período executado;
    // senão, cai no período planejado (melhor aproximação disponível).
    const ini = usarReal && t.inicioReal ? t.inicioReal : t.inicio;
    const fim = usarReal && t.fimReal ? t.fimReal : t.fim;
    const uteis = diasUteis(ini, fim, cal) || 1;
    const porDia = custoTarefa / uteis;
    const porMes = {};
    let cur = ini, guard = 0;
    while (cur <= fim && guard < 3660) {
      if (ehDiaUtil(cur, cal)) {
        const mes = cur.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + porDia;
        mesesSet.add(mes);
      }
      cur = somaDias(cur, 1);
      guard++;
    }
    const total = Object.values(porMes).reduce((s, v) => s + v, 0);
    return { id: t.id, nome: t.nome, nivel: t.nivel || 0, porMes, total };
  }).filter(l => l.total > 0);

  const meses = Array.from(mesesSet).sort();
  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
  // Total por mes (linha de rodape) e % de cada mes sobre o total do periodo.
  const totalPorMes = {};
  meses.forEach(m => { totalPorMes[m] = linhas.reduce((s, l) => s + (l.porMes[m] || 0), 0); });

  return { linhas, meses, totalPorMes, totalGeral };
};

export const distribuicaoMensal = (tarefas, cal) => {
  const porMes = {};
  (tarefas || []).forEach(t => {
    if (t.titulo || !t.inicio || !t.fim || !t.custo) return;
    const uteis = diasUteis(t.inicio, t.fim, cal) || 1;
    const porDia = t.custo / uteis;
    let cur = t.inicio, guard = 0;
    while (cur <= t.fim && guard < 3660) {
      if (ehDiaUtil(cur, cal)) {
        const mes = cur.slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + porDia;
      }
      cur = somaDias(cur, 1);
      guard++;
    }
  });
  // Ordena e acumula
  const meses = Object.keys(porMes).sort();
  let acc = 0;
  return meses.map(m => {
    acc += porMes[m];
    return { mes: m, valor: porMes[m], acumulado: acc };
  });
};

// ==============================================================
//  CURVA S (avanco fisico acumulado ao longo do tempo). A leitura semanal
//  evita que uma obra de poucos meses vire uma linha com apenas 3 ou 4 pontos.
//  O valor continua vindo da distribuicao por dias uteis; nenhum ponto e
//  interpolado para deixar o grafico "mais bonito".
// ==============================================================
export const curvaS = (tarefas, cal) => {
  const porSemana = {};
  const inicioSemana = iso => {
    const data = new Date(`${iso}T12:00:00`);
    data.setDate(data.getDate() - ((data.getDay() + 6) % 7));
    return data.toISOString().slice(0,10);
  };
  (tarefas || []).forEach(t => {
    if (t.titulo || !t.inicio || !t.fim || !t.custo) return;
    const uteis = diasUteis(t.inicio, t.fim, cal) || 1;
    const porDia = Number(t.custo || 0) / uteis;
    let cur = t.inicio, guard = 0;
    while (cur <= t.fim && guard < 3660) {
      if (ehDiaUtil(cur, cal)) {
        const semana = inicioSemana(cur);
        porSemana[semana] = (porSemana[semana] || 0) + porDia;
      }
      cur = somaDias(cur, 1); guard++;
    }
  });
  const periodos = Object.keys(porSemana).sort();
  const total = periodos.reduce((sum, semana) => sum + porSemana[semana], 0);
  if (!total) return [];
  let acumulado = 0;
  return periodos.map(semana => {
    const valor = porSemana[semana]; acumulado += valor;
    return { mes:semana, periodo:"semana", pctMes:(valor/total)*100, pctAcum:(acumulado/total)*100, valor, acumulado };
  });
};

// ==============================================================
//  FISICO-FINANCEIRO
//  Por tarefa: % fisico (progresso), custo previsto, custo realizado
//  (lancado ou estimado por progresso) e o desvio.
// ==============================================================
export const fisicoFinanceiro = (tarefas) => {
  const linhas = (tarefas || [])
    .filter(t => !t.titulo)
    .map(t => {
      const previsto = t.custo || 0;
      // Realizado: usa o lancado; se 0, estima pelo avanco fisico.
      const realizado = t.custoReal > 0 ? t.custoReal : previsto * (t.progresso || 0) / 100;
      const valorAgregado = previsto * (t.progresso || 0) / 100;  // EV
      return {
        id: t.id, nome: t.nome,
        pctFisico: t.progresso || 0,
        previsto, realizado, valorAgregado,
        desvio: valorAgregado - realizado,   // >0 = gastou menos que o avanco (bom)
      };
    });
  const tot = linhas.reduce((a, l) => ({
    previsto: a.previsto + l.previsto,
    realizado: a.realizado + l.realizado,
    valorAgregado: a.valorAgregado + l.valorAgregado,
  }), { previsto: 0, realizado: 0, valorAgregado: 0 });
  return {
    linhas,
    total: {
      ...tot,
      desvio: tot.valorAgregado - tot.realizado,
      pctFisico: tot.previsto ? (tot.valorAgregado / tot.previsto) * 100 : 0,
      // Indice de desempenho de custo (CPI): EV / custo real. >1 = eficiente.
      cpi: tot.realizado ? tot.valorAgregado / tot.realizado : 0,
      // Previsao de custo final (EAC) = orcado / CPI.
      previsaoFinal: tot.realizado && tot.valorAgregado
        ? tot.previsto / (tot.valorAgregado / tot.realizado)
        : tot.previsto,
    },
  };
};

// ==============================================================
//  CAMINHO CRITICO (CPM)
//  Passagem para frente (early start/finish) e para tras (late
//  start/finish) sobre o grafo de dependencias. Folga zero = critico.
//  Duracao em dias uteis. Tarefas-titulo ficam fora (sao agregadoras).
// ==============================================================
export const caminhoCritico = (tarefas, cal) => {
  const T = (tarefas || []).filter(t => !t.titulo && t.inicio && t.fim);
  if (!T.length) return { criticas: [], folgas: {} };
  const byId = {};
  T.forEach(t => { byId[t.id] = { ...t, dur: Math.max(1, diasUteis(t.inicio, t.fim, cal)) }; });

  // Ordena topologicamente (Kahn). Se houver ciclo, cai no que der.
  const indeg = {}; T.forEach(t => indeg[t.id] = 0);
  T.forEach(t => (t.depende || []).forEach(d => { if (byId[t.id]) indeg[t.id]++; }));
  const fila = T.filter(t => (t.depende || []).filter(d => byId[d]).length === 0).map(t => t.id);
  const ordem = [];
  const visto = new Set();
  while (fila.length) {
    const id = fila.shift();
    if (visto.has(id)) continue;
    visto.add(id); ordem.push(id);
    T.forEach(t => {
      if ((t.depende || []).includes(id)) {
        const pend = (t.depende || []).filter(d => byId[d] && !visto.has(d)).length;
        if (pend === 0 && !visto.has(t.id)) fila.push(t.id);
      }
    });
  }
  T.forEach(t => { if (!ordem.includes(t.id)) ordem.push(t.id); });  // sobras (ciclo)

  // Forward: ES/EF em dias uteis relativos.
  const ES = {}, EF = {};
  ordem.forEach(id => {
    const preds = (byId[id].depende || []).filter(d => byId[d]);
    ES[id] = preds.length ? Math.max(...preds.map(d => EF[d])) : 0;
    EF[id] = ES[id] + byId[id].dur;
  });
  const fimProjeto = Math.max(...Object.values(EF), 0);

  // Backward: LS/LF.
  const LS = {}, LF = {};
  [...ordem].reverse().forEach(id => {
    const sucs = T.filter(t => (t.depende || []).includes(id)).map(t => t.id);
    LF[id] = sucs.length ? Math.min(...sucs.map(s => LS[s])) : fimProjeto;
    LS[id] = LF[id] - byId[id].dur;
  });

  const folgas = {};
  const criticas = [];
  ordem.forEach(id => {
    const folga = LS[id] - ES[id];
    folgas[id] = folga;
    if (folga <= 0) criticas.push(id);
  });
  return { criticas, folgas, fimProjeto, ES, EF, LS, LF };
};

// ==============================================================
//  MEDICAO DE EVOLUCAO DE OBRA
//  Deriva o avanco fisico das tarefas a partir dos RDOs. O ultimo
//  progresso lancado para cada tarefa (por data) e o que vale.
//  Conta tambem os dias efetivamente trabalhados por servico.
// ==============================================================

// Progresso mais recente por tarefa, a partir dos RDOs de uma obra.
// Devolve { tarefaId: { progresso, ultimaData, diasTrabalhados } }.
const evolucaoPorRDO = (rdos, obraId) => {
  const porTarefa = {};
  const ordenados = (rdos || [])
    .filter(r => r.obraId === obraId && r.data)
    .sort((a, b) => a.data.localeCompare(b.data));

  ordenados.forEach(r => {
    (r.servicos || []).forEach(s => {
      const chave = s.tarefaId || s.etapaId;
      if (!chave) return;
      if (!porTarefa[chave]) porTarefa[chave] = {
        progresso: 0, ultimaData: "", atualizadoEm: "", dias: new Set(), rdoId: "",
      };

      // A medicao e uma informacao unica, editavel em qualquer tela. Para saber
      // qual valor prevalece, guardamos o instante da ultima alteracao. Registros
      // antigos, sem timestamp, usam o inicio da data do RDO como compatibilidade.
      const atualizadoEm = s.atualizadoEm || `${r.data}T00:00:00.000Z`;
      if (!porTarefa[chave].atualizadoEm || atualizadoEm >= porTarefa[chave].atualizadoEm) {
        porTarefa[chave].progresso = Math.max(0, Math.min(100, Number(s.progressoAte) || 0));
        porTarefa[chave].ultimaData = r.data;
        porTarefa[chave].atualizadoEm = atualizadoEm;
        porTarefa[chave].rdoId = r.id || "";
      }
      // Cada dia com este servico no RDO conta como um dia trabalhado nele.
      porTarefa[chave].dias.add(r.data);
    });
  });

  // Converte Set -> contagem.
  const out = {};
  Object.keys(porTarefa).forEach(k => {
    out[k] = {
      progresso: porTarefa[k].progresso,
      ultimaData: porTarefa[k].ultimaData,
      atualizadoEm: porTarefa[k].atualizadoEm,
      rdoId: porTarefa[k].rdoId,
      diasTrabalhados: porTarefa[k].dias.size,
    };
  });
  return out;
};

// Funde a evolucao dos RDOs nas tarefas do plano. A tarefa passa a mostrar
// o progresso vindo do diario (quando ha), senao mantem o manual.
// origem: "diario" quando o RDO mandou, "manual" quando nao.
// Compara a linha de base com as datas reais quando cadastradas. Para planos
// antigos, que ainda nao possuem inicio/fim real, usa a programacao atual como
// previsao de realizacao. O termino prevalece; se ele nao mudou, o inicio define
// se houve antecipacao ou atraso na mobilizacao da atividade.
export const compararBaseline = (tarefas, plano) => {
  const base = {};
  (plano?.baseline || []).forEach(b => { base[b.tarefaId] = b; });
  if (!Object.keys(base).length) return { temBaseline: false, linhas: [], resumo: null };
  const linhas = (tarefas || []).filter(t => !t.titulo && base[t.id]).map(t => {
    const b = base[t.id];
    const comparadoIni = t.inicioReal || t.inicio || "";
    const comparadoFim = t.fimReal || t.fim || "";
    const desvIni = b.inicio && comparadoIni ? diasCorridos(b.inicio, comparadoIni) : null;
    const desvFimComparado = b.fim && comparadoFim ? diasCorridos(b.fim, comparadoFim) : null;
    const desvioPrazo = desvFimComparado != null && desvFimComparado !== 0
      ? desvFimComparado
      : desvIni != null ? desvIni : desvFimComparado;
    const situacao = desvioPrazo == null ? "sem-realizado"
      : desvioPrazo > 0 ? "atrasada"
      : desvioPrazo < 0 ? "adiantada"
      : "no-prazo";
    const custoAtual = t.custoReal > 0 ? t.custoReal : (t.custo || 0);
    const desvCusto = custoAtual - (b.custo || 0);
    return {
      id: t.id, nome: t.nome,
      baseIni: b.inicio, baseFim: b.fim, baseCusto: b.custo || 0,
      atualIni: t.inicio, atualFim: t.fim, atualCusto: custoAtual,
      realIni: t.inicioReal || "", realFim: t.fimReal || "",
      comparadoIni, comparadoFim,
      fonteIni: t.inicioReal ? "real" : t.inicio ? "atual" : "",
      fonteFim: t.fimReal ? "real" : t.fim ? "atual" : "",
      progresso: t.progresso || 0,
      desvIni, desvFim: desvioPrazo, desvCusto, situacao,
    };
  });
  const resumo = {
    piorAtraso: linhas.reduce((m, l) => Math.max(m, Number(l.desvFim || 0)), 0),
    atrasadas: linhas.filter(l => l.situacao === "atrasada").length,
    adiantadas: linhas.filter(l => l.situacao === "adiantada").length,
    noPrazo: linhas.filter(l => l.situacao === "no-prazo").length,
    semRealizado: linhas.filter(l => l.situacao === "sem-realizado").length,
    desvioCustoTotal: linhas.reduce((s, l) => s + l.desvCusto, 0),
    custoBase: linhas.reduce((s, l) => s + l.baseCusto, 0),
    custoAtual: linhas.reduce((s, l) => s + l.atualCusto, 0),
  };
  return { temBaseline: true, linhas, resumo };
};

// ══════════════════════════════════════════════════════════════════
//  PLANEJADO x REALIZADO AUTOMATICO (por progresso medido)
//
//  O comparativo por linha de base so enxerga DATAS digitadas - se ninguem
//  replaneja, tudo parece "no prazo" mesmo com a medicao parada. Este motor
//  nao depende de digitacao: cruza o progresso MEDIDO (medicao / diario /
//  manual, ja fundido nas tarefas) com a reta do cronograma.
//
//  A conta: a tarefa deveria avancar linearmente entre inicio e fim. O
//  progresso medido corresponde a um ponto dessa reta - a "data equivalente"
//  (o dia em que o plano previa chegar ao que foi medido). O desvio em dias
//  e a distancia de hoje ate esse ponto:
//    + dias -> ATRASADA  (hoje ja passou do ponto onde a obra chegou)
//    - dias -> ADIANTADA (a obra chegou onde o plano so previa mais adiante)
// ══════════════════════════════════════════════════════════════════
const difDiasAssinada = (a, b) => {
  if (!a || !b) return 0;
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
};

const desvioTarefaAuto = (t, hoje) => {
  if (!t.inicio || !t.fim) return { situacao: "sem-datas", desvio: null, pctPrevisto: null, pctMedido: Number(t.progresso || 0), dataEquivalente: "" };
  const dur = diasCorridos(t.inicio, t.fim) + 1;   // duracao em dias corridos, inclusiva
  const prog = Math.max(0, Math.min(100, Number(t.progresso || 0)));

  // % que o plano previa ate hoje (reta inicio -> fim)
  const pctPrevisto = hoje < t.inicio ? 0
    : hoje > t.fim ? 100
    : Math.min(100, ((diasCorridos(t.inicio, hoje) + 1) / dur) * 100);

  // Concluida: o desvio e a diferenca entre o fim planejado e o fim efetivo.
  // Sem data real, a ultima medicao serve de melhor evidencia; sem nada,
  // assume conclusao dentro do prazo (hoje, se ainda antes do fim).
  if (prog >= 100) {
    const fimEfetivo = t.fimReal || t.ultimaMedicao || (hoje < t.fim ? hoje : t.fim);
    const desvio = difDiasAssinada(t.fim, fimEfetivo);
    return {
      situacao: desvio > 0 ? "atrasada" : desvio < 0 ? "adiantada" : "no-prazo",
      concluida: true, desvio, pctPrevisto, pctMedido: 100, dataEquivalente: t.fim,
    };
  }

  // Nao iniciada: antes do inicio e futura; depois, cada dia sem medir e atraso.
  if (prog <= 0) {
    if (hoje < t.inicio) return { situacao: "futura", desvio: 0, pctPrevisto, pctMedido: 0, dataEquivalente: "" };
    const desvio = difDiasAssinada(t.inicio, hoje);
    return { situacao: desvio > 0 ? "atrasada" : "no-prazo", desvio, pctPrevisto, pctMedido: 0, dataEquivalente: t.inicio };
  }

  // Em andamento: acha o dia em que o plano previa chegar ao % medido.
  const diasEquivalentes = Math.max(1, Math.round((prog / 100) * dur));
  const dataEquivalente = somaDias(t.inicio, diasEquivalentes - 1);
  const desvio = difDiasAssinada(dataEquivalente, hoje);
  return {
    situacao: desvio > 0 ? "atrasada" : desvio < 0 ? "adiantada" : "no-prazo",
    concluida: false, desvio, pctPrevisto, pctMedido: prog, dataEquivalente,
  };
};

export const desvioAutomatico = (tarefas, hoje) => {
  const linhas = (tarefas || []).map(t => ({
    id: t.id, nome: t.nome, titulo: !!t.titulo, custo: Number(t.custo || 0),
    inicio: t.inicio || "", fim: t.fim || "",
    origemProgresso: t.origemProgresso || "manual",
    ultimaMedicao: t.ultimaMedicao || "",
    ...desvioTarefaAuto(t, hoje),
  }));
  const exec = linhas.filter(l => !l.titulo);
  const medidas = exec.filter(l => l.situacao !== "sem-datas" && l.situacao !== "futura");
  const custoMedidas = medidas.reduce((s, l) => s + l.custo, 0);
  const resumo = {
    atrasadas:  exec.filter(l => l.situacao === "atrasada").length,
    adiantadas: exec.filter(l => l.situacao === "adiantada").length,
    noPrazo:    exec.filter(l => l.situacao === "no-prazo").length,
    concluidas: exec.filter(l => l.concluida).length,
    futuras:    exec.filter(l => l.situacao === "futura").length,
    semDatas:   exec.filter(l => l.situacao === "sem-datas").length,
    piorAtraso: exec.reduce((m, l) => Math.max(m, Number(l.desvio || 0)), 0),
    maiorAvanco: Math.abs(exec.reduce((m, l) => Math.min(m, Number(l.desvio || 0)), 0)),
    // Desvio da obra: media dos desvios ponderada pelo custo de cada tarefa.
    // Uma tarefa cara atrasada pesa mais que varias baratas adiantadas.
    desvioObra: custoMedidas
      ? Math.round(medidas.reduce((s, l) => s + l.custo * Number(l.desvio || 0), 0) / custoMedidas)
      : Math.round(medidas.reduce((s, l) => s + Number(l.desvio || 0), 0) / Math.max(1, medidas.length)),
  };
  return { linhas, resumo };
};

export const fundirEvolucao = (tarefas, rdos, obraId) => {
  const ev = evolucaoPorRDO(rdos, obraId);
  return (tarefas || []).map(t => {
    const chave = t.id;
    const eEtapa = t.etapaId;
    const info = ev[chave] || ev[eEtapa];
    const manualAtualizadoEm = t.progressoAtualizadoEm || "";
    const diarioAtualizadoEm = info?.atualizadoEm || "";

    // Uma medição técnica aprovada é a fonte oficial do físico. O diário
    // continua como evidência de produção, mas não pode sobrescrever o
    // boletim aprovado por ter sido editado depois.
    if (t.progressoOrigem === "medicao_tecnica_aprovada") {
      return { ...t, diasTrabalhados: info?.diasTrabalhados || 0,
               ultimaMedicao: t.ultimaMedicao || info?.ultimaData || "",
               origemProgresso: "medicao_tecnica_aprovada" };
    }

    // A ultima alteracao vence, independentemente da tela em que foi feita.
    // Assim, um ajuste na Medicao ou no Planejamento pode corrigir um valor do
    // Diario, e uma edicao posterior no Diario volta a atualizar todo o sistema.
    const manualMaisRecente = !!manualAtualizadoEm
      && (!diarioAtualizadoEm || manualAtualizadoEm >= diarioAtualizadoEm);

    if (info && !manualMaisRecente) {
      return { ...t, progresso: info.progresso, diasTrabalhados: info.diasTrabalhados,
               ultimaMedicao: info.ultimaData, progressoAtualizadoEm: info.atualizadoEm,
               origemProgresso: "diario", rdoOrigemId: info.rdoId };
    }
    return { ...t, diasTrabalhados: info?.diasTrabalhados || 0,
             ultimaMedicao: info?.ultimaData || t.ultimaMedicao || "",
             origemProgresso: t.progressoOrigem || "manual" };
  });
};
