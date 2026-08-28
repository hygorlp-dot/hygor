// ===================================================================
// OrcamentoView — tela de Orçamento extraída de LegacyApp.jsx
//
// Extraído verbatim (mesmo corpo, mesma lógica) de src/LegacyApp.jsx em
// 2026-08-16, seguindo o mesmo padrão da extração de Terceiros — mesma
// camada de dados, sem nova migration/RLS. Ver
// docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md, item #1 da fila de extração.
// ===================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "../../../components/charts/LazyRecharts";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { PageHeader, SummaryCard, ConfirmDialog } from "../../../design-system/patterns";
import { Checkbox as DesignSystemCheckbox } from "../../../design-system/primitives/Checkbox.jsx";
import {
  Badge, Btn, C, Ic, Inp, Modal, Sel,
  XLSX, carregarXLSX, jsonDaRespostaIA, obraContextoSalvo,
  maiusculoOrcamento, proximoCodigoArcd,
  ETAPAS_PADRAO, MAX_NIVEL, CLASSE_ABC,
  escapeHtml, fmt, today, uid,
  calcControleCustosOrcamento,
} from "../../../LegacyApp";
import {
  calculateBudget as calcularOrcamentoCanonico,
  projectBudgetABC,
  projectBudgetExport,
  getActiveBudgetBaseline,
  budgetIsImmutable,
  createBudgetRevision,
  adoptBudgetBaseline,
  bdiEfetivo as bdiEfetivoCanonico,
} from "../calculations";
import { auditBudgetDimensions as conferenciaDimensional } from "../dimensional-audit";
import {
  BDI_TCU, BDI_COMPONENTES_EDIF,
  calculateBdi as calcBDI, classifyBdi as situacaoBDI, formatBdiPercent as f2p,
} from "../bdi";
import {
  consolidateReferenceBases as consolidarBasesReferencia,
} from "../reference-bases";
import { BudgetTextCell as CelulaTexto } from "../BudgetTextCell";
import {
  detectarColunasImportacao, montarLinhasImportacao, resumoImportacao,
} from "../budget-import-mapping";
import { clonarCronogramaPlano, clonarEstruturaOrcamento } from "../budget-clone";
import { auditBudgetTechnicalScope } from "../technical-audit";
import {
  flattenBudgetTree as achatarArvore,
  budgetSubtreeIds as idsDaSubarvore,
  budgetStageLevel as nivelDaEtapa,
  calculateBudgetTree as calcOrcamento,
} from "../tree";
import {
  chamarIA,
  listarBasesReferencia, pesquisarBasesReferencia, pesquisarInsumosReferencia,
  resolverCodigosReferencia, detalharComposicoesReferencia,
} from "../../../api";
import {
  BITOLAS_ACO, FOLGA_ESCAVACAO_PADRAO_M, PROFUNDIDADE_ESCAVACAO_PADRAO_M,
  calcularConcretoMagroViga, calcularSapataTipo, novaLajePavimento, novaPilarPavimento, novaSapataTipo, novaVigaPavimento,
  resumoSapatas, somaAcoPorBitola,
} from "../memoria-calculo-estrutural";
import {
  CHAVE_PAVIMENTO, extrairElementosEstruturais, extrairQuantitativosPavimentos, extrairResumoAco, extrairSapatasFundacao,
} from "../estrutural-pdf-extrator";

// Total de um item com BDI. Se o item tiver BDI proprio (it.bdi), ele prevalece
// sobre o BDI global do orcamento - permite uma linha com BDI diferente.
const bdiDoItem = (it, bdiGlobal) =>
  bdiEfetivoCanonico(it,bdiGlobal);
const itemTotal = (it, bdi) =>
  Number(it.quantidade||0) * Number(it.precoUnit||0) * (1 + bdiDoItem(it, bdi)/100);

// Formulario zerado de composicao propria. O codigo entra vazio de proposito:
// quem preenche e o efeito de numeracao automatica, ja com a serie da empresa.
const compFormVazio = (extra = {}) => ({ id:"", codigo:"", descricao:"", unidade:"UN",
  origemFonte:"PRÓPRIA", origemCodigo:"", origemDataBase:"", origemUf:"", itens:[], ...extra });

// Densidade da tabela de sapatas (memória de cálculo) - ajuste manual do
// usuário, guardado em data.config (canônico para a empresa inteira, não
// por orçamento) até ele mesmo trocar de novo. "Espaçamento entre colunas
// muito grande" era o padding/fonte fixos demais para quem prefere uma
// visão mais compacta.
const DENSIDADE_TABELA_SAPATAS = {
  compacto:    { pad:"1px 2px", padHeader:"2px 3px", fonte:8,   fonteHeader:7.2, fonteGrupo:6.8 },
  normal:      { pad:"4px 5px", padHeader:"6px 5px", fonte:9.5, fonteHeader:8.3, fonteGrupo:7.5 },
  confortavel: { pad:"7px 8px", padHeader:"8px 8px", fonte:10.5,fonteHeader:9,   fonteGrupo:8.5 },
};

// Cada coluna da tabela de sapatas com sua largura PADRÃO (px) - o usuário
// pode sobrescrever qualquer uma em data.config.memoriaCalculoLargurasColuna
// (empresa inteira, "canônico até eu ajustar de novo", pedido explícito).
// Achado do próprio usuário: cabeçalho com "nowrap" forçava a coluna a ficar
// tão larga quanto o rótulo (ex.: "VOL. ESCAVAÇÃO(m³)"), mesmo quando o dado
// exibido é bem mais curto - por isso agora o rótulo QUEBRA linha e quem
// decide a largura de verdade é este número (ou o ajuste manual do usuário).
// Larguras padrão apertadas de propósito - somam ~1100px, perto do que uma
// A4 paisagem comporta (achado do próprio usuário: cabeçalho com "nowrap"
// forçava muito mais largura que o dado precisa). Ajuste manual do usuário
// (painel "AJUSTAR LARGURA DAS COLUNAS") sempre vence este padrão.
const COLUNAS_SAPATAS = [
  { chave:"tipo", rotulo:"TIPO (PILARES)", largura:130, grupo:null },
  { chave:"qtd", rotulo:"QTD PEÇAS", largura:42, grupo:null },
  { chave:"largura", rotulo:"LARG.(m)", largura:42, grupo:"DIMENSÕES" },
  { chave:"comprimento", rotulo:"COMPR.(m)", largura:46, grupo:"DIMENSÕES" },
  { chave:"alturaBase", rotulo:"ALT.BASE(m)", largura:44, grupo:"DIMENSÕES" },
  { chave:"alturaTronco", rotulo:"ALT.TRONCO(m)", largura:46, grupo:"DIMENSÕES" },
  { chave:"folgaEscavacao", rotulo:"FOLGA ESCAV.(m)", largura:46, grupo:"ESCAVAÇÃO" },
  { chave:"profundidadeEscavacao", rotulo:"ESCAV. PROF.(m)", largura:46, grupo:"ESCAVAÇÃO" },
  { chave:"volEscavacao", rotulo:"VOL. ESCAVAÇÃO(m³)", largura:48, grupo:"ESCAVAÇÃO" },
  { chave:"concMagro", rotulo:"CONC.MAGRO(m²)", largura:46, grupo:"CONCRETO" },
  { chave:"formas", rotulo:"FÔRMAS(m²)", largura:42, grupo:"CONCRETO" },
  { chave:"concrBase", rotulo:"CONCR.BASE(m³)", largura:46, grupo:"CONCRETO" },
  { chave:"concrTronco", rotulo:"CONCR.TRONCO(m³)", largura:48, grupo:"CONCRETO" },
  { chave:"concrSapata", rotulo:"CONCR.SAPATA(m³)", largura:48, grupo:"CONCRETO" },
  { chave:"reaterro", rotulo:"REATERRO(m³)", largura:44, grupo:"CONCRETO" },
  { chave:"armXBitola", rotulo:"ARM.X BITOLA", largura:44, grupo:"ARMADURA X" },
  { chave:"armXQtd", rotulo:"ARM.X QTD", largura:36, grupo:"ARMADURA X" },
  { chave:"armXCompr", rotulo:"ARM.X COMPR.(m)", largura:44, grupo:"ARMADURA X" },
  { chave:"armYBitola", rotulo:"ARM.Y BITOLA", largura:44, grupo:"ARMADURA Y" },
  { chave:"armYQtd", rotulo:"ARM.Y QTD", largura:36, grupo:"ARMADURA Y" },
  { chave:"armYCompr", rotulo:"ARM.Y COMPR.(m)", largura:44, grupo:"ARMADURA Y" },
  { chave:"pesoAco", rotulo:"PESO AÇO(kg)", largura:44, grupo:null },
  { chave:"acoes", rotulo:"", largura:40, grupo:null },
];
// Agrupa colunas consecutivas do mesmo grupo (Dimensões/Escavação/Concreto/
// Armadura X/Armadura Y) para a linha de cabeçalho superior - calculado uma
// vez a partir de COLUNAS_SAPATAS, nunca hardcoded, para nunca dessincronizar
// se uma coluna for adicionada/removida.
const GRUPOS_CABECALHO_SAPATAS = COLUNAS_SAPATAS.reduce((grupos, col) => {
  const ultimo = grupos[grupos.length - 1];
  if (ultimo && ultimo.nome === col.grupo) ultimo.span++;
  else grupos.push({ nome: col.grupo, span: 1 });
  return grupos;
}, []);

// Nome acessível de cada campo numérico da tabela de sapatas (memória de
// cálculo) - achado da crítica Impeccable: inputs soltos em <td>, sem
// aria-label, não têm nome nenhum para leitor de tela.
const ROTULO_CAMPO_SAPATA = {
  qtd: "Quantidade de peças", largura: "Largura", comprimento: "Comprimento",
  alturaBase: "Altura da base", alturaTronco: "Altura do tronco",
  folgaEscavacao: "Folga de escavação", profundidadeEscavacao: "Profundidade da escavação",
};

const normalizarTexto = texto => String(texto||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");

// Quais totais da memória de cálculo (Fundação/Sapatas) podem virar a
// quantidade de uma linha do orçamento, e as palavras usadas para sugerir
// automaticamente qual linha já lançada bate com cada um (busca na
// descrição do item, sem acento). Concretagem usa o volume TOTAL da
// sapata (base+tronco somados) - não faz sentido vincular base e tronco
// separados a linhas diferentes do orçamento.
const TOTAIS_VINCULAVEIS_FUNDACAO = [
  { chave: "volumeEscavacao", rotulo: "Volume de escavação", unidade: "m³", palavras: ["escavaç","escavac"] },
  { chave: "areaConcretoMagro", rotulo: "Concreto magro", unidade: "m²", palavras: ["concreto magro","lastro","regulariza"] },
  { chave: "formaArea", rotulo: "Fôrmas", unidade: "m²", palavras: ["forma","fôrma"] },
  { chave: "volumeSapata", rotulo: "Concretagem da sapata", unidade: "m³", palavras: ["sapata","concreto para fund","concreto ciclop","concreto usinado","concreto para infra"] },
  { chave: "reaterro", rotulo: "Reaterro", unidade: "m³", palavras: ["reaterro","reenchimento"] },
  { chave: "pesoAco", rotulo: "Aço (armadura)", unidade: "kg", palavras: ["aço","aco","armadura","vergalh","ca-50","ca-60"] },
];

// Os três pavimentos com Pilares/Vigas (a Fundação só tem sapatas - não
// existe "Vigas Baldrame" separado no projeto, é a própria Vigas do
// Térreo, confirmado com o usuário). Só 1º Pavimento/Cobertura têm laje -
// o Térreo se apoia direto nas vigas/sapatas, sem laje entre eles.
const PAVIMENTOS_ESTRUTURA = [["terreo","TÉRREO"],["pavimento1","1º PAVIMENTO"],["cobertura","COBERTURA"]];
const PAVIMENTOS_COM_LAJE = ["pavimento1","cobertura"];
const ROTULO_PAVIMENTO = { terreo:"Térreo", pavimento1:"1º Pavimento", cobertura:"Cobertura" };

export default function Orcamento({ data, update, showToast, obraIdFixo="", currentUser=null, todasObras=null, todosOrcamentosGlobais=null, todosPlanosGlobais=null }) {
  // Quando aberta de dentro de uma obra (ObraDetalhe), `data` chega ISOLADA
  // por obra (dadosDaObraIsolados) - data.obras/orcamentos/planos só têm os
  // registros da obra atual. "Copiar de outra obra" precisa enxergar as
  // OUTRAS obras para funcionar; os três props acima trazem as listas
  // completas só para esse recurso, sem alterar o isolamento existente (nem
  // um único outro uso de data.obras/orcamentos/planos neste arquivo muda -
  // todos já só olham para a obra atual, que sobrevive ao isolamento).
  const obrasParaCopia = todasObras || data.obras || [];
  const orcamentosParaCopia = todosOrcamentosGlobais || data.orcamentos || [];
  const planosParaCopia = todosPlanosGlobais || data.planos || [];
  const { cols, formGrid, isMobile } = useBreakpoint();
  // DESIGN.md exige 44px como alvo mínimo de toque no mobile; no desktop (mouse)
  // os mesmos botões ficam compactos como sempre foram.
  const alvoToque = isMobile ? 44 : 24;
  const ehAdmin = currentUser?.role === "admin";
  const dataAtualRef = useRef(data);
  const scrollAlvoRef = useRef(null);   // posicao a preservar durante um salvamento
  // Abrir somente a baseline aprovada. Uma revisão em rascunho nunca deve
  // parecer o orçamento vigente apenas por ser a última criada.
  const orcamentoFixoInicial=obraIdFixo?getActiveBudgetBaseline(data,obraIdFixo,"controle").budget:null;
  const [view,      setView]      = useState(orcamentoFixoInicial?"editor":"lista");   // "lista" | "editor"
  const [orcAba,    setOrcAba]    = useState("orcamento"); // orçamento | insumos | próprias | memoria
  const [pavimentoMemoria,setPavimentoMemoria]=useState("fundacao"); // fundacao | terreo | pavimento1 | cobertura
  const [selOrc,    setSelOrc]    = useState(()=>orcamentoFixoInicial?.id||getActiveBudgetBaseline(data,obraContextoSalvo(),"controle").budget?.id||null);      // id do orçamento aberto
  const [basesRemotas, setBasesRemotas] = useState([]);
  const [basesCarregando, setBasesCarregando] = useState(false);
  const [baseParaVincular, setBaseParaVincular] = useState("");
  const [resultadosRemotos, setResultadosRemotos] = useState([]);
  const [buscaRemotaLoading, setBuscaRemotaLoading] = useState(false);
  const [buscaRemotaAviso, setBuscaRemotaAviso] = useState("");
  const [atualizandoPrecos, setAtualizandoPrecos] = useState(false);
  const [basesPainelAberto,setBasesPainelAberto]=useState(false);
  const [codigoAtualizando, setCodigoAtualizando] = useState("");
  const [componentesDetalhados,setComponentesDetalhados]=useState([]);
  const [detalhesLoading,setDetalhesLoading]=useState(false);
  const [detalhesAviso,setDetalhesAviso]=useState("");
  const [abcTipo,setAbcTipo]=useState("insumos");
  const [abcInsumoFiltro,setAbcInsumoFiltro]=useState("todas");
  const [abcInsumoTipo,setAbcInsumoTipo]=useState("TODOS");   // INSUMO | COMPOSICAO | TODOS
  const [compForm,setCompForm]=useState(compFormVazio());
  const [clonandoComposicao,setClonandoComposicao]=useState("");
  const [compBusca,setCompBusca]=useState("");
  const buscaCompRef=useRef(null);   // foco no campo ao clicar em "importar da base"
  const [compBuscaDebounced,setCompBuscaDebounced]=useState("");
  const [compResultados,setCompResultados]=useState([]);
  const [compBuscaLoading,setCompBuscaLoading]=useState(false);
  const [compBuscaAviso,setCompBuscaAviso]=useState("");
  const [compTipoBusca,setCompTipoBusca]=useState("TODOS");
  const [compItemSubstituirId,setCompItemSubstituirId]=useState("");
  const [analiseReferencia,setAnaliseReferencia]=useState(null);
  const [analiseComponentes,setAnaliseComponentes]=useState([]);
  const [analiseReferenciaLoading,setAnaliseReferenciaLoading]=useState(false);
  const [analiseReferenciaAviso,setAnaliseReferenciaAviso]=useState("");
  const [buscaModal,setBuscaModal]= useState(false);
  const [busca,     setBusca]     = useState("");
  const [buscaLinha, setBuscaLinha] = useState({itemId:"", termo:""});
  // Colunas visiveis da planilha do orcamento. O usuario liga/desliga cada uma.
  // Fonte, descricao e quantidade sao fixas (sempre visiveis). As demais podem
  // ser ocultadas para deixar a grade mais limpa no celular.
  const COLS_ORC_DEF = { codigo:true, unidade:true, custoUnit:true, bdi:false, total:true };
  const [colsOrc, setColsOrc] = useState(COLS_ORC_DEF);
  const [colsOrcAberto, setColsOrcAberto] = useState(false);
  // Item sendo arrastado para reordenar (drag-and-drop), e sobre qual linha esta.
  const [arrastandoItem, setArrastandoItem] = useState(null);
  const [sobreItem, setSobreItem] = useState(null);
  const [buscaLinhaDebounced, setBuscaLinhaDebounced] = useState("");
  const [resultadosLinhaRemotos, setResultadosLinhaRemotos] = useState([]);
  const [buscaLinhaLoading, setBuscaLinhaLoading] = useState(false);
  const [buscaLinhaAviso, setBuscaLinhaAviso] = useState("");
  // O campo responde na hora; a filtragem dos 17 mil itens espera a digitação
  // parar. Sem isso, cada tecla dispara uma varredura completa e o input trava.
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [etapaAlvo, setEtapaAlvo] = useState("");
  const [novoModal, setNovoModal] = useState(false);
  const [ajudaModal, setAjudaModal] = useState(false);
  // Confirmação de exclusão (orçamento/etapa) via ConfirmDialog do design
  // system, em vez de window.confirm nativo - consistente com o resto da
  // interface e permite descrever o impacto real da exclusão.
  const [confirmDelOrc, setConfirmDelOrc] = useState(null); // {id, nome}
  const [confirmDelEtapa, setConfirmDelEtapa] = useState(null); // {ids, aviso}
  // Desfazer exclusão - janela curta para reverter sem precisar reconstruir
  // etapas/itens na mão. Guarda o estado ANTES da exclusão, não um diff.
  const [undoOrc, setUndoOrc] = useState(null); // {orc}
  const [undoEtapa, setUndoEtapa] = useState(null); // {etapasAntes, itensAntes, nome}
  const undoOrcTimeoutRef = useRef(null);
  const undoEtapaTimeoutRef = useRef(null);
  // Copiar orçamento (e cronograma, se a obra de origem já tiver um) de
  // outra obra - pedido do usuário em 26/08/2026, em vez de montar tudo do
  // zero a cada obra parecida.
  const [copiarModal, setCopiarModal] = useState(null); // {obraOrigemId, orcOrigemId}
  const [editMetaModal, setEditMetaModal] = useState(false);
  // Conferencia dimensional (IA): painel aberto e resposta da IA.
  const [confAberta, setConfAberta] = useState(false);
  const [confIA,      setConfIA]     = useState(null);   // resposta estruturada da IA
  const [confIALoad,  setConfIALoad] = useState(false);
  const [checkFiltro, setCheckFiltro]= useState("pendente");
  const [checkEdit,   setCheckEdit]  = useState(null);
  const [qtdModal,  setQtdModal]  = useState(null);      // item selecionado p/ informar qtd
  const [qtd,       setQtd]       = useState("");
  const [editItem,  setEditItem]  = useState(null);
  const [externoModal, setExternoModal] = useState(false);
  const [externoForm, setExternoForm] = useState({codigo:"",fonte:"EXTERNO",descricao:"",unidade:"UN",quantidade:"",precoUnit:"",composicao:""});
  const [etapaModal,setEtapaModal]= useState(null);   // {modo:"novo"|"sub"|"editar", paiId, etapa}
  const [etapaNome, setEtapaNome] = useState("");
  const [etapasFechadas, setEtapasFechadas] = useState({});
  // Curva ABC: painel aberto, agrupamento por codigo e classe filtrada.
  const [abcAberta,  setAbcAberta]  = useState(false);
  const [ferramentasOrcAberto,setFerramentasOrcAberto]=useState(false);
  // Fechado por padrão: a crítica de design apontou 5 painéis empilhados
  // antes da planilha aparecer - este era o mais pesado (tabela por etapa
  // de 1º nível) e o único que abria sozinho.
  const [controleCustosAberto,setControleCustosAberto]=useState(false);
  const [abcAgrupar, setAbcAgrupar] = useState(true);
  const [abcFiltro,  setAbcFiltro]  = useState("todas");   // "todas" | "A" | "B" | "C"
  // Importacao do orcamento (codigo + qtd) cruzada com a base.
  const [impModal, setImpModal] = useState(null);   // {linhas, stats, substituir, incluirPend}
  const [impLoad,  setImpLoad]  = useState(false);
  // Confirmação humana de onde estão as colunas antes de importar - a
  // detecção automática por nome de cabeçalho é só um palpite inicial
  // (achado real: uma planilha com "Nome" em vez de "Descrição" perdia o
  // nome de toda etapa e de todo item sem código, em silêncio, 26/08/2026).
  const [colMapModal, setColMapModal] = useState(null); // {headerRow, rows, hIdx, col}
  const [bdiModal,  setBdiModal]  = useState(false);
  const [bdiAba,    setBdiAba]    = useState("faixa");   // "faixa" | "detalhado"
  const [bdiTipo,   setBdiTipo]   = useState("edificios");
  const [bdiP,      setBdiP]      = useState(null);      // parâmetros em edição

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 140);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => {
    const t = setTimeout(() => setBuscaLinhaDebounced(buscaLinha.termo), 180);
    return () => clearTimeout(t);
  }, [buscaLinha.termo]);
  useEffect(() => {
    const t=setTimeout(()=>setCompBuscaDebounced(compBusca),220);
    return()=>clearTimeout(t);
  },[compBusca]);
  useEffect(() => { dataAtualRef.current = data; }, [data]);

  // Rede de seguranca do scroll: a posicao e anotada no instante do salvamento
  // e conferida DEPOIS que o React aplicou o novo estado no DOM, antes de o
  // navegador pintar. Se algo encolheu a pagina e o scroll escorregou, ele
  // volta sem piscar. Se nao escorregou, nada acontece - o efeito nao briga
  // com a rolagem de quem esta lendo.
  useLayoutEffect(() => {
    const alvo = scrollAlvoRef.current;
    if (alvo == null) return;
    scrollAlvoRef.current = null;
    if (Math.abs(window.scrollY - alvo) > 1) window.scrollTo({ top: alvo, behavior: "auto" });
  }, [data]);

  const carregarBasesRemotas = useCallback(async () => {
    setBasesCarregando(true);
    const result = await listarBasesReferencia();
    if (result.ok) setBasesRemotas(result.bases || []);
    else if (result.status !== 401) showToast(result.error || "Não foi possível carregar as bases do Supabase.", "warn");
    setBasesCarregando(false);
  }, [showToast]);

  useEffect(() => { carregarBasesRemotas(); }, [carregarBasesRemotas]);

  const emptyOrc = {
    nome:"", descricao:"", obraId:obraIdFixo, cliente:"", local:"", areaM2:"",
    fonte:"SINAPI", dataBase:"", uf:"PE", referencias:[], desonerado:true, bdi:"23.25",
  };
  const [form, setForm] = useState(emptyOrc);
  const F = k => v => setForm(f=>({...f,[k]:v}));

  const todosOrcamentos=data.orcamentos||[];
  const orcamentos = obraIdFixo?todosOrcamentos.filter(o=>o.obraId===obraIdFixo):todosOrcamentos;
  const orc = orcamentos.find(o => o.id === selOrc);
  const baselineAtiva = orc?.obraId ? getActiveBudgetBaseline(data,orc.obraId,"controle") : {budget:null,case:"baseline_ausente"};
  const calc = useMemo(() => orc ? calcOrcamento(orc) : null, [orc]);
  const controleCustos=useMemo(()=>calcControleCustosOrcamento(data,orc),[data.solicitacoesCompra,data.pedidos,data.movEstoque,data.transacoes,orc]);
  const composicoesEmpresa = useMemo(()=>{
    const mapa=new Map();
    [...(data.composicoesEmpresa||[]),...(orc?.composicoesProprias||[])].forEach(comp=>mapa.set(comp.id||`${comp.codigo}`,comp));
    return[...mapa.values()];
  },[data.composicoesEmpresa,orc?.composicoesProprias]);
  // Insumos e composições compartilham a série interna ARCD001, ARCD002...
  const proximoCodigoProprio = useCallback(() => proximoCodigoArcd(data),
    [data.materiais,data.composicoes,data.composicoesEmpresa]);

  const referenciaKey = (orc?.referencias || []).join("|");
  const basesConsolidadas = useMemo(() => consolidarBasesReferencia(basesRemotas), [basesRemotas]);
  const basesVinculadas = useMemo(() => {
    const ids = new Set(orc?.referencias || []);
    return basesConsolidadas.filter(base => base.idsEquivalentes.some(id => ids.has(id)));
  }, [basesConsolidadas, referenciaKey]);
  const basesDisponiveis = useMemo(() => {
    const ids = new Set(orc?.referencias || []);
    return basesConsolidadas.filter(base => !base.idsEquivalentes.some(id => ids.has(id)) && base.status === "ready");
  }, [basesConsolidadas, referenciaKey]);
  const totalBasesDuplicadas = basesRemotas.length - basesConsolidadas.length;

  useEffect(() => {
    let ativo = true;
    const term = buscaDebounced.trim();
    if (!buscaModal || !orc || term.length < 2 || !(orc.referencias || []).length) {
      setResultadosRemotos([]); setBuscaRemotaAviso(""); setBuscaRemotaLoading(false);
      return () => { ativo = false; };
    }
    setBuscaRemotaLoading(true);
    const timer = window.setTimeout(async () => {
      const result = await pesquisarBasesReferencia(orc.referencias || [], term);
      if (!ativo) return;
      if (result.ok) { setResultadosRemotos(result.items || []); setBuscaRemotaAviso(result.warning || ""); }
      else { setResultadosRemotos([]); setBuscaRemotaAviso(result.error || "Falha na pesquisa das bases cadastradas."); }
      setBuscaRemotaLoading(false);
    }, 280);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [buscaDebounced, buscaModal, referenciaKey, selOrc]);

  // A curva so e recalculada quando o orcamento ou o agrupamento mudam -
  // ordenar milhares de itens a cada render travaria a tela.
  const abc = useMemo(
    () => orc ? projectBudgetABC(orc, { group:abcAgrupar }) : null,
    [orc, abcAgrupar]
  );

  // Area de referencia para a conferencia dimensional: a do orcamento; se ela
  // nao existir, cai na area construida da obra vinculada.
  const areaRef = useMemo(() => {
    if (!orc) return 0;
    if (Number(orc.areaM2) > 0) return Number(orc.areaM2);
    const obra = (data.obras || []).find(o => o.id === orc.obraId);
    return Number(obra?.areaM2 || 0);
  }, [orc, data.obras]);

  // Roda a conferencia dimensional (local, sem IA).
  const confResultado = useMemo(
    () => orc ? conferenciaDimensional(orc, areaRef) : null,
    [orc, areaRef]
  );
  const auditoriaResultado = useMemo(
    () => orc ? auditBudgetTechnicalScope(orc, areaRef) : null,
    [orc, areaRef]
  );
  const checklistAuditoria = useMemo(()=>{
    if(!orc)return[];
    const atuais=[
      ...(auditoriaResultado?.achados||[]).map(a=>({...a,id:`sys-${a.id}`,origem:"sistema"})),
      ...(confResultado?.alertas||[]).map(a=>({id:`dim-${a.chave}`,titulo:`Quantitativo de ${a.nome}`,detalhe:`Lançado ${a.qtd.toFixed(1)} m²; referência aproximada ${a.esperado.toFixed(1)} m²; desvio ${a.difPct.toFixed(0)}%. ${a.obs||""}`,nivel:a.status==="alto"?"critico":"atencao",acaoSugerida:"Conferir a memória de cálculo e o projeto antes de alterar a quantidade.",origem:"dimensional"})),
      ...(confIA?.achados||[]).map(a=>({...a,id:a.id.startsWith("ai-")?a.id:`ai-${a.id}`,origem:"ia"})),
    ];
    const salvos=new Map((orc.auditoriaChecklist||[]).map(item=>[item.id,item]));
    const mesclados=atuais.map(item=>({...item,...(salvos.get(item.id)||{}),titulo:item.titulo,detalhe:item.detalhe,nivel:item.nivel,acaoSugerida:item.acaoSugerida,origem:item.origem,ativo:true,status:salvos.get(item.id)?.status||"pendente"}));
    const ids=new Set(atuais.map(item=>item.id));
    (orc.auditoriaChecklist||[]).filter(item=>!ids.has(item.id)).forEach(item=>mesclados.push({...item,ativo:false}));
    return mesclados;
  },[orc,auditoriaResultado,confResultado,confIA]);

  // Pede a IA uma segunda leitura dos achados locais e do escopo real.
  // A resposta nao pode inventar quantitativos nem transformar ausencia de
  // texto em certeza: itens especiais entram como perguntas de escopo.
  const analisarDimensionalIA = async () => {
    if (!orc || !(orc.itens||[]).some(item=>item.tipo!=="titulo")) return;
    setConfIALoad(true);
    setConfIA(null);
    try {
      const locais=(auditoriaResultado?.achados||[]).map(a=>`- [${a.nivel}] ${a.titulo}: ${a.detalhe}`).join("\n");
      const dimensionais=(confResultado?.alertas||[]).map(a=>
        `- ${a.nome}: ${a.qtd.toFixed(1)} m2 lançado; referência ~${a.esperado.toFixed(1)} m2; desvio ${a.difPct.toFixed(0)}%`).join("\n");
      const itens=(orc.itens||[]).filter(item=>item.tipo!=="titulo").slice(0,140).map((item,i)=>
        `${i+1}. [${item.fonte||"SEM FONTE"}] ${item.codigo||"S/C"} | ${item.descricao||"SEM DESCRIÇÃO"} | ${item.quantidade||0} ${item.unidade||""} | R$ ${Number(item.precoUnit||0).toFixed(2)}`).join("\n");
      const prompt = `Atue como engenheiro civil orçamentista sênior, humano e colaborativo, auditando um orçamento executivo privado em Caruaru/PE. `
        + `Faça uma revisão crítica realista, sem inventar projeto, quantidade, preço ou obrigação contratual. `
        + `Ausência na planilha não prova que o serviço faça parte do contrato: classifique como FALHA PROVÁVEL, `
        + `RISCO/INCONSISTÊNCIA, CONFIRMAR ESCOPO ou EXIGE COTAÇÃO. Priorize impacto em custo, prazo, desempenho, `
        + `segurança e retrabalho. Verifique interfaces e complementos, não apenas nomes soltos.\n\n`
        + `DADOS: orçamento "${orc.nome}"; área ${areaRef||"não informada"} m2; BDI ${Number(orc.bdi||0)}%; `
        + `base ${orc.fonte||"não informada"} ${orc.dataBase||"sem competência"}; ${(orc.itens||[]).length} linhas.\n\n`
        + `ACHADOS OBJETIVOS DO SISTEMA:\n${locais||"Nenhum."}\n\n`
        + `DIVERGÊNCIAS DIMENSIONAIS:\n${dimensionais||"Nenhuma ou sem área para conferir."}\n\n`
        + `ITENS DA PLANILHA:\n${itens}\n\n`
        + `Entregue: (1) resumo executivo; (2) falhas prováveis com evidência na lista; (3) itens a confirmar, incluindo `
        + `hidromassagem/SPA, ar-condicionado, bancadas/pedras, esquadrias/vidros, impermeabilizações, instalações e entrega; `
        + `(4) itens que devem ser cotados no mercado, explicando escopo mínimo da cotação; (5) perguntas objetivas ao projetista/cliente. `
        + `Para bancadas de granito/quartzo, esquadrias, vidros, marcenaria, climatização e equipamentos especiais, não trate `
        + `preço SINAPI/ORSE como proposta comercial: recomende cotação quando aplicável. Cite o item que motivou cada alerta. `
        + `Não cite norma específica sem ter certeza; indique validação pelo responsável técnico. `
        + `Retorne SOMENTE JSON válido, sem markdown, no formato {"resumo":"curto e claro","achados":[{"id":"ai-identificador-curto","titulo":"ação verificável","detalhe":"evidência e motivo","nivel":"critico|atencao|cotacao|escopo","acaoSugerida":"o que o operador deve verificar ou corrigir","itemRelacionado":"código ou descrição, se houver"}],"perguntas":["pergunta objetiva"]}. Cada achado deve poder ser revisado individualmente como checklist.`;
      const j = await chamarIA({ modulo:"orcamento", prompt, contexto:{obra:(data.obras||[]).find(o=>o.id===orc.obraId)?.name||"",orcamentoId:orc.id,orcamento:orc.nome} });
      if (!j.ok) throw new Error(j.error || `IA respondeu ${j.status}`);
      const resposta=jsonDaRespostaIA(j.reply||j.answer||"");
      const resultadoIA={resumo:String(resposta.resumo||""),perguntas:Array.isArray(resposta.perguntas)?resposta.perguntas.filter(Boolean):[],achados:(Array.isArray(resposta.achados)?resposta.achados:[]).map((a,i)=>({id:String(a.id||`ai-${i+1}`).replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,80),titulo:String(a.titulo||"Verificação sugerida pela IA"),detalhe:String(a.detalhe||""),nivel:["critico","atencao","cotacao","escopo"].includes(a.nivel)?a.nivel:"atencao",acaoSugerida:String(a.acaoSugerida||"Revisar o item e registrar a decisão."),itemRelacionado:String(a.itemRelacionado||""),origem:"ia"}))};
      setConfIA(resultadoIA);
      const existentes=orc.auditoriaChecklist||[],idsExistentes=new Set(existentes.map(item=>item.id));
      const novos=resultadoIA.achados.map(item=>({...item,id:item.id.startsWith("ai-")?item.id:`ai-${item.id}`,status:"pendente",observacao:"",ativo:true,atualizadoEm:new Date().toISOString(),atualizadoPor:"IA · aguardando revisão"})).filter(item=>!idsExistentes.has(item.id));
      if(novos.length)salvarOrc({auditoriaChecklist:[...existentes,...novos]});
    } catch (e) {
      setConfIA({resumo:"Não foi possível concluir a segunda análise agora. A auditoria local permanece disponível para revisão.",achados:[],perguntas:[]});
    } finally {
      setConfIALoad(false);
    }
  };

  // Usado pelo mapeamento manual de colunas ao importar uma planilha de
  // ORÇAMENTO (não de base de referência - isso agora é só admin, ver
  // src/domains/administracao/components/BasesPrecoAdmin.jsx), mais
  // abaixo em montarLinhasImportacao/colMapModal.
  // "1.234,56" | 1234.56 | "" → number
  const parseBR = (v) => {
    if (typeof v === "number") return v;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const limpo = s.replace(/[^\d,.-]/g, "");
    const ultimaVirgula = limpo.lastIndexOf(",");
    const ultimoPonto = limpo.lastIndexOf(".");
    let normalizado = limpo;
    if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
      normalizado = ultimaVirgula > ultimoPonto
        ? limpo.replace(/\./g, "").replace(",", ".")
        : limpo.replace(/,/g, "");
    } else if (ultimaVirgula >= 0) {
      normalizado = limpo.replace(/\./g, "").replace(",", ".");
    }
    const n = Number(normalizado);
    return isNaN(n) ? 0 : n;
  };


  //  Preço efetivo de uma composição 
  // Favoritos já vêm com preço congelado (precoUnit). Itens vindos da base
  // trazem as duas colunas; escolhemos conforme o orçamento (desonerado ou
  // não) e caímos na outra se a preferida estiver vazia - comum, já que
  // muitas planilhas de referência só preenchem uma das duas.
  const precoDoItem = (it, orcAtual) => {
    if (it.precoUnit != null && it.precoUnit > 0) return it.precoUnit;   // favorito
    const des = Number(it.precoDes || 0);
    const nao = Number(it.precoNao || 0);
    const querDes = orcAtual?.desonerado !== false;
    if (querDes) return des > 0 ? des : nao;
    return nao > 0 ? nao : des;
  };

  // Indica se o preço usado veio da coluna oposta à escolhida no orçamento
  const precoFoiSubstituido = (it, orcAtual) => {
    if (it.precoUnit != null && it.precoUnit > 0) return false;
    const des = Number(it.precoDes || 0);
    const nao = Number(it.precoNao || 0);
    const querDes = orcAtual?.desonerado !== false;
    return querDes ? (des <= 0 && nao > 0) : (nao <= 0 && des > 0);
  };

  //  Base de busca: favoritos (curadoria da empresa, ver data.baseFavoritos)
  const baseBusca = useMemo(() => (data.baseFavoritos||[]).map(f => ({...f, _fav:true})), [data.baseFavoritos]);

  // Busca sem acento: ninguém digita "VEDAÇÃO" na barra de pesquisa.
  // Normaliza os dois lados (NFD + remove diacríticos) antes de comparar.
  const semAcento = (s) =>
    String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Índice de busca pré-computado - evita normalizar 17k descrições a cada tecla
  const baseIndexada = useMemo(
    () => baseBusca.map(i => ({ ...i, _q: semAcento(i.codigo + " " + i.descricao) })),
    [baseBusca]
  );

  const resultadosLocais = useMemo(() => {
    const q = semAcento(buscaDebounced.trim());
    if (!q) return baseIndexada.filter(i => i._fav).slice(0, 50);

    // Todos os termos precisam aparecer ("alvenaria vedacao" acha os dois)
    const termos = q.split(/\s+/).filter(Boolean);
    const achados = baseIndexada.filter(i => termos.every(t => i._q.includes(t)));

    // Ranking por relevância. As descrições do SINAPI são longas e citam
    // vários materiais de passagem, então sem ranking a busca por "alvenaria"
    // devolve composições de armação que só mencionam alvenaria no fim.
    const score = (i) => {
      let s = 0;
      // 1. Código exato → topo absoluto
      if (i.codigo.toLowerCase() === q) s -= 10000;
      // 2. Expressão inteira aparece junta
      const junto = i._q.indexOf(q);
      if (junto >= 0) s -= 3000 - Math.min(junto, 2000);
      // 3. Quanto mais cedo o 1º termo aparece, melhor
      s += Math.min(i._q.indexOf(termos[0]), 400);
      // 4. Descrição curta é mais específica
      s += Math.min(i.descricao.length / 20, 40);
      // 5. Favoritos ganham um empurrão
      if (i._fav) s -= 500;
      return s;
    };

    // Pré-computa o score UMA vez por item. Chamar score() dentro do
    // comparador o executaria ~nlog(n) vezes - com 17 mil itens isso
    // domina o custo da busca.
    const comScore = achados.map(i => ({ i, s: score(i) }));
    comScore.sort((a, b) => a.s - b.s);
    return comScore.slice(0, 60).map(x => x.i);
  }, [buscaDebounced, baseIndexada]);

  const resultados = useMemo(() => {
    const out = [], seen = new Set();
    [...resultadosLocais, ...resultadosRemotos].forEach(item => {
      const key = `${item.fonte || "SINAPI"}:${String(item.codigo || "").replace(/^0+(?=\d)/, "")}`;
      if (!item.codigo || seen.has(key)) return;
      seen.add(key); out.push(item);
    });
    return out.slice(0, 80);
  }, [resultadosLocais, resultadosRemotos]);
  const temBasePesquisa = baseBusca.length > 0 || basesVinculadas.length > 0;

  // Pesquisa acionada dentro da propria coluna Descricao do orcamento.
  const resultadosLinhaLocais = useMemo(() => {
    const q = semAcento(buscaLinhaDebounced.trim());
    if (!buscaLinha.itemId || q.length < 2) return [];
    const termos = q.split(/\s+/).filter(Boolean);
    return baseIndexada
      .filter(item => termos.every(termo => item._q.includes(termo)))
      .map(item => {
        const pos = item._q.indexOf(q);
        const codigoExato = semAcento(item.codigo) === q;
        return {item, score:(codigoExato ? -10000 : 0) + (pos >= 0 ? pos - 3000 : 0) + Math.min(item.descricao.length / 20, 40) - (item._fav ? 500 : 0)};
      })
      .sort((a,b) => a.score - b.score)
      .slice(0, 30)
      .map(resultado => resultado.item);
  }, [buscaLinha.itemId, buscaLinhaDebounced, baseIndexada]);

  const resultadosLinha = useMemo(() => {
    const lista = [], vistos = new Set();
    [...resultadosLinhaLocais, ...resultadosLinhaRemotos].forEach(item => {
      const codigo = String(item.codigo || "").trim().toUpperCase().replace(/^0+(?=\d)/, "");
      const chave = `${item.fonte || "SINAPI"}:${codigo}`;
      if (!item.codigo || vistos.has(chave)) return;
      vistos.add(chave);
      lista.push(item);
    });
    return lista.slice(0, 40);
  }, [resultadosLinhaLocais, resultadosLinhaRemotos]);

  useEffect(() => {
    let ativo = true;
    const termo = buscaLinhaDebounced.trim();
    if (!buscaLinha.itemId || termo.length < 2 || !orc || !(orc.referencias || []).length) {
      setResultadosLinhaRemotos([]);
      setBuscaLinhaLoading(false);
      setBuscaLinhaAviso("");
      return () => { ativo = false; };
    }
    setBuscaLinhaLoading(true);
    setBuscaLinhaAviso("");
    const timer = window.setTimeout(async () => {
      const resposta = await pesquisarBasesReferencia(orc.referencias, termo);
      if (!ativo) return;
      if (resposta.ok) {
        setResultadosLinhaRemotos(resposta.items || []);
        setBuscaLinhaAviso(resposta.warning || "");
      } else {
        setResultadosLinhaRemotos([]);
        setBuscaLinhaAviso(resposta.error || "Falha ao pesquisar as bases vinculadas.");
      }
      setBuscaLinhaLoading(false);
    }, 120);
    return () => { ativo = false; window.clearTimeout(timer); };
  }, [buscaLinha.itemId, buscaLinhaDebounced, referenciaKey, selOrc]);

  useEffect(()=>{
    let ativo=true;
    const termo=compBuscaDebounced.trim();
    if(!["proprias","insumos"].includes(orcAba)||!orc||termo.length<2){
      setCompResultados([]);setCompBuscaLoading(false);setCompBuscaAviso("");
      return()=>{ativo=false;};
    }
    const normalizado=termo.toLocaleLowerCase("pt-BR");
    const locais=compTipoBusca==="COMPOSICAO"?[]:(data.materiais||[]).filter(item=>item.ativo!==false&&
      `${item.codigo||""} ${item.descricao||""}`.toLocaleLowerCase("pt-BR").includes(normalizado)).map(item=>({
        fonte:"PRÓPRIA",tipoItem:"INSUMO",codigo:item.codigo,descricao:item.descricao,
        unidade:maiusculoOrcamento(item.unidade||"UN"),precoUnit:Number(item.precoMedio||0),_local:true,
      }));
    if(!(orc.referencias||[]).length){setCompResultados(locais);setCompBuscaLoading(false);setCompBuscaAviso("");return()=>{ativo=false;};}
    setCompBuscaLoading(true);setCompBuscaAviso("");
    const timer=window.setTimeout(async()=>{
      const resposta=await pesquisarInsumosReferencia(orc.referencias,termo,compTipoBusca);
      if(!ativo)return;
      if(resposta.ok){setCompResultados([...locais,...(resposta.items||[])]);setCompBuscaAviso(resposta.warning||"");}
      else{setCompResultados(locais);setCompBuscaAviso(resposta.error||"Falha ao pesquisar insumos e composicoes.");}
      setCompBuscaLoading(false);
    },120);
    return()=>{ativo=false;window.clearTimeout(timer);};
  },[compBuscaDebounced,compTipoBusca,orcAba,referenciaKey,selOrc,data.materiais]);

  //  CRUD orçamento 
  const criarOrc = () => {
    if (!form.nome.trim()) { showToast("Informe o nome do orçamento.","error"); return; }
    const id=uid(), agora=new Date().toISOString();
    const novo = {
      id, versionId:id, versionNumber:1, revisionOf:"", versionStatus:"rascunho",
      ...form,
      areaM2: Number(form.areaM2||0),
      bdi:    Number(form.bdi||0),
      createdAt: agora, updatedAt:agora, createdById:currentUser?.id||"", createdBy:currentUser?.nome||"",
      status: "rascunho",
      auditoriaChecklist: [],
      etapas: ETAPAS_PADRAO.map(nome => ({ id:uid(), nome, parentId:"" })),
      itens: [],
    };
    update({ ...data, orcamentos:[...todosOrcamentos, novo] });
    setNovoModal(false);
    setForm(emptyOrc);
    setSelOrc(novo.id);
    setView("editor");
    showToast("Orçamento criado com as 16 etapas padrão.");
  };

  // Copia o orçamento (etapas + itens) de uma obra de origem para a obra de
  // destino, com ids novos. Se a obra de origem já tiver um cronograma
  // (plano) montado, copia junto - remapeado para as novas etapas e com as
  // datas deslocadas para começar hoje.
  const confirmarCopiaDeObra = () => {
    const obraDestinoId = obraIdFixo || form.obraId;
    if (!copiarModal?.orcOrigemId) { showToast("Selecione o orçamento de origem.","error"); return; }
    if (!obraDestinoId) { showToast("Selecione a obra de destino.","error"); return; }
    const orcOrigem = orcamentosParaCopia.find(o => o.id === copiarModal.orcOrigemId);
    if (!orcOrigem) { showToast("Orçamento de origem não encontrado.","error"); return; }

    const planoOrigem = planosParaCopia.find(p => p.obraId === copiarModal.obraOrigemId);
    const planoDestinoExistente = planosParaCopia.find(p => p.obraId === obraDestinoId);
    if (planoDestinoExistente?.tarefas?.length && planoOrigem?.tarefas?.length
        && !window.confirm("A obra de destino já tem um cronograma com tarefas. Substituir pelo cronograma copiado?")) {
      return;
    }

    const agora = new Date().toISOString();
    const id = uid();
    const { etapas, itens, etapaIdMap } = clonarEstruturaOrcamento(orcOrigem, uid, { zerarQuantidades: !copiarModal.repetirQuantidades });
    const novo = {
      id, versionId:id, versionNumber:1, revisionOf:"", versionStatus:"rascunho",
      nome: String(form.nome||"").trim() || `Cópia de ${orcOrigem.nome}`,
      descricao: orcOrigem.descricao||"", cliente: orcOrigem.cliente||"", local: orcOrigem.local||"",
      areaM2: orcOrigem.areaM2||0, fonte: orcOrigem.fonte||"SINAPI", uf: orcOrigem.uf||"PE",
      dataBase: orcOrigem.dataBase||"", desonerado: orcOrigem.desonerado!==false, bdi: orcOrigem.bdi||0,
      obraId: obraDestinoId,
      createdAt: agora, updatedAt:agora, createdById:currentUser?.id||"", createdBy:currentUser?.nome||"",
      status: "rascunho",
      auditoriaChecklist: [],
      etapas, itens,
    };

    let planos = data.planos||[];
    let copiouCronograma = false;
    if (planoOrigem?.tarefas?.length) {
      const { tarefas, marcos } = clonarCronogramaPlano(planoOrigem, etapaIdMap, { hoje: today(), gerarId: uid });
      const planoNovo = {
        id: uid(), obraId: obraDestinoId, budgetId: id, budgetVersionId: id,
        inicio: today(), tarefas, marcos,
        diasSemana: planoOrigem.diasSemana||[1,2,3,4,5,6],
        pularFeriados: planoOrigem.pularFeriados!==false,
        usarFeriadosCadastrados: planoOrigem.usarFeriadosCadastrados||false,
        feriados: planoOrigem.feriados||[],
      };
      planos = planoDestinoExistente ? planos.map(p => p.obraId===obraDestinoId ? planoNovo : p) : [...planos, planoNovo];
      copiouCronograma = true;
    }

    update({ ...data, orcamentos:[...todosOrcamentos, novo], planos });
    setCopiarModal(null);
    setForm(emptyOrc);
    setSelOrc(novo.id);
    setView("editor");
    showToast(copiouCronograma
      ? `Orçamento e cronograma copiados de "${obrasParaCopia.find(o=>o.id===copiarModal.obraOrigemId)?.name||"outra obra"}".`
      : `Orçamento copiado de "${obrasParaCopia.find(o=>o.id===copiarModal.obraOrigemId)?.name||"outra obra"}". A obra de origem não tinha cronograma para copiar.`);
  };

  const salvarOrc = (patch) => {
    if (budgetIsImmutable(orc)) { showToast("Esta versão está aprovada e imutável. Crie uma revisão para alterá-la.","warn"); return; }
    scrollAlvoRef.current = window.scrollY;
    update({ ...data, orcamentos: todosOrcamentos.map(o => o.id===selOrc ? {...o, ...patch,updatedAt:new Date().toISOString()} : o) });
  };

  // Memória de cálculo estrutural - painel de referência por pavimento
  // (guardado dentro do próprio orçamento, ao lado de itens/etapas; não
  // escreve nas linhas do orçamento sozinho - decisão tomada com o usuário).
  const sapatasFundacao = orc?.memoriaCalculo?.fundacao?.sapatas || [];
  const resumoSapatasFundacao = useMemo(() => resumoSapatas(sapatasFundacao), [sapatasFundacao]);
  const salvarSapatasFundacao = (novaLista) => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), fundacao: { ...(orc?.memoriaCalculo?.fundacao || {}), sapatas: novaLista } },
  });
  // Achado da crítica Impeccable (27/08/2026): o padrão de folga/profundidade
  // de escavação era só estado local da tela - um valor específico do
  // canteiro (ex.: 25cm em vez de 20cm) se perdia ao recarregar a página.
  // Agora vive no próprio orçamento e vale também para tipos novos.
  const padraoEscavacaoFundacao = orc?.memoriaCalculo?.fundacao?.padraoEscavacao
    || { folga: FOLGA_ESCAVACAO_PADRAO_M, profundidade: PROFUNDIDADE_ESCAVACAO_PADRAO_M };
  const salvarPadraoEscavacaoFundacao = patch => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), fundacao: { ...(orc?.memoriaCalculo?.fundacao || {}), padraoEscavacao: { ...padraoEscavacaoFundacao, ...patch } } },
  });
  const adicionarSapataTipo = () => salvarSapatasFundacao([...sapatasFundacao, novaSapataTipo({
    id: uid(), folgaEscavacao: padraoEscavacaoFundacao.folga, profundidadeEscavacao: padraoEscavacaoFundacao.profundidade,
  })]);

  // Pilares/Vigas/Lajes (Térreo/1º Pavimento/Cobertura) - mesmo painel de
  // referência dentro do orçamento, guardado por pavimento
  // (memoriaCalculo.<pavimento>.pilar/viga/laje). Os três são um objeto
  // único por pavimento, não uma lista por tipo/elemento - achado real,
  // pedido direto do usuário (27/08/2026): o orçamento só usa o total do
  // pavimento inteiro (mesmo formato SINAPI de vigas/lajes), nunca o
  // detalhe por pilar - ver novaPilarPavimento/novaVigaPavimento/
  // novaLajePavimento em memoria-calculo-estrutural.js.
  //
  // Mescla com os padrões em vez de "tudo ou nada" (`||`) - um objeto já
  // salvo ANTES do aço virar `acoPorBitola` (achado real, produção,
  // 27/08/2026: "Cannot read properties of undefined (reading 'map')" ao
  // abrir a Memória de Cálculo) é um objeto de verdade, então o `||` nunca
  // cai no padrão novo - ficava sem `acoPorBitola` nenhum, e o editor
  // quebrava tentando `.map` num `undefined`.
  const pilarDoPavimento = pav => ({ ...novaPilarPavimento(), ...(orc?.memoriaCalculo?.[pav]?.pilar || {}) });
  const salvarPilarDoPavimento = (pav, patch) => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), [pav]: { ...(orc?.memoriaCalculo?.[pav] || {}), pilar: { ...pilarDoPavimento(pav), ...patch, precisaRevisar: false } } },
  });
  const vigaDoPavimento = pav => ({ ...novaVigaPavimento(), ...(orc?.memoriaCalculo?.[pav]?.viga || {}) });
  const salvarVigaDoPavimento = (pav, patch) => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), [pav]: { ...(orc?.memoriaCalculo?.[pav] || {}), viga: { ...vigaDoPavimento(pav), ...patch } } },
  });
  const lajeDoPavimento = pav => ({ ...novaLajePavimento(), ...(orc?.memoriaCalculo?.[pav]?.laje || {}) });
  const salvarLajeDoPavimento = (pav, patch) => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), [pav]: { ...(orc?.memoriaCalculo?.[pav] || {}), laje: { ...lajeDoPavimento(pav), ...patch } } },
  });

  // Achado do Impeccable (P1): "Vincular ao Orçamento" existia só na
  // Fundação - 75% das abas construídas nesta sessão (Térreo/1º Pav/
  // Cobertura) não tinham o mesmo fechamento, obrigando o usuário a
  // decorar o total e digitar na aba Orçamento na mão. Versão genérica do
  // mesmo padrão da Fundação (vinculosFundacao/sugerirVinculosFundacao/
  // sincronizarVinculosFundacao, que continuam intactos - a Fundação usa
  // um cálculo por tipo que não vale a pena generalizar agora), guardada
  // em memoriaCalculo.<pavimento>.vinculos.
  const totaisVinculaveisPavimento = pav => {
    const pilar = pilarDoPavimento(pav);
    const viga = vigaDoPavimento(pav);
    const lista = [
      { chave: "pilarConcreto", rotulo: "Concreto dos pilares", unidade: "m³", palavras: ["pilar"], valor: pilar.concretoM3 },
      { chave: "pilarForma", rotulo: "Fôrma dos pilares", unidade: "m²", palavras: ["fôrma","forma","pilar"], valor: pilar.formaM2 },
      { chave: "pilarAco", rotulo: "Aço dos pilares", unidade: "kg", palavras: ["aço","aco","armadura","pilar"], valor: somaAcoPorBitola(pilar.acoPorBitola) },
      { chave: "vigaConcreto", rotulo: "Concreto das vigas", unidade: "m³", palavras: ["viga"], valor: viga.concretoM3 },
      { chave: "vigaForma", rotulo: "Fôrma das vigas", unidade: "m²", palavras: ["fôrma","forma","viga"], valor: viga.formaM2 },
      { chave: "vigaAco", rotulo: "Aço das vigas", unidade: "kg", palavras: ["aço","aco","armadura","viga"], valor: somaAcoPorBitola(viga.acoPorBitola) },
    ];
    if (pav === "terreo") {
      lista.push({ chave: "vigaMagro", rotulo: "Concreto magro (viga baldrame)", unidade: "m²", palavras: ["magro","lastro"], valor: calcularConcretoMagroViga(viga) });
    }
    if (PAVIMENTOS_COM_LAJE.includes(pav)) {
      const laje = lajeDoPavimento(pav);
      lista.push({ chave: "lajeVolume", rotulo: "Concretagem da laje", unidade: "m³", palavras: ["laje"], valor: laje.volumeM3 });
      lista.push({ chave: "lajeAco", rotulo: "Aço da laje", unidade: "kg", palavras: ["aço","aco","armadura","laje"], valor: somaAcoPorBitola(laje.acoPorBitola) });
    }
    return lista.filter(t => t.valor > 0); // sem valor ainda não faz sentido oferecer pra vincular
  };
  const vinculosDoPavimento = pav => orc?.memoriaCalculo?.[pav]?.vinculos || {};
  const salvarVinculosDoPavimento = (pav, patch) => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), [pav]: { ...(orc?.memoriaCalculo?.[pav] || {}), vinculos: { ...vinculosDoPavimento(pav), ...patch } } },
  });
  const sugerirVinculosPavimento = pav => {
    const vinculos = vinculosDoPavimento(pav);
    const sugestoes = {};
    totaisVinculaveisPavimento(pav).forEach(({ chave, palavras }) => {
      if (vinculos[chave]) return;
      const achado = itensOrcamentoParaVincular.find(it => palavras.some(p => normalizarTexto(it.descricao || "").includes(normalizarTexto(p))));
      if (achado) sugestoes[chave] = achado.id;
    });
    if (!Object.keys(sugestoes).length) { showToast(`Não encontrei nenhuma linha do orçamento parecida com os termos de ${ROTULO_PAVIMENTO[pav]} (pilar, viga, laje, fôrma, aço).`, "warn"); return; }
    salvarVinculosDoPavimento(pav, sugestoes);
    showToast(`${Object.keys(sugestoes).length} vínculo(s) sugerido(s) para ${ROTULO_PAVIMENTO[pav]} - confira antes de sincronizar.`);
  };
  const sincronizarVinculosPavimento = pav => {
    const vinculos = vinculosDoPavimento(pav);
    const totais = totaisVinculaveisPavimento(pav);
    const atualizacoes = new Map();
    totais.forEach(({ chave, valor }) => {
      const itemId = vinculos[chave];
      if (itemId) atualizacoes.set(itemId, Number(valor.toFixed(4)));
    });
    if (!atualizacoes.size) { showToast("Nenhum total vinculado ainda - escolha uma linha do orçamento para cada total antes de sincronizar.", "warn"); return; }
    salvarOrc({ itens: (orc.itens || []).map(it => atualizacoes.has(it.id) ? { ...it, quantidade: atualizacoes.get(it.id) } : it) });
    showToast(`${atualizacoes.size} linha(s) do orçamento atualizada(s) com os totais de ${ROTULO_PAVIMENTO[pav]}.`);
  };
  const renderVincularPavimento = pav => {
    const vinculos = vinculosDoPavimento(pav);
    const totais = totaisVinculaveisPavimento(pav);
    if (!totais.length) return null; // nada preenchido ainda neste pavimento - vincular não faz sentido
    return (
      <div style={{background:C.bg,border:`1px solid ${C.blue}44`,borderRadius:7,padding:"9px 11px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
          <div><p style={{fontSize:12,fontWeight:850,color:C.text}}>VINCULAR AO ORÇAMENTO</p><p style={{fontSize:10,color:C.muted,marginTop:2}}>Escolha, para cada total, qual linha já lançada no orçamento deve receber essa quantidade. Nada muda sozinho - só ao clicar em "sincronizar".</p></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Btn size="sm" v="ghost" onClick={()=>sugerirVinculosPavimento(pav)} disabled={!itensOrcamentoParaVincular.length}><Ic n="search"/> SUGERIR VÍNCULOS</Btn>
            <Btn size="sm" onClick={()=>sincronizarVinculosPavimento(pav)} disabled={!Object.keys(vinculos).length}><Ic n="refresh"/> SINCRONIZAR QUANTIDADES</Btn>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {totais.map(({chave,rotulo,unidade,valor})=>{
            const itemVinculado = itensOrcamentoParaVincular.find(it=>it.id===vinculos[chave]);
            return (
              <div key={chave} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"5px 0",borderBottom:`1px solid ${C.line}`}}>
                <div style={{minWidth:170}}><b style={{fontSize:10.5,color:C.text}}>{rotulo}</b><span style={{fontSize:9.5,color:C.muted,marginLeft:6}}>{valor.toFixed(valor<10?3:2)} {unidade}</span></div>
                <Ic n="chevR" s={12} color={C.muted}/>
                <select aria-label={`Linha do orçamento vinculada a ${rotulo}`} value={vinculos[chave]||""} onChange={e=>salvarVinculosDoPavimento(pav,{[chave]:e.target.value||undefined})}
                  style={{flex:"1 1 260px",minWidth:200,padding:"5px 7px",border:`1px solid ${itemVinculado?C.blue:C.border}`,borderRadius:5,background:C.card,color:C.text,fontSize:10}}>
                  <option value="">Sem vínculo</option>
                  {itensOrcamentoParaVincular.map(it=><option key={it.id} value={it.id}>{it.codigo?`${it.codigo} · `:""}{(it.descricao||"sem descrição").slice(0,70)} ({it.unidade||"UN"})</option>)}
                </select>
                {itemVinculado&&<span title="Quantidade atual desta linha no orçamento" style={{fontSize:9.5,color:C.muted}}>atual: {Number(itemVinculado.quantidade||0).toLocaleString("pt-BR",{maximumFractionDigits:3})} {itemVinculado.unidade}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Editor de aço por bitola, reaproveitado pelo cartão de Vigas, de Laje e
  // pelo resumo de Pilares - cada bitola é uma linha (∅ + kg), igual ao
  // "Resumo Aço" que o próprio projeto imprime por folha. Uma lista vazia
  // mostra só o botão de adicionar.
  const renderEditorAcoPorBitola = (listaOuIndefinida, salvarLista) => {
    const lista = listaOuIndefinida || []; // defesa extra - ver achado real no vigaDoPavimento/lajeDoPavimento acima
    const atualizarLinha = (indice, patch) => salvarLista(lista.map((l, i) => i === indice ? { ...l, ...patch } : l));
    const removerLinha = indice => salvarLista(lista.filter((_, i) => i !== indice));
    const adicionarLinha = () => salvarLista([...lista, { bitola: BITOLAS_ACO[0], kg: 0 }]);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {lista.map((l,i)=>(
          <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
            <select aria-label="Bitola" value={l.bitola} onChange={e=>atualizarLinha(i,{bitola:e.target.value})} style={{padding:"6px 7px",border:`1px solid ${C.border}`,borderRadius:5,background:C.bg,color:C.text,fontSize:10.5}}>
              {BITOLAS_ACO.map(b=><option key={b} value={b}>∅{b}</option>)}
            </select>
            <input type="number" min="0" step="any" aria-label="Peso em kg" value={l.kg} onChange={e=>atualizarLinha(i,{kg:e.target.value.replace(",",".")})} style={{width:90,boxSizing:"border-box",padding:"6px 7px",border:`1px solid ${C.border}`,borderRadius:5,background:C.bg,color:C.text,textAlign:"right",fontSize:10.5}}/>
            <span style={{fontSize:9.5,color:C.muted}}>KG</span>
            <button aria-label="Remover esta bitola" onClick={()=>removerLinha(i)} style={{border:0,background:"transparent",color:C.red,cursor:"pointer",fontWeight:800}}>x</button>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <button onClick={adicionarLinha} style={{border:`1px dashed ${C.border}`,background:"transparent",color:C.blue,borderRadius:5,padding:"5px 9px",fontSize:9.5,fontWeight:800,cursor:"pointer"}}>+ BITOLA</button>
          {lista.length>0&&<span style={{fontSize:10.5,fontWeight:800,color:C.purple}}>TOTAL: {somaAcoPorBitola(lista).toFixed(1)} KG</span>}
        </div>
      </div>
    );
  };

  // Tabela de pilares reaproveita a mesma densidade da tabela de sapatas
  // (é ajuste de leitura da tela inteira, não específico de um elemento) -
  // mas SEM o sistema de largura de coluna ajustável/arrastável: só 9
  // colunas, bem menos cramped que as 23 das sapatas, não precisa disso.
  const renderCardPilar = pav => {
    const pilar = pilarDoPavimento(pav);
    const campoPilar = (campo,rotulo) => <input type="number" min="0" step="any" aria-label={rotulo} value={pilar[campo]}
      onChange={e=>salvarPilarDoPavimento(pav,{[campo]:e.target.value.replace(",",".")})}
      style={{width:"100%",boxSizing:"border-box",padding:"7px 8px",border:`1px solid ${C.border}`,borderRadius:5,background:C.bg,color:C.text,textAlign:"right",fontSize:11}}/>;
    return (
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:11,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {pilar.precisaRevisar&&<span title="Importado do PDF - ainda não revisado. Editar qualquer campo aqui remove este aviso." style={{flexShrink:0,width:7,height:7,borderRadius:"50%",background:C.orange}}/>}
          <p style={{fontSize:13,fontWeight:800,color:C.text}}>PILARES</p>
        </div>
        <p style={{fontSize:10,color:C.muted,marginTop:-4}}>Total do pavimento inteiro (o orçamento sempre orça pilares assim, nunca pilar a pilar) - o projeto detalha cada pilar, mas concreto e fôrma somam certo pra cá.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,190px))",gap:8}}>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>CONCRETO (M³)</span>{campoPilar("concretoM3","Concreto dos pilares")}</label>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>FÔRMA (M²)</span>{campoPilar("formaM2","Fôrma dos pilares")}</label>
        </div>
        <div>
          <p style={{fontSize:9,fontWeight:800,color:C.muted,marginBottom:5}}>AÇO POR BITOLA</p>
          {renderEditorAcoPorBitola(pilar.acoPorBitola, lista=>salvarPilarDoPavimento(pav,{acoPorBitola:lista}))}
        </div>
      </div>
    );
  };

  // Vigas/lajes não têm tabela - o próprio projeto só entrega um total
  // pronto por pavimento inteiro (ver novaVigaPavimento/novaLajePavimento).
  const renderCardViga = pav => {
    const viga = vigaDoPavimento(pav);
    const campoViga = (campo,rotulo) => <input type="number" min="0" step="any" aria-label={rotulo} value={viga[campo]}
      onChange={e=>salvarVigaDoPavimento(pav,{[campo]:e.target.value.replace(",",".")})}
      style={{width:"100%",boxSizing:"border-box",padding:"7px 8px",border:`1px solid ${C.border}`,borderRadius:5,background:C.bg,color:C.text,textAlign:"right",fontSize:11}}/>;
    return (
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:11,display:"flex",flexDirection:"column",gap:8}}>
        <div><p style={{fontSize:13,fontWeight:800,color:C.text}}>VIGAS</p><p style={{fontSize:10,color:C.muted,marginTop:2}}>O projeto detalha viga a viga (armadura), mas só entrega concreto/fôrma como total do pavimento inteiro - por isso é um valor só, não uma tabela por viga.</p></div>
        {viga.avisoConcretoIncorreto&&<div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}55`,borderRadius:6,padding:"7px 9px"}}><p style={{fontSize:10,color:C.orange,fontWeight:700,lineHeight:1.5}}>⚠ O próprio projeto avisa que não conseguiu calcular o volume de concreto das vigas deste pavimento com segurança ("por não dispor dos dados necessários"). Confira antes de confiar neste número.</p></div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,190px))",gap:8}}>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>CONCRETO (M³)</span>{campoViga("concretoM3","Concreto das vigas")}</label>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>FÔRMA (M²)</span>{campoViga("formaM2","Fôrma das vigas")}</label>
        </div>
        {pav==="terreo"&&(()=>{
          const magro=calcularConcretoMagroViga(viga);
          const comprimento=viga.larguraVigaM>0?viga.areaPlantaVigasM2/viga.larguraVigaM:0;
          return (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 10px",display:"flex",flexDirection:"column",gap:6}}>
              <div><p style={{fontSize:9.5,fontWeight:800,color:C.muted}}>CONCRETO MAGRO (LASTRO SOB A VIGA BALDRAME)</p><p style={{fontSize:9,color:C.muted,marginTop:2}}>Comprimento total já vem da área em planta das vigas (importada do Quantitativos) dividida pela largura - só a largura e o acréscimo precisam ser digitados.</p></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,190px))",gap:8}}>
                <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,color:C.muted}}>LARGURA DA VIGA (M)</span>{campoViga("larguraVigaM","Largura da viga")}</label>
                <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,color:C.muted}}>LARGURA A ACRESCER, DE CADA LADO (M)</span>{campoViga("magroLarguraAcrescidaM","Largura a acrescer no magro, de cada lado")}</label>
              </div>
              <p style={{fontSize:10,color:C.text}}>Comprimento total: <b>{comprimento.toFixed(2)} m</b> ({viga.areaPlantaVigasM2||0} m² em planta ÷ {viga.larguraVigaM||0} m) · Área do magro: <b>{magro.toFixed(2)} m²</b></p>
              {!viga.areaPlantaVigasM2&&viga.larguraVigaM>0&&(
                <p style={{fontSize:9.5,color:C.orange,fontWeight:700,lineHeight:1.5}}>⚠ Área em planta ainda não importada (0 m²) - o concreto/fôrma deste pavimento vieram de uma importação anterior ao PDF de Quantitativos trazer esse dado. Reimporte o PDF de Quantitativos (seção "Importar projeto" acima) para calcular o magro.</p>
              )}
            </div>
          );
        })()}
        <div>
          <p style={{fontSize:9,fontWeight:800,color:C.muted,marginBottom:5}}>AÇO POR BITOLA</p>
          {renderEditorAcoPorBitola(viga.acoPorBitola, lista=>salvarVigaDoPavimento(pav,{acoPorBitola:lista}))}
        </div>
      </div>
    );
  };

  const renderCardLaje = pav => {
    const laje = lajeDoPavimento(pav);
    const campoLaje = (campo,rotulo) => <input type="number" min="0" step="any" aria-label={rotulo} value={laje[campo]}
      onChange={e=>salvarLajeDoPavimento(pav,{[campo]:e.target.value.replace(",",".")})}
      style={{width:"100%",boxSizing:"border-box",padding:"7px 8px",border:`1px solid ${C.border}`,borderRadius:5,background:C.bg,color:C.text,textAlign:"right",fontSize:11}}/>;
    return (
      <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:11,display:"flex",flexDirection:"column",gap:8}}>
        <div><p style={{fontSize:13,fontWeight:800,color:C.text}}>LAJE</p><p style={{fontSize:10,color:C.muted,marginTop:2}}>Volume total do pavimento, já separado em maciça (concreto cheio) e vigota (pré-moldada) - o mesmo jeito que o Quantitativos do projeto resume.</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,190px))",gap:8}}>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>VOLUME TOTAL (M³)</span>{campoLaje("volumeM3","Volume total de laje")}</label>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>MACIÇA (M³)</span>{campoLaje("volumeMacicasM3","Volume de laje maciça")}</label>
          <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>VIGOTA (M³)</span>{campoLaje("volumeVigotasM3","Volume de laje vigota")}</label>
        </div>
        <div>
          <p style={{fontSize:9,fontWeight:800,color:C.muted,marginBottom:5}}>AÇO POR BITOLA</p>
          {renderEditorAcoPorBitola(laje.acoPorBitola, lista=>salvarLajeDoPavimento(pav,{acoPorBitola:lista}))}
        </div>
      </div>
    );
  };

  // Densidade da tabela é ajuste pessoal de leitura, não do orçamento - fica
  // em data.config (empresa inteira) para valer em qualquer memória de
  // cálculo até o usuário trocar de novo, como ele pediu explicitamente.
  const densidadeMemoria = data?.config?.memoriaCalculoDensidade || "normal";
  const salvarDensidadeMemoria = nivel => update({ ...data, config: { ...(data.config || {}), memoriaCalculoDensidade: nivel } });
  const dSapatas = DENSIDADE_TABELA_SAPATAS[densidadeMemoria] || DENSIDADE_TABELA_SAPATAS.normal;

  // Largura de cada coluna é ajuste manual do usuário, canônico pra empresa
  // inteira (mesmo padrão de densidade) até ele mesmo trocar de novo - pedido
  // explícito depois de descobrir que o cabeçalho "nowrap" forçava largura
  // demais. Sem ajuste próprio, cai na largura padrão apertada da coluna.
  const larguraColunaSapatas = chave => Number(data?.config?.memoriaCalculoLargurasColuna?.[chave]) || COLUNAS_SAPATAS.find(c => c.chave === chave)?.largura || 50;
  const salvarLarguraColunaSapatas = (chave, valor) => update({
    ...data, config: { ...(data.config || {}), memoriaCalculoLargurasColuna: { ...(data.config?.memoriaCalculoLargurasColuna || {}), [chave]: Number(valor) || undefined } },
  });
  const [larguraColunasAberto, setLarguraColunasAberto] = useState(false);
  // Arrastar a borda direita do cabeçalho para redimensionar - pedido do
  // usuário depois que o painel numérico sozinho não pareceu "arrastável".
  // Só grava no canônico (data.config) ao soltar; enquanto arrasta, o valor
  // ao vivo mora neste state, sem disparar update() a cada pixel.
  const [colunaArrastando, setColunaArrastando] = useState(null); // {chave, largura}
  const arrastoColunaRef = useRef(null);
  const larguraColunaEfetiva = chave => colunaArrastando?.chave === chave ? colunaArrastando.largura : larguraColunaSapatas(chave);
  const iniciarArrastoColuna = (chave, e) => {
    e.preventDefault();
    const xInicial = e.clientX;
    const larguraInicial = larguraColunaSapatas(chave);
    arrastoColunaRef.current = { chave, xInicial, larguraInicial, larguraFinal: larguraInicial };
    const mover = ev => {
      if (!arrastoColunaRef.current) return;
      const nova = Math.max(24, Math.round(arrastoColunaRef.current.larguraInicial + (ev.clientX - arrastoColunaRef.current.xInicial)));
      arrastoColunaRef.current.larguraFinal = nova;
      setColunaArrastando({ chave, largura: nova });
    };
    const soltar = () => {
      if (arrastoColunaRef.current) salvarLarguraColunaSapatas(arrastoColunaRef.current.chave, arrastoColunaRef.current.larguraFinal);
      arrastoColunaRef.current = null;
      setColunaArrastando(null);
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  };

  // Vínculo entre um total da memória e uma linha do orçamento: guarda só o
  // id do item, a quantidade em si sempre vem recalculada na hora de
  // sincronizar - nunca fica "presa" num valor antigo.
  const vinculosFundacao = orc?.memoriaCalculo?.fundacao?.vinculos || {};
  const salvarVinculosFundacao = patch => salvarOrc({
    memoriaCalculo: { ...(orc?.memoriaCalculo || {}), fundacao: { ...(orc?.memoriaCalculo?.fundacao || {}), vinculos: { ...vinculosFundacao, ...patch } } },
  });
  const itensOrcamentoParaVincular = (orc?.itens || []).filter(it => it.tipo !== "titulo");
  const sugerirVinculosFundacao = () => {
    const sugestoes = {};
    TOTAIS_VINCULAVEIS_FUNDACAO.forEach(({ chave, palavras }) => {
      if (vinculosFundacao[chave]) return; // já vinculado - não propõe sobrescrever
      const achado = itensOrcamentoParaVincular.find(it => palavras.some(p => normalizarTexto(it.descricao || "").includes(normalizarTexto(p))));
      if (achado) sugestoes[chave] = achado.id;
    });
    if (!Object.keys(sugestoes).length) { showToast("Não encontrei nenhuma linha do orçamento parecida com os termos da fundação (escavação, concreto magro, fôrmas, sapata, reaterro, aço).","warn"); return; }
    salvarVinculosFundacao(sugestoes);
    showToast(`${Object.keys(sugestoes).length} vínculo(s) sugerido(s) - confira antes de sincronizar.`);
  };
  const sincronizarVinculosFundacao = () => {
    const totais = resumoSapatasFundacao.totais;
    const valorPorChave = {
      volumeEscavacao: totais.volumeEscavacao, areaConcretoMagro: totais.areaConcretoMagro, formaArea: totais.formaArea,
      volumeSapata: totais.volumeSapata, reaterro: totais.reaterro, pesoAco: totais.pesoAco,
    };
    const atualizacoes = new Map();
    TOTAIS_VINCULAVEIS_FUNDACAO.forEach(({ chave }) => {
      const itemId = vinculosFundacao[chave];
      if (itemId) atualizacoes.set(itemId, Number(valorPorChave[chave].toFixed(4)));
    });
    if (!atualizacoes.size) { showToast("Nenhum total vinculado ainda - escolha uma linha do orçamento para cada total antes de sincronizar.","warn"); return; }
    salvarOrc({ itens: (orc.itens || []).map(it => atualizacoes.has(it.id) ? { ...it, quantidade: atualizacoes.get(it.id) } : it) });
    showToast(`${atualizacoes.size} linha(s) do orçamento atualizada(s) com os totais da memória de cálculo.`);
  };
  // Editar um campo é o próprio sinal de "já revisei essa linha" - por isso
  // limpa precisaRevisar aqui, num único lugar, em vez de exigir um botão
  // separado de "marcar como revisado" (achado da crítica Impeccable).
  const atualizarSapataTipo = (id, patch) => salvarSapatasFundacao(sapatasFundacao.map(t => t.id === id ? { ...t, ...patch, precisaRevisar: false } : t));
  const duplicarSapataTipo = id => {
    const original = sapatasFundacao.find(t => t.id === id);
    if (!original) return;
    const indice = sapatasFundacao.indexOf(original);
    const copia = { ...original, id: uid(), tipo: original.tipo ? `${original.tipo} (cópia)` : "" };
    salvarSapatasFundacao([...sapatasFundacao.slice(0, indice + 1), copia, ...sapatasFundacao.slice(indice + 1)]);
  };

  // Excluir uma linha da memória de cálculo é reversível por alguns segundos
  // - mesmo padrão já usado para excluir um orçamento inteiro (desfazerDelOrc)
  // em vez de um modal de confirmação, que adicionaria fricção numa lista
  // que já é só um painel de referência (achado da crítica Impeccable).
  const [undoSapata, setUndoSapata] = useState(null); // {tipo, indice}
  const undoSapataTimeoutRef = useRef(null);
  const removerSapataTipo = id => {
    const indice = sapatasFundacao.findIndex(t => t.id === id);
    if (indice === -1) return;
    setUndoSapata({ tipo: sapatasFundacao[indice], indice });
    window.clearTimeout(undoSapataTimeoutRef.current);
    undoSapataTimeoutRef.current = window.setTimeout(() => setUndoSapata(null), 8000);
    salvarSapatasFundacao(sapatasFundacao.filter(t => t.id !== id));
  };
  const desfazerRemocaoSapata = () => {
    if (!undoSapata) return;
    window.clearTimeout(undoSapataTimeoutRef.current);
    const lista = [...sapatasFundacao];
    lista.splice(Math.min(undoSapata.indice, lista.length), 0, undoSapata.tipo);
    salvarSapatasFundacao(lista);
    setUndoSapata(null);
  };

  // Importação de projeto em PDF -> preenchimento automático da memória de
  // cálculo. Dois tipos de documento: "Projeto estrutural completo" lê o
  // Estrutural.pdf inteiro numa passada só - Fundação (sapatas), Pilares,
  // Vigas e Laje dos três pavimentos, já que é o MESMO arquivo e o usuário
  // não deveria precisar subi-lo mais de uma vez (achado real, 27/08/2026:
  // antes eram duas opções separadas, forçando dois uploads do mesmo PDF -
  // e cada aplicação SOMAVA na lista existente em vez de substituir,
  // duplicando cada sapata/pilar a cada reimportação). "Quantitativos de
  // superfícies e volumes" continua à parte - é um PDF de verdade
  // diferente, gerado separadamente pelo mesmo software CAD.
  //
  // Reimportar agora SOBRESCREVE (nunca soma): a lista de sapatas/pilares
  // de cada pavimento é substituída pela extração fresca do PDF, e viga/
  // laje/aço por bitola são substituídos campo a campo - reimportar depois
  // de corrigir algo no projeto corrige a memória de cálculo também, sem
  // deixar linha antiga duplicada pra trás.
  const [pdfTipoDocumento, setPdfTipoDocumento] = useState("estrutural-completo");
  const [pdfArrastando, setPdfArrastando] = useState(false);
  const [pdfProcessando, setPdfProcessando] = useState(false);
  const [pdfAviso, setPdfAviso] = useState("");
  const [pdfPreviewCompleto, setPdfPreviewCompleto] = useState(null); // sapatas + pilares + aço, por pavimento
  const [pdfPreviewQuantitativos, setPdfPreviewQuantitativos] = useState(null); // array por pavimento
  // Achado do Impeccable (P0, 27/08/2026): aplicar o PDF sobrescreve sem
  // nenhuma confirmação, e o aviso de sobrescrita ficava dentro da mesma
  // caixa verde de "sucesso" do preview - a cor dizia "pode seguir" bem no
  // meio do único aviso que devia soar como alerta. Agora exige confirmar
  // num diálogo à parte, mostrando exatamente o que já existe e será
  // substituído.
  const [confirmarAplicarPdf, setConfirmarAplicarPdf] = useState(false);
  const [confirmarAplicarQuantitativos, setConfirmarAplicarQuantitativos] = useState(false);
  const lerPdfEmSegundoPlano = async (...args) => {
    const { lerTextoPdf } = await import("../ler-estrutural-pdf");
    return lerTextoPdf(...args);
  };
  const processarPdfProjeto = async arquivo => {
    if (!arquivo) return;
    setPdfProcessando(true); setPdfAviso(""); setPdfPreviewCompleto(null); setPdfPreviewQuantitativos(null);
    try {
      const texto = await lerPdfEmSegundoPlano(arquivo);
      if (pdfTipoDocumento === "quantitativos") {
        const achado = extrairQuantitativosPavimentos(texto);
        if (!achado.length) {
          setPdfAviso("Não encontrei nenhum \"Grupo de Pisos\" neste PDF. Confirme se é o arquivo de Quantitativos de superfícies e volumes.");
          return;
        }
        setPdfPreviewQuantitativos(achado);
        return;
      }
      // precisaRevisar sinaliza na tabela que essa linha veio de extração
      // automática e ainda não foi conferida - some assim que o usuário
      // mexe em qualquer campo dela (achado da crítica Impeccable: antes o
      // aviso de "confira" só existia num toast passageiro).
      const sapatas = extrairSapatasFundacao(texto);
      const resumoAcoSapatas = extrairResumoAco(texto);
      const elementos = extrairElementosEstruturais(texto);
      const total = sapatas.length + Object.values(elementos.pilares).reduce((s, l) => s + l.length, 0)
        + [elementos.pilaresAcoPorBitola, elementos.vigasAcoPorBitola, elementos.lajesAcoPorBitola]
          .reduce((s, porPav) => s + Object.values(porPav).filter(Boolean).length, 0);
      if (!total) {
        setPdfAviso("Não encontrei nem o \"QUADRO DE ELEMENTOS DE FUNDAÇÃO\" nem nenhuma folha \"Pilares/Vigas/Lajes do <pavimento>\" neste PDF. Confirme se é o projeto estrutural completo.");
        return;
      }
      setPdfPreviewCompleto({ sapatas, resumoAcoSapatas, ...elementos });
    } catch (error) {
      setPdfAviso(error?.message || "Não foi possível ler o PDF.");
    } finally {
      setPdfProcessando(false);
    }
  };

  // Achado do Impeccable (P0): antes de confirmar, mostra exatamente o que
  // já existe e vai ser substituído - não só "isso sobrescreve", mas O QUÊ.
  const descricaoSubstituicaoPdfCompleto = () => {
    if (!pdfPreviewCompleto) return "";
    const mc = orc?.memoriaCalculo || {};
    const partes = [];
    if (pdfPreviewCompleto.sapatas.length && mc.fundacao?.sapatas?.length) {
      partes.push(`Fundação já tem ${mc.fundacao.sapatas.length} tipo(s) de sapata`);
    }
    for (const [pav, label] of PAVIMENTOS_ESTRUTURA) {
      const existentes = [];
      if (mc[pav]?.pilar?.concretoM3 || mc[pav]?.pilar?.formaM2) existentes.push("pilares");
      if (mc[pav]?.viga?.concretoM3 || mc[pav]?.viga?.formaM2) existentes.push("vigas");
      if (mc[pav]?.laje?.volumeM3) existentes.push("laje");
      const trazNesteImport = pdfPreviewCompleto.pilares[pav]?.length || pdfPreviewCompleto.pilaresAcoPorBitola[pav]
        || pdfPreviewCompleto.vigasAcoPorBitola[pav] || pdfPreviewCompleto.lajesAcoPorBitola[pav];
      if (existentes.length && trazNesteImport) partes.push(`${label} já tem ${existentes.join("/")} preenchido(s)`);
    }
    if (!partes.length) return "Nenhum dado anterior será perdido - esses pavimentos ainda estão vazios na memória de cálculo.";
    return `${partes.join("; ")} - tudo isso será substituído pelo que este PDF trouxer. Não tem como desfazer depois de aplicar.`;
  };
  const aplicarPdfPreviewCompleto = () => {
    if (!pdfPreviewCompleto) return;
    const memoriaAtual = orc?.memoriaCalculo || {};
    const memoriaNova = { ...memoriaAtual };

    if (pdfPreviewCompleto.sapatas.length) {
      memoriaNova.fundacao = {
        ...(memoriaAtual.fundacao || {}),
        sapatas: pdfPreviewCompleto.sapatas.map(sapata => ({
          ...novaSapataTipo({ folgaEscavacao: padraoEscavacaoFundacao.folga, profundidadeEscavacao: padraoEscavacaoFundacao.profundidade }),
          ...sapata, id: uid(), precisaRevisar: true,
        })),
      };
    }

    let pavimentosAtualizados = 0, bitolasAtualizadas = 0;
    for (const pav of ["terreo", "pavimento1", "cobertura"]) {
      const pavAtual = memoriaAtual[pav] || {};
      const encontrados = pdfPreviewCompleto.pilares[pav] || [];
      const acoPilares = pdfPreviewCompleto.pilaresAcoPorBitola[pav];
      const acoVigas = pdfPreviewCompleto.vigasAcoPorBitola[pav];
      const acoLaje = pdfPreviewCompleto.lajesAcoPorBitola[pav];
      [acoPilares, acoVigas, acoLaje].forEach(a => { if (a) bitolasAtualizadas += 1; });
      if (!encontrados.length && !acoPilares && !acoVigas && !acoLaje) continue; // pavimento ausente desta folha - preserva o que já tinha
      pavimentosAtualizados += 1;
      // O orçamento só usa concreto/fôrma de pilares como total do pavimento
      // (nunca por pilar) - soma os tipos que o PDF detalha na hora de
      // aplicar, em vez de guardar cada um (achado real, 27/08/2026).
      // Arredonda pra 2 casas na soma - sem isso, ponto flutuante deixa lixo
      // tipo "2.5100000000000002" salvo direto no campo (achado real, print
      // do usuário em produção, 28/08/2026).
      const arred2 = n => Math.round(n * 100) / 100;
      const concretoPilares = arred2(encontrados.reduce((s, p) => s + Number(p.concretoUnit || 0) * Number(p.qtd || 0), 0));
      const formaPilares = arred2(encontrados.reduce((s, p) => s + Number(p.formaUnit || 0) * Number(p.qtd || 0), 0));
      memoriaNova[pav] = {
        ...pavAtual,
        ...(encontrados.length ? { pilar: { ...novaPilarPavimento(), ...(pavAtual.pilar || {}), concretoM3: concretoPilares, formaM2: formaPilares, ...(acoPilares ? { acoPorBitola: acoPilares.porBitola.map(b => ({ bitola: b.bitola, kg: b.pesoKg })) } : {}), precisaRevisar: true } } : {}),
        ...(acoPilares && !encontrados.length ? { pilar: { ...novaPilarPavimento(), ...(pavAtual.pilar || {}), acoPorBitola: acoPilares.porBitola.map(b => ({ bitola: b.bitola, kg: b.pesoKg })) } } : {}),
        ...(acoVigas ? { viga: { ...novaVigaPavimento(), ...(pavAtual.viga || {}), acoPorBitola: acoVigas.porBitola.map(b => ({ bitola: b.bitola, kg: b.pesoKg })) } } : {}),
        ...(acoLaje ? { laje: { ...novaLajePavimento(), ...(pavAtual.laje || {}), acoPorBitola: acoLaje.porBitola.map(b => ({ bitola: b.bitola, kg: b.pesoKg })) } } : {}),
      };
    }
    salvarOrc({ memoriaCalculo: memoriaNova });
    showToast(`Fundação (${pdfPreviewCompleto.sapatas.length} tipo(s) de sapata) e ${pavimentosAtualizados} pavimento(s) de Pilares/Vigas/Laje importados - reimportar sempre substitui a versão anterior, nunca duplica.`);
    setPdfPreviewCompleto(null);
  };

  const descricaoSubstituicaoQuantitativos = () => {
    if (!pdfPreviewQuantitativos?.length) return "";
    const mc = orc?.memoriaCalculo || {};
    const pavimentosComDado = pdfPreviewQuantitativos
      .map(grupo => ({ grupo, pav: CHAVE_PAVIMENTO[grupo.pavimento] }))
      .filter(({ pav }) => pav && (mc[pav]?.viga?.concretoM3 || mc[pav]?.viga?.formaM2 || mc[pav]?.laje?.volumeM3))
      .map(({ grupo }) => grupo.pavimento);
    if (!pavimentosComDado.length) return "Nenhum dado anterior será perdido - esses pavimentos ainda estão vazios na memória de cálculo.";
    return `${pavimentosComDado.join(", ")} já ${pavimentosComDado.length > 1 ? "têm" : "tem"} concreto/fôrma de vigas ou volume de laje preenchidos - serão substituídos pelo que este PDF trouxer. Não tem como desfazer depois de aplicar.`;
  };
  const aplicarPdfPreviewQuantitativos = () => {
    if (!pdfPreviewQuantitativos?.length) return;
    const memoriaAtual = orc?.memoriaCalculo || {};
    const memoriaNova = { ...memoriaAtual };
    let atualizados = 0;
    for (const grupo of pdfPreviewQuantitativos) {
      const pav = CHAVE_PAVIMENTO[grupo.pavimento];
      if (!pav) continue;
      const pavAtual = memoriaAtual[pav] || {};
      memoriaNova[pav] = {
        ...pavAtual,
        viga: {
          ...novaVigaPavimento(), ...(pavAtual.viga || {}),
          concretoM3: grupo.concretoVigasM3 ?? 0, formaM2: grupo.formaVigasM2 ?? 0,
          areaPlantaVigasM2: grupo.areaPlantaVigasM2 ?? 0,
          avisoConcretoIncorreto: grupo.avisoConcretoIncorreto,
        },
        laje: {
          ...novaLajePavimento(), ...(pavAtual.laje || {}),
          volumeM3: grupo.volumeLajesM3 ?? 0, volumeMacicasM3: grupo.lajeMacicasM3 ?? 0, volumeVigotasM3: grupo.lajeVigotasM3 ?? 0,
        },
      };
      atualizados += 1;
    }
    salvarOrc({ memoriaCalculo: memoriaNova });
    showToast(`Concreto/fôrma de vigas e volume de laje de ${atualizados} pavimento(s) importados do PDF de Quantitativos.`);
    setPdfPreviewQuantitativos(null);
  };

  // Folga/profundidade de escavação são convenção de obra, não do projeto -
  // o mesmo padrão costuma valer para a fundação inteira. Em vez de editar
  // linha por linha, o operador ajusta aqui uma vez e aplica a todas -
  // e o padrão em si fica salvo no orçamento (padraoEscavacaoFundacao acima).
  const aplicarPadraoEscavacaoATodos = () => {
    if (!sapatasFundacao.length) return;
    const folga = Number(padraoEscavacaoFundacao.folga) || 0;
    const profundidade = Number(padraoEscavacaoFundacao.profundidade) || 0;
    salvarSapatasFundacao(sapatasFundacao.map(t => ({ ...t, folgaEscavacao: folga, profundidadeEscavacao: profundidade, precisaRevisar: false })));
    showToast(`Folga de ${folga}m e profundidade de ${profundidade}m aplicadas a ${sapatasFundacao.length} tipo(s).`);
  };

  const salvarRevisaoChecklist=()=>{
    if(!checkEdit)return;
    if(checkEdit.status==="ignorado"&&!String(checkEdit.observacao||"").trim()){showToast("Explique por que este item será ignorado.","error");return;}
    const registro={...checkEdit,observacao:String(checkEdit.observacao||"").trim(),atualizadoEm:new Date().toISOString(),atualizadoPor:currentUser?.nome||currentUser?.email||"Operador"};
    const existentes=orc?.auditoriaChecklist||[];
    const auditoriaChecklist=existentes.some(item=>item.id===registro.id)?existentes.map(item=>item.id===registro.id?registro:item):[...existentes,registro];
    salvarOrc({auditoriaChecklist});setCheckEdit(null);showToast(registro.status==="corrigido"?"Item marcado como corrigido.":registro.status==="ignorado"?"Item ignorado com justificativa.":"Item mantido como pendente.");
  };

  const salvarOrcAssincrono = patch => {
    if (budgetIsImmutable(orc)) { showToast("Esta versão está aprovada e imutável. Crie uma revisão para alterá-la.","warn"); return; }
    const atual = dataAtualRef.current;
    const lista = atual.orcamentos || [];
    scrollAlvoRef.current = window.scrollY;
    update({...atual, orcamentos:lista.map(item => item.id===selOrc ? {...item,...patch,updatedAt:new Date().toISOString()} : item)});
  };

  const criarRevisaoOrc = () => {
    if (!orc) return;
    const agora=new Date().toISOString(), id=uid();
    const revisao=createBudgetRevision(orc,{id,versionId:id,now:agora,actorId:currentUser?.id||"",actorName:currentUser?.nome||currentUser?.email||""});
    update({...data,orcamentos:[...todosOrcamentos,revisao]});
    setSelOrc(id); setView("editor");
    showToast(`Revisão V${revisao.versionNumber} criada. A versão aprovada foi preservada.`);
  };
  const aprovarEAdotarBaseline = (budgetId=selOrc) => {
    if (!ehAdmin) { showToast("Somente o administrador pode aprovar e trocar a baseline.","error"); return; }
    const resultado=adoptBudgetBaseline(data,budgetId,{id:uid(),now:new Date().toISOString(),actorId:currentUser?.id||"",actorName:currentUser?.nome||currentUser?.email||"",purpose:"controle"});
    if (!resultado.ok) { showToast(resultado.reason||"Não foi possível aprovar o orçamento.","error"); return; }
    update(resultado.data);
    showToast("Versão aprovada e adotada como baseline da obra. Ela agora é imutável.");
  };

  const recalcularFonteOrc = (ids, bases=basesRemotas) => {
    const fontes = new Set(bases.filter(base => ids.includes(base.id)).map(base => base.fonte));
    return fontes.has("SINAPI") && fontes.has("ORSE") ? "MISTO" : fontes.has("ORSE") ? "ORSE" : "SINAPI";
  };
  const vincularBaseExistente = () => {
    if (!orc || !baseParaVincular) return;
    const ids = [...new Set([...(orc.referencias || []), baseParaVincular])];
    const base = basesRemotas.find(item => item.id === baseParaVincular);
    salvarOrc({ referencias:ids, fonte:recalcularFonteOrc(ids),
      ...(base?.fonte === "SINAPI" ? {uf:base.uf || orc.uf, dataBase:base.dataBase || orc.dataBase} : {}) });
    setBaseParaVincular(""); showToast("Base vinculada ao orçamento.");
  };
  const desvincularBase = base => {
    if (!orc) return;
    if (!ehAdmin) { showToast("Somente o administrador pode alterar os vínculos das bases.", "error"); return; }
    const equivalentes = new Set(base?.idsEquivalentes || [base?.id]);
    const ids = (orc.referencias || []).filter(id => !equivalentes.has(id));
    salvarOrc({ referencias:ids, fonte:recalcularFonteOrc(ids) });
    showToast("Base desvinculada deste orçamento.");
  };
  // Cadastro e exclusão de bases agora são exclusivos do administrador, em
  // src/domains/administracao/components/BasesPrecoAdmin.jsx.

  const normalizarCodigoRef = valor => String(valor || "").trim().toUpperCase()
    .replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i, "").replace(/\.0$/, "")
    .replace(/^0+(?=\d)/, "");

  // A Curva ABC nao depende das tabelas analiticas adicionais do Supabase.
  // Quando a base remota nao possui o detalhamento, cada composicao do proprio
  // orcamento entra como uma linha consolidada. Assim o total e a classificacao
  // ABC continuam utilizaveis, sem migracao de banco e sem apagar informacoes.
  const completarDetalhesLocalmente = (remotos = []) => {
    if (!orc) return remotos;
    const resultado=[...remotos];
    const cobertos=new Set(remotos.map(item=>`${String(item.fonte||"SINAPI").toUpperCase()}|${normalizarCodigoRef(item.compositionCode)}`));
    const adicionados=new Set();
    (orc.itens||[]).filter(item=>item.tipo!=="titulo"&&Number(item.quantidade)>0).forEach(item=>{
      const fonte=String(item.fonte||orc.fonte||"SINAPI").toUpperCase();
      const codigo=normalizarCodigoRef(item.codigo);
      const chave=`${fonte}|${codigo}`;
      if(!codigo||cobertos.has(chave)||adicionados.has(chave)||/^(EXTERNO|COTA[CÇ][AÃ]O|PR[ÓO]PRIA)$/.test(fonte))return;
      adicionados.add(chave);
      // Sem base analitica nao da para abrir a composicao nos insumos dela.
      // Ela entra inteira, e marcada como COMPOSICAO - chamar isso de insumo
      // era o que misturava as duas curvas.
      resultado.push({fonte,compositionCode:codigo,itemType:"COMPOSICAO",itemCode:codigo,
        descricao:item.descricao||`ITEM ${codigo}`,unidade:item.unidade||"UN",coeficiente:1,
        precoUnit:Number(item.precoUnit||0),precoDes:Number(item.precoUnit||0),precoNao:Number(item.precoUnit||0),
        classificacao:"COMPOSIÇÃO CONSOLIDADA DO ORÇAMENTO",fallbackLocal:true});
    });
    return resultado;
  };

  const aplicarReferencia = (item, ref, orcAtual = orc) => {
    const preco = precoDoItem(ref, orcAtual);
    return {
      ...item,
      codigo:ref.codigo || item.codigo,
      fonte:ref.fonte || item.fonte || orcAtual.fonte,
      descricao:ref.descricao || item.descricao,
      unidade:ref.unidade || item.unidade || "UN",
      precoUnit:preco,
      precoRef:preco,   // referencia oficial - base para detectar edicao manual
      composicao:ref.composicao || item.composicao || "",
      codigoNaoEncontrado:false,
      baseData:ref.dataBase || item.baseData || orcAtual.dataBase || "",
      baseUf:ref.uf || item.baseUf || "",
      detailUrl:ref.detailUrl || item.detailUrl || "",
    };
  };

  const carregarDetalhesComposicoes = async () => {
    if(!orc)return;
    const entries=(orc.itens||[]).filter(item=>item.tipo!=="titulo"&&normalizarCodigoRef(item.codigo)
      && !/^(EXTERNO|COTA[CÇ][AÃ]O|PR[ÓO]PRIA)$/.test(String(item.fonte||"").toUpperCase()))
      .map(item=>({codigo:normalizarCodigoRef(item.codigo),fonte:item.fonte||""}));
    if(!entries.length){setComponentesDetalhados([]);setDetalhesAviso("Não há composições oficiais codificadas neste orçamento.");return;}
    if(!(orc.referencias||[]).length){
      setComponentesDetalhados(completarDetalhesLocalmente([]));
      setDetalhesAviso("Curva calculada pelos itens do orçamento. Vincular uma base analítica é opcional e serve apenas para abrir cada composição em seus insumos.");
      return;
    }
    setDetalhesLoading(true);setDetalhesAviso("");
    try{
      const componentes=[];
      let diagnostico=null;
      for(let i=0;i<entries.length;i+=100){
        const resposta=await detalharComposicoesReferencia(orc.referencias,entries.slice(i,i+100));
        if(!resposta.ok)throw new Error(resposta.error||"Falha ao detalhar composições.");
        componentes.push(...(resposta.components||[]));
        diagnostico=resposta.diagnostics||diagnostico;
        if(resposta.warning)setDetalhesAviso(resposta.warning);
      }
      const vistos=new Set();
      const remotos=componentes.filter(item=>{
        const chave=`${item.fonte}|${item.compositionCode}|${item.itemType}|${item.itemCode}`;
        if(vistos.has(chave))return false;vistos.add(chave);return true;
      });
      const completos=completarDetalhesLocalmente(remotos);
      setComponentesDetalhados(completos);
      if(completos.some(item=>item.fallbackLocal))setDetalhesAviso(remotos.length
        ? "Parte das composições não possui analítico; esses itens foram consolidados diretamente pelo orçamento."
        : `Nenhuma relação analítica foi encontrada nas ${(diagnostico?.linkedBases||orc.referencias.length)} base(s) vinculada(s). A Curva ABC foi preservada com os itens consolidados do orçamento.`);
    }catch(error){
      setComponentesDetalhados(completarDetalhesLocalmente([]));
      const mensagem=String(error?.message||"");
      setDetalhesAviso(/schema|budget_reference|estrutura anal/i.test(mensagem)
        ? "Supabase sem estrutura analítica. Execute MIGRACAO_REFERENCIAS_ANALITICAS.sql no SQL Editor e reenvie a planilha SINAPI para gravar insumos e composições."
        : "A consulta analítica está temporariamente indisponível. A Curva ABC foi calculada pelos itens do orçamento.");
    }
    finally{setDetalhesLoading(false);}
  };

  const abcInsumos = useMemo(()=>{
    // Mesmo formato do retorno normal: quem consome (abcInsumosCurva) espalha
    // `linhas`, e um objeto com a forma errada aqui derruba a tela inteira.
    if(!orc)return{linhas:[],total:0,totalInsumos:0,qtdInsumos:0,qtdComposicoes:0,semDetalhe:[],semPreco:[]};
    const relacoes=[...componentesDetalhados.map(item=>({...item,
      fonte:String(item.fonte||"SINAPI").toUpperCase(),compositionCode:normalizarCodigoRef(item.compositionCode),
      itemCode:normalizarCodigoRef(item.itemCode),precoUnit:Number(item.precoUnit||precoDoItem(item,orc)||0)}))];
    composicoesEmpresa.forEach(comp=>(comp.itens||[]).forEach(item=>relacoes.push({
      fonte:"PRÓPRIA",compositionCode:normalizarCodigoRef(comp.codigo),itemType:item.tipoItem||"INSUMO",
      itemCode:normalizarCodigoRef(item.codigo),itemFonte:String(item.fonte||"SINAPI").toUpperCase(),
      descricao:item.descricao,unidade:item.unidade,coeficiente:Number(item.coeficiente||0),precoUnit:Number(item.precoUnit||0),
      classificacao:"COMPOSIÇÃO PRÓPRIA",
    })));
    const porComposicao=new Map();
    relacoes.forEach(rel=>{
      const chave=`${rel.fonte}|${rel.compositionCode}`;
      if(!porComposicao.has(chave))porComposicao.set(chave,[]);
      porComposicao.get(chave).push(rel);
    });
    const mapa=new Map(),semDetalhe=new Set(),semPreco=new Set();
    const acumular=(fonte,codigo,fator,caminho=new Set(),profundidade=0)=>{
      const chave=`${fonte}|${codigo}`;
      if(caminho.has(chave)||profundidade>14)return;
      const filhos=porComposicao.get(chave)||[];
      if(!filhos.length){semDetalhe.add(chave);return;}
      const novoCaminho=new Set(caminho);novoCaminho.add(chave);
      filhos.forEach(rel=>{
        const qtd=fator*Number(rel.coeficiente||0);
        if(!(qtd>0))return;
        const fonteItem=String(rel.itemFonte||rel.fonte||fonte).toUpperCase();
        const chaveFilho=`${fonteItem}|${rel.itemCode}`;
        const tipo=rel.itemType==="COMPOSICAO"?"COMPOSICAO":"INSUMO";
        // So descemos numa sub-composicao quando ela existe na base analitica,
        // nao aponta para si mesma (o caso da linha consolidada) e nao fecha
        // um ciclo. Sem isso, a composicao consolidada sumia da curva.
        const abrivel = tipo==="COMPOSICAO" && chaveFilho!==chave
          && !novoCaminho.has(chaveFilho) && porComposicao.has(chaveFilho);
        if(abrivel){ acumular(fonteItem,rel.itemCode,qtd,novoCaminho,profundidade+1); return; }
        // Folha. Uma composicao que chega ate aqui e uma composicao que a base
        // nao sabe abrir - ela continua sendo COMPOSICAO na curva, nunca insumo.
        if(tipo==="COMPOSICAO")semDetalhe.add(chaveFilho);
        const key=`${tipo}|${fonteItem}|${rel.itemCode}|${rel.unidade||"UN"}`;
        const atual=mapa.get(key)||{tipo,fonte:fonteItem,codigo:rel.itemCode,descricao:rel.descricao||"",
          unidade:rel.unidade||"UN",classificacao:rel.classificacao||"",quantidade:0,precoUnit:Number(rel.precoUnit||0)};
        atual.quantidade+=qtd;
        if(!atual.precoUnit&&Number(rel.precoUnit)>0)atual.precoUnit=Number(rel.precoUnit);
        mapa.set(key,atual);
        if(!(atual.precoUnit>0))semPreco.add(`${fonteItem} ${rel.itemCode}`);
      });
    };
    (orc.itens||[]).filter(item=>item.tipo!=="titulo"&&Number(item.quantidade)>0).forEach(item=>{
      const fonte=/^PR[ÓO]PRIA$/.test(String(item.fonte||"").toUpperCase())?"PRÓPRIA":String(item.fonte||orc.fonte||"SINAPI").toUpperCase();
      if(/^(EXTERNO|COTA[CÇ][AÃ]O)$/.test(fonte))return;
      acumular(fonte,normalizarCodigoRef(item.codigo),Number(item.quantidade));
    });
    const linhas=[...mapa.values()].map(item=>({...item,custo:item.quantidade*item.precoUnit}));
    return{linhas,
      total:linhas.reduce((s,item)=>s+item.custo,0),
      totalInsumos:linhas.filter(l=>l.tipo==="INSUMO").reduce((s,item)=>s+item.custo,0),
      qtdInsumos:linhas.filter(l=>l.tipo==="INSUMO").length,
      qtdComposicoes:linhas.filter(l=>l.tipo==="COMPOSICAO").length,
      semDetalhe:[...semDetalhe],semPreco:[...semPreco]};
  },[orc,componentesDetalhados,composicoesEmpresa]);

  // Quais fontes ficaram sem detalhamento analitico. Sem isso, a composicao
  // consolidada some no meio da lista e a tela parece ter "perdido" uma base.
  const naoAbertasPorFonte = useMemo(()=>{
    const mapa=new Map();
    abcInsumos.linhas.filter(linha=>linha.tipo==="COMPOSICAO").forEach(linha=>{
      const atual=mapa.get(linha.fonte)||{fonte:linha.fonte,qtd:0,custo:0};
      atual.qtd+=1;atual.custo+=linha.custo;mapa.set(linha.fonte,atual);
    });
    return [...mapa.values()].sort((a,b)=>b.custo-a.custo);
  },[abcInsumos]);

  // Cada composicao que a base nao abriu, para o alerta acionavel poder dizer
  // QUAL codigo falta documentar - nao so quantas faltam por fonte. Ordenada
  // por custo: a composicao que mais pesa no orcamento e a mais urgente de
  // documentar (buscar/importar a analitica correspondente).
  const composicoesNaoDocumentadas = useMemo(()=>
    abcInsumos.linhas.filter(l=>l.tipo==="COMPOSICAO").sort((a,b)=>b.custo-a.custo),
  [abcInsumos]);

  // A curva e recalculada dentro da familia escolhida. Misturar insumo com
  // composicao nao detalhada inflaria o total e jogaria insumo legitimo para a
  // classe C por comparacao com um servico inteiro - a curva perde o sentido.
  const abcInsumosCurva = useMemo(()=>{
    const linhas=[...abcInsumos.linhas]
      .filter(l=>abcInsumoTipo==="TODOS"||l.tipo===abcInsumoTipo)
      .sort((a,b)=>b.custo-a.custo);
    const total=linhas.reduce((s,item)=>s+item.custo,0);let acumulado=0;
    const itens=linhas.map((item,index)=>{
      const pct=total>0?item.custo/total*100:0;
      const classe=acumulado<80?"A":acumulado<95?"B":"C";
      acumulado+=pct;
      return{...item,ordem:index+1,pct,pctAcum:Math.min(100,acumulado),classe};
    });
    return{itens,total};
  },[abcInsumos,abcInsumoTipo]);

  useEffect(()=>{
    if(orcAba==="insumos"&&orc&&componentesDetalhados.length===0&&!detalhesLoading)carregarDetalhesComposicoes();
  },[orcAba,selOrc,referenciaKey]);

  // Codigo automatico: toda composicao nova ja nasce numerada. So no momento em
  // que o formulario e zerado - nunca durante a digitacao, senao apagar o campo
  // para escrever um codigo proprio viraria uma briga com o preenchimento.
  const novaComposicao = useCallback((extra={}) =>
    setCompForm(compFormVazio({codigo:proximoCodigoProprio(), ...extra})), [proximoCodigoProprio]);

  useEffect(()=>{
    if(orcAba!=="proprias")return;
    setCompForm(form => (form.id || String(form.codigo||"").trim())
      ? form : compFormVazio({codigo:proximoCodigoProprio()}));
  },[orcAba,proximoCodigoProprio]);

  const custoCompForm=useMemo(()=>(compForm.itens||[]).reduce((s,item)=>s+Number(item.coeficiente||0)*Number(item.precoUnit||0),0),[compForm.itens]);

  const adicionarItemComposicao = referencia => {
    const chave=`${referencia.fonte}|${referencia.codigo}|${referencia.tipoItem||"INSUMO"}`;
    if((compForm.itens||[]).some(item=>item.id!==compItemSubstituirId&&`${item.fonte}|${item.codigo}|${item.tipoItem}`===chave)){showToast("Este item já está na composição.","warn");return;}
    const novo={id:uid(),fonte:referencia.fonte||"SINAPI",
      tipoItem:referencia.tipoItem||"INSUMO",codigo:referencia.codigo,descricao:referencia.descricao,
      unidade:referencia.unidade||"UN",coeficiente:1,precoUnit:precoDoItem(referencia,orc),dataBase:referencia.dataBase||"",uf:referencia.uf||""};
    setCompForm(form=>({...form,itens:compItemSubstituirId
      ?(form.itens||[]).map(item=>item.id===compItemSubstituirId?{...novo,id:item.id,coeficiente:item.coeficiente}:item)
      :[...(form.itens||[]),novo]}));
    showToast(compItemSubstituirId?"Insumo substituído na composição.":"Insumo adicionado.");
    setCompItemSubstituirId("");setCompBusca("");setCompResultados([]);
  };

  const criarInsumoDaBusca = async () => {
    const descricao=maiusculoOrcamento(compBusca).trim();
    if(!descricao){showToast("Digite a descrição do novo insumo.","error");return;}
    const existente=(data.materiais||[]).find(item=>maiusculoOrcamento(item.descricao).trim()===descricao);
    if(existente){showToast(`O insumo ${existente.codigo} já está cadastrado.`,"warn");return;}
    if(!window.confirm(`Deseja realmente criar o insumo “${descricao}” no cadastro da empresa?`))return;
    const unidade=maiusculoOrcamento(window.prompt("Informe a unidade do insumo:","UN")||"").trim();
    if(!unidade){showToast("Criação cancelada: informe uma unidade.","error");return;}
    const precoTexto=window.prompt("Informe o preço unitário inicial (pode ser alterado depois):","0");
    if(precoTexto===null)return;
    const preco=Number(String(precoTexto).replace(/\./g,"").replace(",","."));
    if(!Number.isFinite(preco)||preco<0){showToast("Informe um preço unitário válido.","error");return;}
    const material={id:uid(),codigo:proximoCodigoArcd(data),descricao,unidade:unidade.toLowerCase(),categoria:"outros",estoqueMin:0,precoMedio:preco,ativo:true};
    const result=await update({...data,materiais:[...(data.materiais||[]),material]});
    if(!result?.ok){showToast(result?.reason||"O insumo não foi confirmado pelo servidor.","error");return;}
    adicionarItemComposicao({fonte:"PRÓPRIA",tipoItem:"INSUMO",codigo:material.codigo,descricao,unidade,precoUnit:preco});
    showToast(`Insumo ${material.codigo} criado e incluído na composição.`);
  };

  const analisarItemReferencia = async referencia => {
    setAnaliseReferencia(referencia);
    setAnaliseComponentes([]);
    setAnaliseReferenciaAviso("");
    if(referencia?.tipoItem!=="COMPOSICAO")return;
    if(!(orc?.referencias||[]).length){
      setAnaliseReferenciaAviso("Vincule uma base ao orçamento para abrir a composição.");return;
    }
    setAnaliseReferenciaLoading(true);
    try{
      const resposta=await detalharComposicoesReferencia(orc.referencias,[{codigo:referencia.codigo,fonte:referencia.fonte}]);
      if(!resposta.ok)throw new Error(resposta.error||"Não foi possível analisar esta composição.");
      const codigo=normalizarCodigoRef(referencia.codigo);
      const fonte=String(referencia.fonte||"").toUpperCase();
      const diretos=(resposta.components||[]).filter(item=>
        normalizarCodigoRef(item.compositionCode)===codigo && String(item.fonte||"").toUpperCase()===fonte);
      setAnaliseComponentes(diretos);
      setAnaliseReferenciaAviso(resposta.warning||(!diretos.length
        ? "A composição foi encontrada, mas esta base ainda não possui seu detalhamento analítico. Reenvie a planilha SINAPI após executar a migração."
        : ""));
    }catch(error){
      setAnaliseReferenciaAviso(error?.message||"Não foi possível analisar esta composição.");
    }finally{setAnaliseReferenciaLoading(false);}
  };

  // Abre a composicao analitica de uma linha da planilha. A ordem de busca
  // segue a confiabilidade da fonte: composicao propria da empresa primeiro
  // (ela e a verdade para itens PRÓPRIA), depois a memoria gravada no proprio
  // item (cotacao/externo) e por fim a base de referencia vinculada.
  const analisarItemDoOrcamento = async item => {
    if (!orc) return;
    const fonte  = String(item.fonte || orc.fonte || "SINAPI").toUpperCase();
    const codigo = normalizarCodigoRef(item.codigo);
    const preco  = Number(item.precoUnit || 0);
    const base = {
      fonte, codigo: item.codigo || "", descricao: item.descricao || "",
      unidade: item.unidade || "UN", tipoItem: "COMPOSICAO",
      precoUnit: preco, precoDes: preco, precoNao: preco,
      dataBase: item.baseData || orc.dataBase || "", uf: item.baseUf || orc.uf || "",
      doOrcamento: true, quantidadeOrc: Number(item.quantidade || 0),
    };

    // 1) Composicao propria da empresa
    const propria = codigo && composicoesEmpresa.find(comp => normalizarCodigoRef(comp.codigo) === codigo);
    if (propria) {
      setAnaliseReferenciaAviso("");
      setAnaliseReferencia({ ...base, fonte: "PRÓPRIA", classificacao: "COMPOSIÇÃO DA EMPRESA",
        unidade: propria.unidade || base.unidade, descricao: propria.descricao || base.descricao });
      setAnaliseComponentes((propria.itens || []).map(sub => ({
        fonte: sub.fonte || "PRÓPRIA", itemType: sub.tipoItem || "INSUMO", itemCode: sub.codigo,
        descricao: sub.descricao, unidade: sub.unidade || "UN",
        coeficiente: Number(sub.coeficiente || 0), precoUnit: Number(sub.precoUnit || 0),
      })));
      return;
    }

    // 2) Memoria gravada no item: JSON (clone de composicao) ou texto livre
    const memoria = String(item.composicao || "").trim();
    if (memoria.startsWith("[")) {
      try {
        const itens = JSON.parse(memoria);
        if (Array.isArray(itens) && itens.length) {
          setAnaliseReferenciaAviso("");
          setAnaliseReferencia({ ...base, classificacao: "MEMÓRIA GRAVADA NO ITEM" });
          setAnaliseComponentes(itens.map(sub => ({
            fonte: sub.fonte || fonte, itemType: sub.tipoItem || "INSUMO", itemCode: sub.codigo,
            descricao: sub.descricao, unidade: sub.unidade || "UN",
            coeficiente: Number(sub.coeficiente || 0), precoUnit: Number(sub.precoUnit || 0),
          })));
          return;
        }
      } catch { /* nao era JSON: cai para o texto livre abaixo */ }
    }
    if (memoria && /^(EXTERNO|COTA[CÇ][AÃ]O)$/.test(fonte)) {
      setAnaliseComponentes([]);
      setAnaliseReferenciaAviso("");
      setAnaliseReferencia({ ...base, memoriaTexto: memoria, classificacao: "COTAÇÃO / COMPOSIÇÃO EXTERNA" });
      return;
    }

    // 3) Base de referencia
    if (!codigo) {
      setAnaliseComponentes([]);
      setAnaliseReferencia({ ...base, memoriaTexto: memoria });
      setAnaliseReferenciaAviso("Este item não tem código. Informe o código da base ou cadastre-o como composição própria para abrir a análise.");
      return;
    }
    await analisarItemReferencia(base);
  };

  const clonarComposicaoReferencia = async referencia => {
    if(!referencia||referencia.tipoItem!=="COMPOSICAO"||!orc)return;
    if(!(orc.referencias||[]).length){showToast("Vincule a base desta composição ao orçamento.","error");return;}
    setClonandoComposicao(`${referencia.fonte}|${referencia.codigo}`);
    try{
      const resposta=await detalharComposicoesReferencia(orc.referencias,[{codigo:referencia.codigo,fonte:referencia.fonte}]);
      if(!resposta.ok)throw new Error(resposta.error||"Não foi possível abrir a composição.");
      const codigoOrigem=normalizarCodigoRef(referencia.codigo);const fonte=String(referencia.fonte||"SINAPI").toUpperCase();
      const diretos=(resposta.components||[]).filter(item=>String(item.fonte||"").toUpperCase()===fonte&&normalizarCodigoRef(item.compositionCode)===codigoOrigem);
      if(!diretos.length)throw new Error("A base não devolveu os insumos desta composição. Atualize a base analítica.");
      // O codigo da copia segue a serie da empresa; a origem SINAPI/ORSE fica
      // registrada nos campos origem* e aparece no formulario.
      setCompForm(compFormVazio({codigo:proximoCodigoProprio(),descricao:referencia.descricao||"",unidade:referencia.unidade||"UN",
        origemFonte:fonte,origemCodigo:codigoOrigem,origemDataBase:referencia.dataBase||orc.dataBase||"",origemUf:referencia.uf||orc.uf||"",
        itens:diretos.map(item=>({id:uid(),fonte:item.fonte||fonte,tipoItem:item.itemType||"INSUMO",codigo:item.itemCode,
          descricao:item.descricao||"",unidade:item.unidade||"UN",coeficiente:Number(item.coeficiente||0),
          precoUnit:Number(item.precoUnit||precoDoItem(item,orc)||0),dataBase:item.dataBase||referencia.dataBase||"",uf:item.uf||referencia.uf||""}))}));
      setOrcAba("proprias");setCompTipoBusca("COMPOSICAO");
      setCompBusca("");setCompResultados([]);showToast(`Composição ${fonte} ${codigoOrigem} copiada com ${diretos.length} item(ns). Ajuste os coeficientes e salve.`);
    }catch(error){showToast(error?.message||"Não foi possível copiar a composição.","error");}
    finally{setClonandoComposicao("");}
  };

  const salvarComposicaoPropria = () => {
    const codigo=normalizarCodigoRef(compForm.codigo);const descricao=String(compForm.descricao||"").trim();
    if(!codigo||!descricao||!String(compForm.unidade||"").trim()){showToast("Informe código, descrição e unidade.","error");return;}
    if(!(compForm.itens||[]).length||compForm.itens.some(item=>!(Number(item.coeficiente)>0))){showToast("Adicione insumos com coeficientes válidos.","error");return;}
    const antiga=composicoesEmpresa.find(item=>item.id===compForm.id);
    const comp={...compForm,id:compForm.id||uid(),codigo,descricao,unidade:compForm.unidade,itens:compForm.itens};
    const comps=[...composicoesEmpresa.filter(item=>item.id!==comp.id),comp];
    const favoritos=(data.baseFavoritos||[]).filter(item=>!(String(item.fonte||"").toUpperCase()==="PRÓPRIA"&&
      (normalizarCodigoRef(item.codigo)===codigo||normalizarCodigoRef(item.codigo)===normalizarCodigoRef(antiga?.codigo))));
    favoritos.push({fonte:"PRÓPRIA",codigo,descricao,unidade:comp.unidade,precoUnit:custoCompForm,
      composicao:JSON.stringify(comp.itens),externa:true});
    const orcamentosAtualizados=todosOrcamentos.map(orçamento=>{
      const itens=(orçamento.itens||[]).map(item=>String(item.fonte||"").toUpperCase()==="PRÓPRIA"&&antiga&&normalizarCodigoRef(item.codigo)===normalizarCodigoRef(antiga.codigo)
        ?{...item,codigo,descricao,unidade:comp.unidade,precoUnit:custoCompForm,composicao:JSON.stringify(comp.itens)}:item);
      const defs=orçamento.id===selOrc?[...(orçamento.composicoesProprias||[]).filter(item=>item.id!==comp.id),comp]:(orçamento.composicoesProprias||[]);
      return{...orçamento,itens,composicoesProprias:defs};
    });
    update({...data,composicoesEmpresa:comps,baseFavoritos:favoritos,orcamentos:orcamentosAtualizados});
    novaComposicao();showToast("Composição salva no cadastro da empresa e disponível em todos os orçamentos.");
  };

  const excluirComposicaoPropria = comp => {
    if(!window.confirm(`Excluir a composição ${comp.codigo}?`))return;
    const comps=(data.composicoesEmpresa||[]).filter(item=>item.id!==comp.id);
    const favoritos=(data.baseFavoritos||[]).filter(item=>!(String(item.fonte||"").toUpperCase()==="PRÓPRIA"&&normalizarCodigoRef(item.codigo)===normalizarCodigoRef(comp.codigo)));
    update({...data,composicoesEmpresa:comps,baseFavoritos:favoritos,orcamentos:todosOrcamentos.map(item=>item.id===selOrc?{...item,composicoesProprias:(item.composicoesProprias||[]).filter(def=>def.id!==comp.id)}:item)});
    if(compForm.id===comp.id)novaComposicao();
  };

  const exportarABCInsumos = async () => {
    await carregarXLSX();
    if(!abcInsumosCurva.itens.length){showToast("Carregue os insumos antes de exportar.","warn");return;}
    const rows=abcInsumosCurva.itens.map(item=>({Classe:item.classe,Tipo:item.tipo==="COMPOSICAO"?"COMPOSIÇÃO":"INSUMO",Fonte:item.fonte,Código:item.codigo,Descrição:item.descricao,
      Unidade:item.unidade,Quantidade:item.quantidade,"Custo unitário":item.precoUnit,"Custo total":item.custo,
      "% item":item.pct/100,"% acumulado":item.pctAcum/100}));
    const ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=[7,12,10,12,55,9,14,15,16,11,13].map(w=>({wch:w}));
    const aba=abcInsumoTipo==="COMPOSICAO"?"ABC Composições":abcInsumoTipo==="TODOS"?"ABC Analítica":"ABC Insumos";
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,aba);await XLSX.writeFile(wb,`${aba.replace(/ /g,"_")}_${orc.nome}.xlsx`);
  };

  const abrirEdicaoOrc = () => {
    setForm({
      ...emptyOrc, ...orc,
      areaM2:String(orc.areaM2||""), bdi:String(orc.bdi??""),
    });
    setEditMetaModal(true);
  };

  const salvarDadosOrc = () => {
    if (!String(form.nome||"").trim()) { showToast("Informe o nome do orçamento.","error"); return; }
    salvarOrc({
      nome:String(form.nome).trim(), descricao:String(form.descricao||"").trim(),
      obraId:form.obraId||"", cliente:String(form.cliente||"").trim(), local:String(form.local||"").trim(),
      areaM2:parseBR(form.areaM2)||0, fonte:form.fonte||"SINAPI", uf:String(form.uf||"PE").trim().toUpperCase(),
      dataBase:String(form.dataBase||"").trim(), desonerado:form.desonerado!==false,
      bdi:parseBR(form.bdi)||0, status:form.status||orc.status||"rascunho",
    });
    setEditMetaModal(false);
    showToast("Dados do orçamento atualizados.");
  };

  const delOrc = (id) => {
    const alvo=todosOrcamentos.find(item=>item.id===id);
    if (budgetIsImmutable(alvo)||(data.budgetBaselines||[]).some(b=>b.budgetId===id&&b.ativo!==false)) { showToast("Versão aprovada ou baseline não pode ser excluída. Crie uma revisão ou adote outra baseline.","error"); return; }
    setConfirmDelOrc({ id, nome: alvo?.nome || "" });
  };
  const executarDelOrc = (id) => {
    const alvo = todosOrcamentos.find(o=>o.id===id);
    update({ ...data, orcamentos: todosOrcamentos.filter(o=>o.id!==id) });
    if (selOrc===id) { setSelOrc(null); setView("lista"); }
    setUndoOrc({ orc: alvo });
    window.clearTimeout(undoOrcTimeoutRef.current);
    undoOrcTimeoutRef.current = window.setTimeout(()=>setUndoOrc(null), 8000);
    showToast("Orçamento removido.");
  };
  const desfazerDelOrc = () => {
    if (!undoOrc) return;
    window.clearTimeout(undoOrcTimeoutRef.current);
    update({ ...data, orcamentos: [...(data.orcamentos||[]), undoOrc.orc] });
    setUndoOrc(null);
    showToast("Orçamento restaurado.");
  };

  //  Itens 
  const addItem = () => {
    if (!qtdModal || !orc) return;
    const q = Number(qtd);
    if (!q || q <= 0) { showToast("Informe uma quantidade válida.","error"); return; }

    const preco = precoDoItem(qtdModal, orc);
    if (!preco || preco <= 0) { showToast("Esta composição não tem preço na base.","error"); return; }

    const unidade = qtdModal.unidade || "UN";
    const novoItem = {
      id: uid(),
      etapaId:   etapaAlvo,
      tipo:      "item",
      codigo:    qtdModal.codigo,
      // fonte real da linha (SINAPI ou ORSE), não a fonte global do orçamento -
      // a planilha de referência traz as duas misturadas
      fonte:     qtdModal.fonte || orc.fonte,
      descricao: qtdModal.descricao,
      unidade,
      quantidade: q,
      precoUnit: preco,
      precoRef: preco,   // veio da base - referencia oficial da composicao
      composicao: qtdModal.composicao || "",
      baseData:qtdModal.dataBase || orc.dataBase || "",
      baseUf:qtdModal.uf || (qtdModal.fonte === "SINAPI" ? orc.uf : ""),
      detailUrl:qtdModal.detailUrl || "",
    };

    // Guarda na base de favoritos (já com o preço congelado)
    const favs = data.baseFavoritos || [];
    const jaFav = favs.some(f => f.codigo === qtdModal.codigo && (f.fonte || "SINAPI") === (qtdModal.fonte || "SINAPI"));
    const novosFavs = jaFav ? favs : [...favs, {
      codigo:    qtdModal.codigo,
      fonte:     qtdModal.fonte || orc.fonte,
      descricao: qtdModal.descricao,
      unidade,
      precoUnit: preco,
      baseData:qtdModal.dataBase || orc.dataBase || "",
      baseUf:qtdModal.uf || (qtdModal.fonte === "SINAPI" ? orc.uf : ""),
      detailUrl:qtdModal.detailUrl || "",
    }];

    update({
      ...data,
      baseFavoritos: novosFavs,
      orcamentos: todosOrcamentos.map(o => {
        if(o.id!==selOrc)return o;
        const propria=String(qtdModal.fonte||"").toUpperCase()==="PRÓPRIA"
          ?(data.composicoesEmpresa||[]).find(comp=>normalizarCodigoRef(comp.codigo)===normalizarCodigoRef(qtdModal.codigo)):null;
        const defs=propria&&!(o.composicoesProprias||[]).some(comp=>comp.id===propria.id)?[...(o.composicoesProprias||[]),propria]:(o.composicoesProprias||[]);
        return{...o,itens:[...o.itens,novoItem],composicoesProprias:defs};
      }),
    });
    setQtdModal(null); setQtd(""); setBusca("");
    showToast("Item adicionado ao orçamento.");
  };

  const abrirExterno = (etapaId) => {
    setEtapaAlvo(etapaId);
    setExternoForm({codigo:"",fonte:"EXTERNO",descricao:"",unidade:"UN",quantidade:"",precoUnit:"",composicao:""});
    setExternoModal(true);
  };

  const salvarExterno = () => {
    if (!orc) return;
    const descricao = String(externoForm.descricao||"").trim();
    const quantidade = parseBR(externoForm.quantidade)||0;
    const precoUnit = parseBR(externoForm.precoUnit)||0;
    if (!descricao) { showToast("Informe a descrição.","error"); return; }
    if (!(quantidade > 0)) { showToast("Informe uma quantidade válida.","error"); return; }
    if (!(precoUnit > 0)) { showToast("Informe o custo unitário da cotação/composição.","error"); return; }
    const codigo = String(externoForm.codigo||"").trim().toUpperCase();
    const item = {
      id:uid(), etapaId:etapaAlvo, tipo:"item", codigo,
      fonte:String(externoForm.fonte||"EXTERNO").trim(), descricao,
      unidade:String(externoForm.unidade||"UN").trim(), quantidade, precoUnit,
      precoRef:0,   // cotacao/externo nao tem base oficial - sem divergencia
      composicao:String(externoForm.composicao||"").trim(),
      codigoNaoEncontrado:!codigo,
    };
    const favoritos = data.baseFavoritos || [];
    const jaExiste = codigo && favoritos.some(f=>String(f.codigo||"").toUpperCase()===codigo);
    const novosFavoritos = codigo && !jaExiste ? [...favoritos, {
      codigo, fonte:item.fonte, descricao, unidade:item.unidade, precoUnit,
      composicao:item.composicao, externa:true,
    }] : favoritos;
    update({...data, baseFavoritos:novosFavoritos,
      orcamentos:todosOrcamentos.map(o=>o.id===selOrc?{...o,itens:[...o.itens,item]}:o)});
    setExternoModal(false);
    showToast("Composição externa/cotação adicionada.");
  };

  const updItemQtd = (itemId, novaQtd) => {
    salvarOrc({ itens: orc.itens.map(it => it.id===itemId ? {...it, quantidade:Number(novaQtd)||0} : it) });
  };

  const updItemCampo = async (itemId, campo, valor) => {
    if (campo !== "codigo") {
      salvarOrc({ itens:orc.itens.map(it => it.id===itemId ? {...it,[campo]:valor} : it) });
      return;
    }
    const itemAtual = orc.itens.find(it => it.id === itemId);
    if (!itemAtual) return;
    const codigoDigitado = String(valor || "").trim().toUpperCase();
    const chave = normalizarCodigoRef(codigoDigitado);
    const fonteAtual = String(itemAtual.fonte || "").trim().toUpperCase();
    let ref = chave ? (referenciaPorCodigo.get(`${fonteAtual}|${chave}`) || referenciaPorCodigo.get(chave)) : null;
    setCodigoAtualizando(itemId);
    try {
      if (chave && (orc.referencias || []).length) {
        const resposta = await resolverCodigosReferencia(orc.referencias, [{codigo:chave, fonte:fonteAtual}]);
        if (resposta.ok && resposta.items?.length) ref = resposta.items[0];
        else if (!resposta.ok && !ref) showToast(resposta.error || "Não foi possível consultar o código.", "warn");
        if (!ref && fonteAtual && resposta.ok) {
          const alternativa = await resolverCodigosReferencia(orc.referencias, [{codigo:chave, fonte:""}]);
          if (alternativa.ok && alternativa.items?.length) ref = alternativa.items[0];
        }
      }
      const orcVigente = (dataAtualRef.current.orcamentos || []).find(item => item.id === selOrc) || orc;
      const itens = orcVigente.itens.map(it => {
        if (it.id !== itemId) return it;
        const alterado = {...it, codigo:codigoDigitado, codigoNaoEncontrado:!ref};
        return ref && precoDoItem(ref, orcVigente) > 0 ? aplicarReferencia(alterado, ref, orcVigente) : alterado;
      });
      salvarOrcAssincrono({itens});
      if (ref) showToast(`Código ${chave} atualizado pela base ${ref.fonte || "de referência"}.`);
      else if (chave) showToast(`Código ${chave} não localizado nas bases vinculadas.`, "warn");
    } finally {
      setCodigoAtualizando("");
    }
  };

  const selecionarReferenciaLinha = (itemId, referencia) => {
    if (!referencia) return;
    const atual = dataAtualRef.current;
    const orcVigente = (atual.orcamentos || []).find(item => item.id === selOrc) || orc;
    if (!orcVigente) return;
    const itens = (orcVigente.itens || []).map(item =>
      item.id === itemId ? aplicarReferencia(item, referencia, orcVigente) : item
    );
    salvarOrcAssincrono({itens});
    setBuscaLinha({itemId:"", termo:""});
    setResultadosLinhaRemotos([]);
    setBuscaLinhaAviso("");
    showToast(`${referencia.fonte || "Referencia"} ${referencia.codigo}: descricao e preco atualizados.`);
  };

  const salvarItemCompleto = () => {
    if (!editItem || !orc) return;
    if (!String(editItem.descricao||"").trim()) { showToast("Informe a descricao do item.","error"); return; }
    const item = {
      ...editItem,
      codigo: String(editItem.codigo||"").trim(), fonte: String(editItem.fonte||orc.fonte||"").trim(),
      descricao: String(editItem.descricao||"").trim(), unidade: String(editItem.unidade||"UN").trim(),
      quantidade: Number(editItem.quantidade)||0, precoUnit: Number(editItem.precoUnit)||0,
      composicao: String(editItem.composicao||"").trim(),
    };
    salvarOrc({ itens: orc.itens.map(it => it.id===item.id ? item : it) });
    setEditItem(null);
    showToast("Item atualizado.");
  };

  const delItem = (itemId) => {
    salvarOrc({ itens: orc.itens.filter(it => it.id!==itemId) });
    showToast("Linha removida.");
  };

  //  BDI (Acórdão 2622/2013) 
  const abrirBDI = () => {
    setBdiTipo(orc.bdiTipo || "edificios");
    // A CPRB (4,5% sobre a receita) só incide na folha desonerada. Se o
    // orçamento usa a tabela desonerada, ela ENTRA nos tributos do BDI -
    // é o erro mais comum e o que mais gera glosa.
    const cprbPadrao = orc.desonerado !== false ? 4.50 : 0;
    setBdiP(orc.bdiParams || {
      ac:4.00, seguro:0.80, risco:1.27, garantia:0, df:1.23, lucro:7.40,
      pis:0.65, cofins:3.00, iss:2.00, cprb:cprbPadrao,
    });
    setBdiAba(orc.bdiParams ? "detalhado" : "faixa");
    setBdiModal(true);
  };

  const aplicarBDI = (valor, tipo, params = null) => {
    salvarOrc({
      bdi: Number(Number(valor).toFixed(2)),
      bdiTipo: tipo,
      bdiParams: params,
    });
    setBdiModal(false);
    showToast(`BDI de ${Number(valor).toFixed(2)}% aplicado ao orçamento.`);
  };

  //  Título: linha de texto puro dentro da planilha 
  // Serve para separar blocos de itens ("Pavimento térreo", "Área de
  // serviço") sem criar uma etapa com subtotal. Entra na numeração,
  // mas não soma custo.
  const addTitulo = (etapaId) => {
    salvarOrc({
      itens: [...(orc.itens||[]), {
        id: uid(), etapaId, tipo: "titulo",
        codigo: "", fonte: "", descricao: "",
        unidade: "", quantidade: 0, precoUnit: 0,
      }],
    });
    showToast("Título adicionado - digite o texto.");
  };

  const updTituloTexto = (itemId, texto) => {
    salvarOrc({ itens: orc.itens.map(it => it.id===itemId ? {...it, descricao: texto} : it) });
  };

  //  Reordenar linhas dentro de uma etapa 
  // O título só é útil se puder ficar ANTES dos itens que ele rotula,
  // então mover linha para cima/baixo é parte do recurso, não extra.
  const moverLinha = (itemId, direcao) => {
    const todos = [...(orc.itens||[])];
    const alvo  = todos.find(it => it.id === itemId);
    if (!alvo) return;

    // Posições globais das linhas da MESMA etapa, na ordem em que aparecem
    const posDaEtapa = todos
      .map((it, i) => ({ it, i }))
      .filter(x => x.it.etapaId === alvo.etapaId)
      .map(x => x.i);

    const ondeEstou = posDaEtapa.indexOf(todos.findIndex(it => it.id === itemId));
    const ondeVou   = ondeEstou + direcao;
    if (ondeVou < 0 || ondeVou >= posDaEtapa.length) return;   // já é a 1ª/última

    // Troca as duas posições globais
    const a = posDaEtapa[ondeEstou];
    const b = posDaEtapa[ondeVou];
    [todos[a], todos[b]] = [todos[b], todos[a]];

    salvarOrc({ itens: todos });
  };

  // Reordena por ARRASTAR: move o item de origem para a posicao do item destino,
  // desde que ambos estejam na mesma etapa. Diferente de moverLinha (um passo),
  // aqui o item pode saltar varias posicoes de uma vez.
  const moverItemPara = (origemId, destinoId) => {
    if (!origemId || origemId === destinoId) return;
    const todos = [...(orc.itens || [])];
    const origem  = todos.find(it => it.id === origemId);
    const destino = todos.find(it => it.id === destinoId);
    if (!origem || !destino) return;
    if (origem.etapaId !== destino.etapaId) return;   // so reordena dentro da etapa

    const idxOrigem  = todos.findIndex(it => it.id === origemId);
    const [movido] = todos.splice(idxOrigem, 1);
    const idxDestino = todos.findIndex(it => it.id === destinoId);
    todos.splice(idxDestino, 0, movido);
    salvarOrc({ itens: todos });
  };

  // Edita um valor numerico do item direto na planilha (custo unitario ou BDI
  // proprio). Ao mexer no custo unitario, precoRef fica intacto - e a comparacao
  // com precoRef que faz o preco aparecer destacado quando sai do valor da base.
  const updItemNumero = (itemId, campo, valor) => {
    const n = parseBR(valor);
    salvarOrc({ itens: orc.itens.map(it =>
      it.id === itemId ? { ...it, [campo]: Number.isFinite(n) ? n : 0 } : it) });
  };

  // Restaura o custo unitario do item para o preco de referencia da base.
  const restaurarPrecoRef = (itemId) => {
    const it = (orc.itens || []).find(x => x.id === itemId);
    if (!it || !(Number(it.precoRef) > 0)) return;
    salvarOrc({ itens: orc.itens.map(x =>
      x.id === itemId ? { ...x, precoUnit: Number(it.precoRef) } : x) });
    showToast("Preco restaurado para o valor da base.");
  };

  // True quando o usuario editou o custo unitario e ele diverge da base.
  const precoAlterado = (it) =>
    Number(it.precoRef) > 0 && Math.abs(Number(it.precoUnit) - Number(it.precoRef)) > 0.005;

  //  Etapas: criar / renomear / excluir 
  const abrirNovaEtapa = (paiId = "") => {
    setEtapaModal({ modo: paiId ? "sub" : "novo", paiId, etapa: null });
    setEtapaNome("");
  };
  const abrirEditarEtapa = (etapa) => {
    setEtapaModal({ modo:"editar", paiId: etapa.parentId || "", etapa });
    setEtapaNome(etapa.nome);
  };

  const salvarEtapa = () => {
    if (!etapaNome.trim()) { showToast("Informe o nome da etapa.","error"); return; }
    const { modo, paiId, etapa } = etapaModal;

    if (modo === "editar") {
      salvarOrc({ etapas: orc.etapas.map(e => e.id===etapa.id ? {...e, nome:etapaNome.trim()} : e) });
      showToast("Etapa renomeada.");
    } else {
      if (paiId && nivelDaEtapa(orc.etapas, paiId) >= MAX_NIVEL) {
        showToast(`Limite de ${MAX_NIVEL} níveis atingido.`,"error"); return;
      }
      salvarOrc({ etapas: [...orc.etapas, { id:uid(), nome:etapaNome.trim(), parentId:paiId || "" }] });
      showToast(paiId ? "Subnível criado." : "Etapa criada.");
    }
    setEtapaModal(null); setEtapaNome("");
  };

  const delEtapa = (etapa) => {
    const ids = idsDaSubarvore(orc.etapas, etapa.id);
    const nSub   = ids.length - 1;
    const nItens = (orc.itens||[]).filter(it => ids.includes(it.etapaId)).length;

    let aviso = `Excluir a etapa "${etapa.nome}"?`;
    if (nSub || nItens) {
      aviso += " Isto também remove:";
      if (nSub)   aviso += ` ${nSub} subnível(is)`;
      if (nItens) aviso += `${nSub?" e":""} ${nItens} item(ns) do orçamento`;
      aviso += ".";
    }
    aviso += " Dá para desfazer logo em seguida.";
    setConfirmDelEtapa({ ids, aviso });
  };
  const executarDelEtapa = () => {
    const { ids } = confirmDelEtapa;
    const etapasAntes = orc.etapas;
    const itensAntes = orc.itens || [];
    salvarOrc({
      etapas: etapasAntes.filter(e => !ids.includes(e.id)),
      itens:  itensAntes.filter(it => !ids.includes(it.etapaId)),
    });
    setUndoEtapa({ etapasAntes, itensAntes });
    window.clearTimeout(undoEtapaTimeoutRef.current);
    undoEtapaTimeoutRef.current = window.setTimeout(()=>setUndoEtapa(null), 8000);
    showToast("Etapa removida.");
  };
  const desfazerDelEtapa = () => {
    if (!undoEtapa) return;
    window.clearTimeout(undoEtapaTimeoutRef.current);
    salvarOrc({ etapas: undoEtapa.etapasAntes, itens: undoEtapa.itensAntes });
    setUndoEtapa(null);
    showToast("Etapa restaurada.");
  };

  // Na base ORSE alguns identificadores chegam como "codigo/ORSE". A fonte ja
  // tem coluna propria na exportacao, entao o codigo deve sair sem esse sufixo.
  const codigoParaExportar = (codigo) => String(codigo ?? "").trim()
    .replace(/\s*\/\s*ORSE\s*$/i, "").trim();

  const appendAbaComposicoes = (wb) => {
    const linhas = (orc?.itens||[]).filter(it=>it.tipo!=="titulo" && it.composicao);
    if (!linhas.length) return;
    const wsComp = XLSX.utils.aoa_to_sheet([
      ["FONTE","CÓDIGO","DESCRIÇÃO","COMPOSIÇÃO / MEMÓRIA DE PREÇOS"],
      ...linhas.map(it=>[it.fonte||"",codigoParaExportar(it.codigo),it.descricao||"",it.composicao||""]),
    ]);
    wsComp["!cols"]=[{wch:11},{wch:14},{wch:58},{wch:70}];
    XLSX.utils.book_append_sheet(wb,wsComp,"Composições");
  };

  const formatarColunasOrcamento = (ws, aoa, cabecalhoIdx) => {
    for (let r=cabecalhoIdx+1;r<aoa.length;r++) {
      [[6,"#,##0.00"],[7,"R$ #,##0.00"],[8,"0.00%"],[9,"R$ #,##0.00"],[10,"R$ #,##0.00"]].forEach(([c,z])=>{
        const cel=ws[XLSX.utils.encode_cell({r,c})];
        if (cel && typeof cel.v==="number") cel.z=z;
      });
    }
  };

  //  Exportar XLSX - planilha orçamentária hierárquica 
  const exportXLSX = async () => {
    await carregarXLSX();
    if (!orc || !calc) return;
    const wb  = XLSX.utils.book_new();
    const aoa = [];
    const itemCalcPorId=new Map((calcularOrcamentoCanonico(orc).items||[]).map(item=>[item.id,item]));

    aoa.push([data.config.companyName || "ARCD CONSTRUTECH"]);
    if (data.config.cnpj) aoa.push([`CNPJ: ${data.config.cnpj}`]);
    aoa.push(["PLANILHA ORÇAMENTÁRIA"]);
    aoa.push([]);
    aoa.push(["OBRA:",     orc.nome,                 "", "CLIENTE:",   orc.cliente || "-"]);
    if (orc.descricao) aoa.push(["DESCRIÇÃO:", orc.descricao]);
    aoa.push(["LOCAL:",    orc.local || "-",         "", "ÁREA (m):", orc.areaM2 || "-"]);
    aoa.push(["BASE:",     `${orc.fonte} ${orc.uf}`, "", "DATA-BASE:", orc.dataBase || "-"]);
    aoa.push(["ENCARGOS:", orc.desonerado ? "Desonerado" : "Não desonerado", "", "BDI:", `${orc.bdi}%`]);
    aoa.push([]);
    aoa.push(["NÍVEL CORRIGIDO","ITEM","FONTE","CÓDIGO","DESCRIÇÃO","UNIDADE","QUANTIDADE","CUSTO UNITÁRIO (SEM BDI)","BDI (%)","PREÇO UNITÁRIO (COM BDI)","PREÇO TOTAL (R$)"]);

    // Percorre a árvore inteira, em qualquer profundidade
    achatarArvore(calc.arvore).forEach(n => {
      if (n.tipo === "etapa") {
        // Recuo visual por nível na coluna de descrição
        const recuo = "    ".repeat(n.nivel - 1);
        aoa.push([n.nivel===1?"LOTE":`Nível ${n.nivel}`, n.codigo, "", "", recuo+n.nome, "", "", "", "", "", n.total||""]);
      } else if (n.tipo === "titulo") {
        // Título: só texto, sem código/unidade/valor
        aoa.push(["Título", n.codigoItem, "", "", n.descricao||"", "", "", "", "", "", ""]);
      } else {
        const calculado=itemCalcPorId.get(n.id)||{};
        aoa.push([
          "Serviço", n.codigoItem, n.fonte, codigoParaExportar(n.codigo), n.descricao, n.unidade,
          Number(n.quantidade),
          Number(n.precoUnit),
          Number(calculado.bdiEfetivo||0)/100,
          Number(n.precoUnit) * (1+Number(calculado.bdiEfetivo||0)/100),
          Number(calculado.total||0),
        ]);
      }
    });

    aoa.push([]);
    aoa.push(["", "", "", "", "CUSTO DIRETO (SEM BDI)", "", "", "", "", "", calc.custoDireto]);
    aoa.push(["", "", "", "", `BDI (${orc.bdi}%)`, "", "", "", "", "", calc.valorBDI]);
    aoa.push(["", "", "", "", "TOTAL GERAL DO ORÇAMENTO", "", "", "", "", "", calc.total]);
    if (orc.areaM2 > 0) aoa.push(["", "", "", "", "CUSTO POR m²", "", "", "", "", "", calc.porM2]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    formatarColunasOrcamento(ws,aoa,aoa.findIndex(r=>r[0]==="NÍVEL CORRIGIDO"));
    ws["!cols"] = [{wch:15},{wch:11},{wch:10},{wch:13},{wch:62},{wch:9},{wch:12},{wch:18},{wch:9},{wch:18},{wch:17}];
    XLSX.utils.book_append_sheet(wb, ws, "Orçamento");

    // Aba 2 - Curva ABC pelas etapas de 1º nível
    const abc = [...calc.arvore].filter(e => e.total > 0).sort((a,b) => b.total - a.total);
    const aoa2 = [
      [`Resumo por etapa - ${orc.nome}`], [],
      ["ETAPA","CUSTO DIRETO","TOTAL C/ BDI","% DO TOTAL"],
      ...abc.map(e => [e.nome, e.custoDireto, e.total, e.pct/100]),
      [], ["TOTAL", calc.custoDireto, calc.total, 1],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
    ws2["!cols"] = [{wch:42},{wch:16},{wch:16},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws2, "Resumo por Etapa");
    appendAbaComposicoes(wb);

    await XLSX.writeFile(wb, `orcamento-${orc.nome.replace(/[^\w]/g,"-").toLowerCase()}.xlsx`);
    showToast("Planilha exportada.");
  };

  //  IMPORTAR ORCAMENTO (codigo + quantidade) 
  //  A planilha do orcamento NAO traz preco nem descricao: traz o codigo e a
  //  quantidade. Quem responde pelo resto e a base SINAPI/ORSE ja carregada no
  //  app - o codigo e a chave. Isso evita o vicio de importar preco velho junto
  //  com a planilha: o preco vem sempre da base na data-base escolhida.
  //  Layout aceito (o mesmo que o "Excel padrao" exporta):
  //    Codigo | Tipo | Item | Un. | Qtd. | ...
  //  As colunas Item/Un. so sao usadas para etapas e para itens sem codigo.

  // Indice codigo -> item da base, montado uma vez.
  const basePorCodigo = useMemo(() => {
    const m = new Map();
    baseBusca.forEach(i => {
      const c = String(i.codigo ?? "").trim().toUpperCase();
      if (c && !m.has(c)) m.set(c, i);
    });
    return m;
  }, [baseBusca]);

  // Para atualizar um codigo ja digitado, a planilha de referencia carregada
  // tem prioridade sobre favoritos antigos, garantindo preco da data-base atual.
  const referenciaPorCodigo = useMemo(() => {
    const m = new Map();
    (data.baseFavoritos||[]).forEach(i => {
      const c = String(i.codigo??"").trim().toUpperCase().replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i,"").replace(/\.0$/,"");
      const f = String(i.fonte||"").trim().toUpperCase();
      if (c && f && !m.has(`${f}|${c}`)) m.set(`${f}|${c}`,i);
      if (c && !m.has(c)) m.set(c,i);
    });
    return m;
  },[data.baseFavoritos]);

  const atualizarPrecosVinculados = async () => {
    if (!orc || !(orc.referencias || []).length) {
      showToast("Vincule uma base SINAPI ou ORSE antes de atualizar os preços.", "error");
      return;
    }
    const candidatos = orc.itens.filter(it => it.tipo !== "titulo" && normalizarCodigoRef(it.codigo)
      && !/^(EXTERNO|COTA[CÇ][AÃ]O|PR[ÓO]PRIA)$/.test(String(it.fonte || "").trim().toUpperCase()));
    if (!candidatos.length) {
      showToast("O orçamento não possui itens codificados para atualizar.", "warn");
      return;
    }
    const entradas = [];
    const vistos = new Set();
    candidatos.forEach(it => {
      const entrada = {codigo:normalizarCodigoRef(it.codigo), fonte:String(it.fonte || "").trim().toUpperCase()};
      const key = `${entrada.fonte}|${entrada.codigo}`;
      if (!vistos.has(key)) { vistos.add(key); entradas.push(entrada); }
    });

    setAtualizandoPrecos(true);
    try {
      const encontrados = [];
      for (let i = 0; i < entradas.length; i += 25) {
        const resposta = await resolverCodigosReferencia(orc.referencias, entradas.slice(i, i + 25));
        if (!resposta.ok) throw new Error(resposta.error || "Falha ao consultar as bases vinculadas.");
        encontrados.push(...(resposta.items || []));
      }
      const mapa = new Map();
      encontrados.forEach(ref => {
        const codigo = normalizarCodigoRef(ref.codigo);
        const fonte = String(ref.fonte || "").trim().toUpperCase();
        if (codigo && fonte) mapa.set(`${fonte}|${codigo}`, ref);
        if (codigo && !mapa.has(codigo)) mapa.set(codigo, ref);
      });

      let atualizados = 0, naoEncontrados = 0;
      const orcVigente = (dataAtualRef.current.orcamentos || []).find(item => item.id === selOrc) || orc;
      const itens = orcVigente.itens.map(it => {
        if (it.tipo === "titulo" || /^(EXTERNO|COTA[CÇ][AÃ]O|PR[ÓO]PRIA)$/.test(String(it.fonte || "").trim().toUpperCase())) return it;
        const codigo = normalizarCodigoRef(it.codigo);
        if (!codigo) return it;
        const fonte = String(it.fonte || "").trim().toUpperCase();
        const ref = mapa.get(`${fonte}|${codigo}`) || mapa.get(codigo);
        if (!ref || !(precoDoItem(ref, orcVigente) > 0)) {
          naoEncontrados++;
          return {...it, codigoNaoEncontrado:true};
        }
        atualizados++;
        return aplicarReferencia(it, ref, orcVigente);
      });
      salvarOrcAssincrono({itens});
      showToast(`${atualizados} item(ns) atualizado(s) pelas bases vinculadas${naoEncontrados ? `; ${naoEncontrados} sem correspondência` : ""}.`);
    } catch (error) {
      showToast(error?.message || "Não foi possível atualizar os preços.", "error");
    } finally {
      setAtualizandoPrecos(false);
    }
  };

  const importarOrcamentoXLSX = async (file) => {
    await carregarXLSX();
    if (!file || !orc) return;
    if (basePorCodigo.size === 0) {
      showToast("Carregue primeiro a planilha de referência para localizar códigos e custos.", "error");
      return;
    }
    setImpLoad(true);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = await XLSX.read(buf, { type:"array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:"", raw:true });

      // Acha o cabecalho (linha com Codigo E Quantidade) e monta um PALPITE
      // inicial das demais colunas - a confirmacao de onde esta cada coluna
      // e sempre humana, no modal que abre em seguida.
      const { hIdx, col } = detectarColunasImportacao(rows);
      if (hIdx < 0) {
        showToast("Não achei uma linha de cabeçalho com Código e Quantidade na planilha.", "error");
        setImpLoad(false); return;
      }

      // Sempre pede confirmação humana das 4 colunas que importam de verdade
      // (código, descrição, quantidade, preço) antes de montar qualquer linha -
      // a detecção por nome de cabeçalho já perdeu em silêncio o nome de toda
      // etapa e de todo item sem código numa planilha que usava "Nome" em vez
      // de "Descrição" (achado real, 26/08/2026).
      setColMapModal({ headerRow: rows[hIdx] || [], rows, hIdx, col });
    } catch (e) {
      showToast("Não consegui ler a planilha: " + e.message, "error");
    }
    setImpLoad(false);
  };

  // Aplica o mapeamento de colunas confirmado (ou ajustado) pelo usuário e
  // monta a pré-visualização de importação (impModal).
  const confirmarMapeamentoImportacao = () => {
    if (!colMapModal) return;
    const { rows, hIdx, col } = colMapModal;
    if (col.codigo === undefined || col.descricao === undefined || col.qtd === undefined || col.preco === undefined) {
      showToast("Selecione as quatro colunas (código, descrição, quantidade e preço) antes de importar.", "error");
      return;
    }

    const linhas = montarLinhasImportacao({ rows, hIdx, col, basePorCodigo, precoDoItem, orc, parseNumero: parseBR });
    const itens = linhas.filter(l => l.kind === "item");
    if (!itens.length) { showToast("Nenhum item com código encontrado na planilha.", "error"); return; }

    setColMapModal(null);
    setImpModal({
      linhas,
      stats: resumoImportacao(linhas),
      substituir: false,
      incluirPend: true,
    });
  };

  // Aplica a importacao: cria as etapas na ordem e pendura os itens nelas.
  const aplicarImportacao = () => {
    if (!impModal || !orc) return;
    const { linhas, substituir, incluirPend } = impModal;

    const etapas = substituir ? [] : [...(orc.etapas||[])];
    const itens  = substituir ? [] : [...(orc.itens ||[])];
    let raizAtual = "", etapaAtual = "", pulados = 0;

    linhas.forEach(l => {
      if (l.kind === "etapa") {
        const id = uid();
        if (l.nivel === 2 && raizAtual) { etapas.push({ id, nome:l.nome, parentId: raizAtual }); etapaAtual = id; }
        else { etapas.push({ id, nome:l.nome, parentId:"" }); raizAtual = id; etapaAtual = id; }
        return;
      }
      // Item/titulo sem etapa declarada antes: cria uma para nao ficar orfao.
      if (!etapaAtual) {
        const id = uid();
        etapas.push({ id, nome:"Itens importados", parentId:"" });
        raizAtual = id; etapaAtual = id;
      }
      if (l.kind === "titulo") {
        itens.push({ id:uid(), etapaId:etapaAtual, tipo:"titulo", codigo:"", fonte:orc.fonte,
                     descricao:l.descricao, unidade:"un", quantidade:0, precoUnit:0 });
        return;
      }
      const pendente = !l.achou || l.semPreco || l.semQtd;
      if (pendente && !incluirPend) { pulados++; return; }
      itens.push({
        id: uid(), etapaId: etapaAtual, tipo:"item",
        codigo: l.codigo, fonte: l.fonte, descricao: l.descricao,
        unidade: l.unidade, quantidade: l.quantidade, precoUnit: l.precoUnit,
        composicao: l.composicao || "",
        codigoNaoEncontrado: !!l.codigoNaoEncontrado,
      });
    });

    update({ ...data, orcamentos: todosOrcamentos.map(o => o.id===selOrc ? {...o, etapas, itens} : o) });
    setImpModal(null);
    showToast(`Importado: ${itens.length} linha(s) no orçamento${pulados?` - ${pulados} pendente(s) ignorada(s)`:""}.`);
  };

  //  Exportar XLSX no layout "Exportado" 
  //  Reproduz o formato da planilha que o orcamentista usa fora do app:
  //  Codigo | Tipo | Item | Un. | Qtd. | Custo total | Status
  //  - Tipo: Nivel (etapa raiz), Subnivel (etapa filha), Composicao (item com
  //    codigo de tabela) ou Produto (item sem codigo, comprado direto).
  //  - Custo total: CUSTO DIRETO, sem BDI - e o que essa planilha transporta.
  //  - Status: herdado do status do orcamento, igual para todas as linhas.
  const exportXLSXExportado = async () => {
    await carregarXLSX();
    if (!orc || !calc) return;
    const itemCalcPorId=new Map(projectBudgetExport(orc).rows.map(item=>[item.id,item]));
    const aoa = [["Nível corrigido","Item","Fonte","Código","Descrição","Unidade","Quantidade","Custo unitário (sem BDI)","BDI (%)","Preço unitário (com BDI)","Preço total (R$)"]];

    achatarArvore(calc.arvore).forEach(n => {
      if (n.tipo === "etapa") {
        aoa.push([n.nivel===1?"LOTE":`Nível ${n.nivel}`,n.codigo,"","",n.nome,"","","","","",n.total||0]);
      } else if (n.tipo === "titulo") {
        aoa.push(["Título",n.codigoItem,"","",n.descricao||"","","","","","",""]);
      } else {
        const calculado=itemCalcPorId.get(n.id)||{};
        aoa.push([
          "Serviço",
          n.codigoItem,
          n.fonte || orc.fonte || "",
          codigoParaExportar(n.codigo),
          n.descricao || "",
          n.unidade || "",
          Number(n.quantidade||0),
          Number(n.precoUnit||0),
          Number(calculado.bdi||0)/100,
          Number(calculado.precoUnitario||0),
          Number(calculado.total||0),
        ]);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    formatarColunasOrcamento(ws,aoa,0);
    ws["!cols"] = [{wch:15},{wch:11},{wch:10},{wch:13},{wch:62},{wch:9},{wch:12},{wch:18},{wch:9},{wch:18},{wch:17}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exportado");
    appendAbaComposicoes(wb);
    await XLSX.writeFile(wb, `exportado-${orc.nome.replace(/[^\w]/g,"-").toLowerCase()}.xlsx`);
    showToast("Planilha exportada no formato padrão.");
  };

  //  Exportar a curva ABC 
  const exportXLSXCurvaABC = async () => {
    await carregarXLSX();
    if (!abc) return;
    const aoa = [
      [`Curva ABC - ${orc.nome}`],
      [`${orc.fonte} ${orc.uf}  ${orc.dataBase||"sem data-base"}  BDI ${orc.bdi}%  ${abcAgrupar?"itens agrupados por código":"itens sem agrupamento"}`],
      [],
      ["CLASSE","QTD. ITENS","% DOS ITENS","CUSTO DIRETO","% DO VALOR"],
      ...abc.resumo.map(r => [r.classe, r.qtd, r.pctItens/100, r.custoDireto, r.pctValor/100]),
      [],
      ["#","CLASSE","CÓDIGO","FONTE","DESCRIÇÃO","UNID.","QUANT.","P. UNIT.","CUSTO DIRETO","% ITEM","% ACUM."],
      ...abc.itens.map(i => [
        i.ordem, i.classe, codigoParaExportar(i.codigo), i.fonte, i.descricao, i.unidade,
        i.quantidade, i.precoUnit, i.custoDireto, i.pct/100, i.pctAcum/100,
      ]),
      [],
      ["", "", "", "", "TOTAL (CUSTO DIRETO)", "", "", "", abc.totalCD, 1, ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{wch:5},{wch:8},{wch:11},{wch:8},{wch:56},{wch:7},{wch:11},{wch:13},{wch:15},{wch:9},{wch:9}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Curva ABC");
    await XLSX.writeFile(wb, `curva-abc-${orc.nome.replace(/[^\w]/g,"-").toLowerCase()}.xlsx`);
    showToast("Curva ABC exportada.");
  };

  //  Exportar PDF 
  const exportPDF = () => {
    if (!orc || !calc) return;
    const exportacao=projectBudgetExport(orc);
    const itemCalcPorId=new Map(exportacao.rows.map(item=>[item.id,item]));
    const f2 = n => Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2});

    // Cores por nível de hierarquia
    const CORES_NIVEL = ["#D4AF37", "#0D47A1", "#4A148C", "#1E6B31", "#BF360C"];

    const linhas = achatarArvore(calc.arvore).map(n => {
      if (n.tipo === "etapa") {
        const cor = CORES_NIVEL[(n.nivel - 1) % CORES_NIVEL.length];
        const recuoPx = (n.nivel - 1) * 14;
        const fs = Math.max(9.5 - (n.nivel - 1) * 0.4, 8);
        return `<tr class="etapa n${n.nivel}">
          <td style="font-weight:900;color:${cor}">${n.codigo}</td>
          <td colspan="6" style="padding-left:${recuoPx}px;font-size:${fs}px;font-weight:${n.nivel===1?900:700}">${escapeHtml(n.nome)}</td>
          <td class="r" style="font-weight:900">${n.total > 0 ? f2(n.total) : ""}</td>
        </tr>`;
      }
      if (n.tipo === "titulo") {
        return `<tr class="titulo">
          <td>${n.codigoItem}</td>
          <td colspan="7">${escapeHtml(n.descricao || "")}</td>
        </tr>`;
      }
      const calculado=itemCalcPorId.get(n.id)||{};
      return `<tr>
        <td>${n.codigoItem}</td>
        <td>${escapeHtml(n.codigo)}</td>
        <td>${escapeHtml(n.fonte)}</td>
        <td class="desc">${escapeHtml(n.descricao)}</td>
        <td class="c">${escapeHtml(n.unidade)}</td>
        <td class="r">${f2(n.quantidade)}</td>
        <td class="r">${f2(calculado.precoUnitario)}</td>
        <td class="r">${f2(calculado.total)}</td>
      </tr>`;
    }).join("");

    // Memória de cálculo do BDI - só sai se o BDI foi montado pela fórmula
    const p = orc.bdiParams;
    const sitPDF = situacaoBDI(Number(orc.bdi||0), orc.bdiTipo || "edificios");
    const blocoBDI = !p ? "" : `
<div class="bdi-box">
  <p class="bdi-t">MEMÓRIA DE CÁLCULO DO BDI - Acórdão 2622/2013-TCU-Plenário</p>
  <p class="bdi-f">BDI = [ (1 + AC + S + R + G) x (1 + DF) x (1 + L)  (1  I) ]  1</p>
  <table class="bdi-tb">
    <tr>
      <td><b>AC</b> Administração Central</td><td class="r">${f2(p.ac)}%</td>
      <td><b>S</b> Seguro</td><td class="r">${f2(p.seguro)}%</td>
      <td><b>R</b> Risco</td><td class="r">${f2(p.risco)}%</td>
    </tr>
    <tr>
      <td><b>G</b> Garantia</td><td class="r">${f2(p.garantia)}%</td>
      <td><b>DF</b> Desp. Financeiras</td><td class="r">${f2(p.df)}%</td>
      <td><b>L</b> Lucro</td><td class="r">${f2(p.lucro)}%</td>
    </tr>
    <tr class="trib">
      <td><b>I</b> PIS</td><td class="r">${f2(p.pis)}%</td>
      <td>COFINS</td><td class="r">${f2(p.cofins)}%</td>
      <td>ISS</td><td class="r">${f2(p.iss)}%</td>
    </tr>
    <tr class="trib">
      <td>CPRB${Number(p.cprb)>0?" (desoneração)":""}</td><td class="r">${f2(p.cprb)}%</td>
      <td colspan="3" class="r"><b> Tributos (I) = ${f2(Number(p.pis)+Number(p.cofins)+Number(p.iss)+Number(p.cprb))}%</b></td>
    </tr>
  </table>
  <div class="bdi-res">
    <span>BDI ADOTADO</span>
    <b>${f2(orc.bdi)}%</b>
  </div>
  <p class="bdi-sit ${sitPDF.st}">
    ${sitPDF.st==="dentro" ? "ok" : "!"} ${escapeHtml(sitPDF.msg)}
      Faixa para ${escapeHtml(sitPDF.faixa.l.toLowerCase())}: ${sitPDF.faixa.q1}% - ${sitPDF.faixa.q3}%
  </p>
</div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orçamento - ${escapeHtml(orc.nome)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#121212;background:#fff;padding:22px;font-size:9.5px}
.btn{position:fixed;top:10px;right:10px;background:#D4AF37;color:#fff;border:0;padding:10px 18px;font-weight:700;cursor:pointer}
.ph{display:flex;align-items:center;gap:14px;padding-bottom:12px;border-bottom:3px solid #121212;margin-bottom:14px}
.logo{background:#121212;color:#D4AF37;padding:9px 15px;font-family:Georgia;font-size:21px;font-weight:900;letter-spacing:2px}
.co h1{font-size:15px;font-weight:900}.co p{font-size:9px;color:#666;margin-top:2px}
.tag{font-size:14px;font-weight:900;text-align:right;flex:1}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#F5F3EE;padding:10px 12px;margin-bottom:12px;border:1px solid #E0DAD0}
.meta div p:first-child{font-size:8px;font-weight:700;text-transform:uppercase;color:#777}
.meta div p:last-child{font-size:11px;font-weight:700;margin-top:1px}
table{width:100%;border-collapse:collapse}
th{background:#121212;color:#fff;padding:6px 5px;font-size:8px;text-transform:uppercase;text-align:left}
td{padding:4px 5px;border-bottom:1px solid #eee;font-size:9px;vertical-align:top}
td.r,th.r{text-align:right}td.c,th.c{text-align:center}
td.desc{max-width:290px}
tr.etapa td{background:#F5F3EE;border-top:1px solid #C8C2B6;border-bottom:1px solid #E0DAD0}
tr.etapa.n1 td{background:#EFEBE2;border-top:2px solid #121212}
tr.etapa.n2 td{background:#F5F3EE}
tr.etapa.n3 td{background:#F9F7F2}
tr.etapa.n4 td,tr.etapa.n5 td{background:#FCFBF8}
tr.titulo td{background:#FAF9F6;font-weight:700;text-transform:uppercase;letter-spacing:.4px;font-size:9px;color:#3D3530;border-bottom:1px solid #E0DAD0}
tfoot td{padding:7px 5px;font-weight:900;font-size:11px;border-top:2px solid #121212}
tfoot tr.tot td{background:#121212;color:#fff;font-size:13px}
tfoot tr.m2 td{background:#F5F3EE;font-size:10px}
.bdi-box{border:1px solid #C8C2B6;background:#FAF9F6;padding:9px 11px;margin-bottom:12px}
.bdi-t{font-size:8.5px;font-weight:900;letter-spacing:.4px;color:#121212;margin-bottom:3px}
.bdi-f{font-size:8px;font-family:monospace;color:#6B6459;margin-bottom:6px}
.bdi-tb{width:100%;border-collapse:collapse;margin:0}
.bdi-tb td{padding:2.5px 5px;font-size:8.5px;border-bottom:1px solid #EFEBE2}
.bdi-tb td.r{text-align:right;font-weight:700}
.bdi-tb tr.trib td{background:#F5F3EE}
.bdi-res{display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:5px;border-top:2px solid #121212}
.bdi-res span{font-size:9px;font-weight:900;letter-spacing:.5px}
.bdi-res b{font-size:14px;font-weight:900;color:#D4AF37}
.bdi-sit{font-size:8px;margin-top:5px;padding:4px 6px}
.bdi-sit.dentro{background:#E8F2E9;color:#1E6B31}
.bdi-sit.acima,.bdi-sit.abaixo{background:#FBEAE9;color:#B71C1C}
.footer{margin-top:20px;text-align:center;font-size:8px;color:#aaa;border-top:1px solid #eee;padding-top:8px}
@media print{.btn{display:none}}
</style></head><body>
<button class="btn" onclick="window.print()"> Imprimir / PDF</button>
<div class="ph">
  <div class="logo">ARCD</div>
  <div class="co">
    <h1>${escapeHtml(data.config.companyName||"ARCD Construtech")}</h1>
    ${data.config.cnpj?`<p>CNPJ: ${escapeHtml(data.config.cnpj)}</p>`:""}
    <p>Planilha Orçamentária</p>
  </div>
  <div class="tag">${escapeHtml(orc.nome)}</div>
</div>
${orc.descricao?`<p style="font-size:10px;color:#555;margin:-5px 0 12px">${escapeHtml(orc.descricao)}</p>`:""}
<div class="meta">
  <div><p>Cliente</p><p>${escapeHtml(orc.cliente||"-")}</p></div>
  <div><p>Local</p><p>${escapeHtml(orc.local||"-")}</p></div>
  <div><p>Base de preços</p><p>${escapeHtml(orc.fonte)} ${escapeHtml(orc.uf)}  ${escapeHtml(orc.dataBase||"-")}</p></div>
  <div><p>Encargos</p><p>${orc.desonerado?"Desonerado":"Não desonerado"}</p></div>
  <div><p>BDI aplicado</p><p>${orc.bdi}%</p></div>
  <div><p>Área</p><p>${orc.areaM2>0?orc.areaM2+" m":"-"}</p></div>
  <div><p>Itens</p><p>${calc.qtdItens}</p></div>
  <div><p>Emissão</p><p>${new Date().toLocaleDateString("pt-BR")}</p></div>
</div>
${blocoBDI}
<table>
  <thead><tr>
    <th>Item</th><th>Código</th><th>Fonte</th><th>Discriminação dos serviços</th>
    <th class="c">Un.</th><th class="r">Quant.</th><th class="r">P. Unit. c/ BDI</th><th class="r">Total</th>
  </tr></thead>
  <tbody>${linhas}</tbody>
  <tfoot>
    <tr><td colspan="7">CUSTO DIRETO (sem BDI)</td><td class="r">R$ ${f2(calc.custoDireto)}</td></tr>
    <tr><td colspan="7">BDI (${orc.bdi}%)</td><td class="r">R$ ${f2(calc.valorBDI)}</td></tr>
    <tr class="tot"><td colspan="7">TOTAL GERAL DO ORÇAMENTO</td><td class="r">R$ ${f2(calc.total)}</td></tr>
    ${orc.areaM2>0?`<tr class="m2"><td colspan="7">CUSTO POR METRO QUADRADO</td><td class="r">R$ ${f2(calc.porM2)}/m</td></tr>`:""}
  </tfoot>
</table>
<div class="footer">Gerado por ARCD Ponto PRO  ${new Date().toLocaleString("pt-BR")}  Preços congelados na data-base ${escapeHtml(orc.dataBase||"informada")}</div>
</body></html>`;
    const w = window.open("","_blank"); w.document.write(html); w.document.close();
  };

  // Exportações da tabela de Sapatas (Memória de Cálculo - Fundação) - pedido
  // do usuário após a crítica Impeccable: a tabela tem 23 colunas de dado
  // real e não cabe legível numa tela nem numa folha A4 retrato, então em
  // vez de forçar isso no navegador, oferece as duas saídas que o resto do
  // orçamento já usa (Excel completo, PDF/impressão).
  const CABECALHO_SAPATAS = ["TIPO (PILARES)","QTD PEÇAS","LARG.(m)","COMPR.(m)","ALT.BASE(m)","ALT.TRONCO(m)",
    "FOLGA ESCAV.(m)","ESCAV. PROF.(m)","VOL. ESCAVAÇÃO(m³)","CONC.MAGRO(m²)","FÔRMAS(m²)",
    "CONCR.BASE(m³)","CONCR.TRONCO(m³)","CONCR.SAPATA(m³)","REATERRO(m³)",
    "ARM.X BITOLA","ARM.X QTD","ARM.X COMPR.(m)","ARM.Y BITOLA","ARM.Y QTD","ARM.Y COMPR.(m)","PESO AÇO(kg)"];
  const linhaSapataParaExportar = ({ tipo, calc }) => [
    tipo.tipo, tipo.qtd, tipo.largura, tipo.comprimento, tipo.alturaBase, tipo.alturaTronco,
    tipo.folgaEscavacao, tipo.profundidadeEscavacao, calc.volumeEscavacaoTotal, calc.areaConcretoMagroTotal, calc.formaAreaTotal,
    calc.volumeBaseTotal, calc.volumeTroncoTotal, calc.volumeSapataTotal, calc.reaterroTotal,
    `∅${tipo.armaduraX.bitola}`, tipo.armaduraX.quantidade, tipo.armaduraX.comprimento,
    `∅${tipo.armaduraY.bitola}`, tipo.armaduraY.quantidade, tipo.armaduraY.comprimento, calc.pesoAcoTotal,
  ];
  const exportXLSXSapatas = async () => {
    if (!resumoSapatasFundacao.linhas.length) { showToast("Cadastre ao menos um tipo de sapata antes de exportar.","warn"); return; }
    await carregarXLSX();
    const t = resumoSapatasFundacao.totais;
    const aoa = [
      [`Memória de Cálculo - Fundação (Sapatas) - ${orc.nome}`],
      [],
      CABECALHO_SAPATAS,
      ...resumoSapatasFundacao.linhas.map(linhaSapataParaExportar),
      [],
      ["TOTAIS","","","","","","","",t.volumeEscavacao,t.areaConcretoMagro,t.formaArea,t.volumeBase,t.volumeTronco,t.volumeSapata,t.reaterro,"","","","","","",t.pesoAco],
      [],
      ["RESUMO DE AÇO POR BITOLA (já com 10% de perda)"],
      ["BITOLA","PESO (kg)"],
      ...resumoSapatasFundacao.acoPorBitola.map(l=>[`∅${l.bitola}`,l.kg]),
      ["TOTAL",t.pesoAco],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = CABECALHO_SAPATAS.map(()=>({wch:13}));
    ws["!cols"][0] = {wch:32};
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sapatas");
    await XLSX.writeFile(wb, `memoria-calculo-sapatas-${orc.nome.replace(/[^\w]/g,"-").toLowerCase()}.xlsx`);
    showToast("Tabela de sapatas exportada em Excel.");
  };

  const exportPDFSapatas = () => {
    if (!resumoSapatasFundacao.linhas.length) { showToast("Cadastre ao menos um tipo de sapata antes de exportar.","warn"); return; }
    const t = resumoSapatasFundacao.totais;
    const f3 = n => Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
    const linhasHtml = resumoSapatasFundacao.linhas.map(({tipo,calc})=>`<tr${calc.escavacaoInsuficiente?" class=\"alerta\"":""}>
      <td class="desc">${escapeHtml(tipo.tipo||"-")}</td><td class="r">${tipo.qtd}</td>
      <td class="r">${f3(tipo.largura)}</td><td class="r">${f3(tipo.comprimento)}</td><td class="r">${f3(tipo.alturaBase)}</td><td class="r">${f3(tipo.alturaTronco)}</td>
      <td class="r">${f3(tipo.folgaEscavacao)}</td><td class="r">${f3(tipo.profundidadeEscavacao)}</td>
      <td class="r">${calc.escavacaoInsuficiente?"⚠ ":""}${f3(calc.volumeEscavacaoTotal)}</td><td class="r">${f3(calc.areaConcretoMagroTotal)}</td><td class="r">${f3(calc.formaAreaTotal)}</td>
      <td class="r">${f3(calc.volumeBaseTotal)}</td><td class="r">${f3(calc.volumeTroncoTotal)}</td><td class="r">${f3(calc.volumeSapataTotal)}</td><td class="r">${f3(calc.reaterroTotal)}</td>
      <td class="c">∅${tipo.armaduraX.bitola}</td><td class="r">${tipo.armaduraX.quantidade}</td><td class="r">${tipo.armaduraX.comprimento?f3(tipo.armaduraX.comprimento):"-"}</td>
      <td class="c">∅${tipo.armaduraY.bitola}</td><td class="r">${tipo.armaduraY.quantidade}</td><td class="r">${tipo.armaduraY.comprimento?f3(tipo.armaduraY.comprimento):"-"}</td>
      <td class="r"><b>${f3(calc.pesoAcoTotal)}</b></td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Memória de Cálculo - Sapatas - ${escapeHtml(orc.nome)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4 landscape;margin:9mm}
body{font-family:Arial,sans-serif;color:#121212;background:#fff;padding:14px;font-size:7.5px}
.btn{position:fixed;top:10px;right:10px;background:#D4AF37;color:#fff;border:0;padding:10px 18px;font-weight:700;cursor:pointer;font-size:13px}
h1{font-size:13px;margin-bottom:2px}
.sub{font-size:9px;color:#666;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th{background:#121212;color:#fff;padding:4px 3px;font-size:6.8px;text-transform:uppercase;text-align:left;white-space:nowrap}
td{padding:3px;border-bottom:1px solid #eee;font-size:7.5px;white-space:nowrap}
td.desc{white-space:normal;max-width:150px}
td.r,th.r{text-align:right}td.c,th.c{text-align:center}
tr.alerta td{background:#FBEAE9;color:#B71C1C}
tfoot td{padding:5px 3px;font-weight:900;font-size:8px;border-top:2px solid #121212}
.aco{margin-top:14px;max-width:260px}
.aco th,.aco td{font-size:8px}
.footer{margin-top:14px;text-align:center;font-size:7px;color:#aaa;border-top:1px solid #eee;padding-top:6px}
@media print{.btn{display:none}}
</style></head><body>
<button class="btn" onclick="window.print()">Imprimir / PDF</button>
<h1>Memória de Cálculo - Fundação (Sapatas)</h1>
<p class="sub">${escapeHtml(orc.nome)} · Emissão ${new Date().toLocaleDateString("pt-BR")} · Painel de referência - não altera as linhas do orçamento</p>
<table>
  <thead><tr>${CABECALHO_SAPATAS.map(h=>`<th class="${/\(m|QTD|PEÇAS/.test(h)?"r":""}">${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>${linhasHtml}</tbody>
  <tfoot><tr>
    <td colspan="8">TOTAIS</td>
    <td class="r">${f3(t.volumeEscavacao)}</td><td class="r">${f3(t.areaConcretoMagro)}</td><td class="r">${f3(t.formaArea)}</td>
    <td class="r">${f3(t.volumeBase)}</td><td class="r">${f3(t.volumeTronco)}</td><td class="r">${f3(t.volumeSapata)}</td><td class="r">${f3(t.reaterro)}</td>
    <td colspan="6"></td><td class="r">${f3(t.pesoAco)}</td>
  </tr></tfoot>
</table>
<table class="aco">
  <thead><tr><th>RESUMO DE AÇO POR BITOLA</th><th class="r">PESO (kg)</th></tr></thead>
  <tbody>${resumoSapatasFundacao.acoPorBitola.map(l=>`<tr><td>∅${l.bitola}mm</td><td class="r">${f3(l.kg)}</td></tr>`).join("")}
  <tr><td><b>TOTAL</b></td><td class="r"><b>${f3(t.pesoAco)}</b></td></tr></tbody>
</table>
<div class="footer">Gerado por ARCD Ponto PRO · ${new Date().toLocaleString("pt-BR")}</div>
</body></html>`;
    const w = window.open("","_blank"); w.document.write(html); w.document.close();
  };

  //  VIEW: LISTA
  if (view === "lista") {
    return (
      <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>
        <PageHeader
          breadcrumb={["SINAPI", "ORSE"]}
          title="Orçamentos"
          description="Planilha orçamentária com BDI e exportação"
          primaryAction={<Btn onClick={()=>{setForm({...emptyOrc,obraId:obraIdFixo});setNovoModal(true);}}><Ic n="plus"/> Novo</Btn>}
          secondaryActions={<>
            <Btn v="ghost" title="Como funciona esta tela" ariaLabel="Como funciona esta tela" onClick={()=>setAjudaModal(true)}><Ic n="info"/> Ajuda</Btn>
            {obrasParaCopia.some(o=>o.id!==obraIdFixo)&&<Btn v="ghost" onClick={()=>{setForm({...emptyOrc,obraId:obraIdFixo});setCopiarModal({obraOrigemId:"",orcOrigemId:"",repetirQuantidades:true});}}><Ic n="copy"/> Copiar de outra obra</Btn>}
          </>}
        />

        {undoOrc && (
          <div style={{background:`${C.blue}0C`,border:`1px solid ${C.blue}55`,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <p style={{fontSize:12,color:C.text}}>Orçamento "{undoOrc.orc?.nome}" removido.</p>
            <Btn size="sm" v="ghost" onClick={desfazerDelOrc}><Ic n="refresh" s={13}/> Desfazer</Btn>
          </div>
        )}

        {ajudaModal && (
          <Modal title="Como funciona o Orçamento" onClose={()=>setAjudaModal(false)} wide>
            <div style={{display:"flex",flexDirection:"column",gap:14,fontSize:12.5,color:C.text,lineHeight:1.6}}>
              <div>
                <p style={{fontSize:11,fontWeight:800,color:C.yellow,textTransform:"uppercase",letterSpacing:.6,marginBottom:3}}>Bases de preços</p>
                <p>Vincule uma base <b>SINAPI</b> ou <b>ORSE</b> (ou as duas) ao orçamento para pesquisar composições e insumos por código ou descrição. Sem base vinculada, só é possível lançar itens avulsos ou favoritos já salvos.</p>
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:800,color:C.yellow,textTransform:"uppercase",letterSpacing:.6,marginBottom:3}}>BDI</p>
                <p>O selo colorido ao lado do BDI mostra se o percentual está dentro da faixa auditável do TCU (Acórdão 2622/2013) para o tipo de obra escolhido. Fora da faixa não bloqueia o orçamento, mas fica sinalizado para justificar em auditoria.</p>
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:800,color:C.yellow,textTransform:"uppercase",letterSpacing:.6,marginBottom:3}}>Versão e baseline</p>
                <p>Um orçamento <b>aprovado</b> fica bloqueado para edição - crie uma <b>revisão</b> para alterar valores depois disso. A <b>baseline</b> é a versão que planejamento, medições e comparativos usam como referência da obra; sem baseline definida, essas telas não têm o que comparar.</p>
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:800,color:C.yellow,textTransform:"uppercase",letterSpacing:.6,marginBottom:3}}>Copiar de outra obra</p>
                <p>Traz a estrutura de etapas, itens e (se existir) o cronograma de um orçamento de outra obra. Você escolhe se as quantidades vêm repetidas (útil para obras quase idênticas) ou zeradas (a estrutura e o preço de referência vêm, você lança a medida real desta obra). As datas do cronograma copiado são deslocadas para começar hoje.</p>
              </div>
              <Btn v="ghost" onClick={()=>setAjudaModal(false)} full>Fechar</Btn>
            </div>
          </Modal>
        )}

        {obraIdFixo&&!getActiveBudgetBaseline(data,obraIdFixo,"controle").budget&&orcamentos.length>0&&(
          <div style={{background:`${C.orange}0C`,border:`1px solid ${C.orange}66`,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.text,lineHeight:1.45}}>
            <b style={{color:C.orange}}>Baseline ainda não definida.</b> Abra a versão correta e use <b>“Aprovar e adotar baseline”</b>. Enquanto isso, planejamento, medições, qualidade e comparativos não usarão nenhum orçamento desta obra.
          </div>
        )}

        {orcamentos.length===0 && (
          <div style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:8,padding:30,textAlign:"center",boxShadow:`0 1px 4px ${C.shadow}`}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:8}}><Ic n="fileText" s={38} color={C.muted}/></div>
            <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>Nenhum orçamento criado</p>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>Crie um orçamento, importe a base SINAPI ou ORSE<br/>e monte a planilha por etapas.</p>
          </div>
        )}

        {orcamentos.map(o => {
          const c = calcOrcamento(o);
          const obraNome = data.obras.find(x=>x.id===o.obraId)?.name;
          const ehBaseline=(data.budgetBaselines||[]).some(b=>b.ativo!==false&&b.tipo==="controle"&&b.budgetId===o.id);
          const bloqueado=budgetIsImmutable(o);
          return (
            <div key={o.id} style={{background:C.bg,border:`1.5px solid ${C.border}`,borderLeft:`4px solid ${C.yellow}`,borderRadius:8,padding:"12px 14px",boxShadow:`0 1px 4px ${C.shadow}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:15,fontWeight:800,color:C.text}}>{o.nome}</p>
                  {o.descricao && <p style={{fontSize:11,color:C.subtle,marginTop:2,lineHeight:1.4}}>{o.descricao}</p>}
                  <p style={{fontSize:11,color:C.muted,marginTop:2}}>
                    {o.cliente && `${o.cliente}  `}
                    {obraNome && `${obraNome}  `}
                    {o.fonte} {o.uf} {o.dataBase && ` ${o.dataBase}`}  BDI {o.bdi}%
                  </p>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:5}}>{ehBaseline&&<Badge color={C.green}>BASELINE ATIVA</Badge>}<Badge color={bloqueado?C.blue:C.orange}>V{o.versionNumber||1} · {bloqueado?"APROVADA":"RASCUNHO"}</Badge></div>
                  <p style={{fontSize:11,color:C.muted,marginTop:2}}>
                    {c.qtdItens} item(ns){o.areaM2>0 && `  ${o.areaM2} m  ${fmt(c.porM2)}/m`}
                  </p>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:19,fontWeight:800,color:C.yellow}}>{fmt(c.total)}</p>
                  <p style={{fontSize:10,color:C.muted}}>com BDI</p>
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                <Btn size="sm" onClick={()=>{setSelOrc(o.id);setView("editor");}}><Ic n="edit"/> Abrir</Btn>
                {ehAdmin && o.obraId && !ehBaseline ? (
                  <Btn size="sm" v="success" onClick={()=>aprovarEAdotarBaseline(o.id)}>{bloqueado ? "Adotar como baseline" : "Aprovar baseline"}</Btn>
                ) : null}
                {!bloqueado&&<Btn size="sm" v="danger" title="Excluir orçamento" ariaLabel="Excluir orçamento" onClick={()=>delOrc(o.id)}><Ic n="trash"/></Btn>}
              </div>
            </div>
          );
        })}

        {/* Modal novo orçamento */}
        {novoModal && (
          <Modal title="Novo orçamento" onClose={()=>setNovoModal(false)}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Inp label="Nome do orçamento *" value={form.nome} onChange={F("nome")} placeholder="Ex.: Residência Terras Alpha - CA1-13"/>
              <Inp label="Descrição" value={form.descricao} onChange={F("descricao")} placeholder="Resumo, escopo ou observações do orçamento"/>
              {obraIdFixo
                ? <Inp label="Obra" value={data.obras.find(o=>o.id===obraIdFixo)?.name||"Obra atual"} onChange={()=>{}} disabled/>
                : <Sel label="Vincular a uma obra (opcional)" value={form.obraId} onChange={F("obraId")}
                    options={[{v:"",l:"- Nenhuma -"}, ...data.obras.map(o=>({v:o.id,l:o.name}))]}/>
              }
              <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
                <Inp label="Cliente" value={form.cliente} onChange={F("cliente")} placeholder="Nome do contratante"/>
                <Inp label="Área construída (m)" type="number" value={form.areaM2} onChange={F("areaM2")} placeholder="Ex.: 388"/>
              </div>
              <Inp label="Local / Endereço" value={form.local} onChange={F("local")} placeholder="Ex.: Caruaru/PE"/>
              <div style={{height:1,background:C.line,margin:"2px 0"}}/>
              <p style={{fontSize:11,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:.7}}>Base de preços</p>
              <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
                <Sel label="Fonte" value={form.fonte} onChange={F("fonte")} options={[
                  {v:"SINAPI",l:"SINAPI"},{v:"ORSE",l:"ORSE"},{v:"MISTO",l:"Misto (SINAPI + ORSE)"},
                ]}/>
                <Inp label="UF" value={form.uf} onChange={F("uf")} placeholder="PE"/>
                <Inp label="Data-base" value={form.dataBase} onChange={F("dataBase")} placeholder="Ex.: mai/2026"/>
                <Inp label="BDI (%)" type="number" value={form.bdi} onChange={F("bdi")} placeholder="23.25"/>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"9px 12px",background:form.desonerado?`${C.green}08`:C.surface,borderRadius:6,border:`1.5px solid ${form.desonerado?C.green+"55":C.border}`}}>
                <span style={{position:"relative",width:19,height:19,flexShrink:0,display:"inline-block"}}>
                  <input type="checkbox" checked={form.desonerado!==false} onChange={e=>F("desonerado")(e.target.checked)}
                    style={{position:"absolute",inset:0,width:"100%",height:"100%",margin:0,opacity:0,cursor:"pointer"}}/>
                  <div aria-hidden="true" style={{width:19,height:19,border:`2px solid ${form.desonerado?C.green:C.muted}`,background:form.desonerado?C.green:"transparent",borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                    {form.desonerado && <span style={{color:"#fff",fontSize:12,fontWeight:900}}>ok</span>}
                  </div>
                </span>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:form.desonerado?C.green:C.text}}>Encargos desonerados</p>
                  <p style={{fontSize:11,color:C.muted}}>Desmarque para usar a tabela não desonerada</p>
                </div>
              </label>
              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={()=>setNovoModal(false)} full>Cancelar</Btn>
                <Btn onClick={criarOrc} full><Ic n="check"/> Criar</Btn>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal copiar orçamento (e cronograma) de outra obra */}
        {copiarModal && (() => {
          const obraDestinoId = obraIdFixo || form.obraId;
          const orcsDaOrigem = orcamentosParaCopia.filter(o => o.obraId === copiarModal.obraOrigemId);
          const planoOrigemTemTarefas = !!planosParaCopia.find(p => p.obraId === copiarModal.obraOrigemId)?.tarefas?.length;
          return (
            <Modal title="Copiar de outra obra" onClose={()=>setCopiarModal(null)} wide>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>
                  Cria um orçamento novo nesta obra a partir das etapas e itens de um orçamento já existente em outra obra. Se a obra de origem já tiver um cronograma montado, ele também é copiado - com datas deslocadas para começar hoje.
                </p>
                {!obraIdFixo && (
                  <Sel label="Obra de destino *" value={form.obraId} onChange={F("obraId")}
                       options={[{v:"",l:"- Selecione -"}, ...obrasParaCopia.map(o=>({v:o.id,l:o.name}))]}/>
                )}
                <Sel label="Obra de origem *" value={copiarModal.obraOrigemId}
                     onChange={v=>setCopiarModal({ obraOrigemId:v, orcOrigemId:"" })}
                     options={[{v:"",l:"- Selecione -"}, ...obrasParaCopia.filter(o=>o.id!==obraDestinoId).map(o=>({v:o.id,l:o.name}))]}/>
                {copiarModal.obraOrigemId && (
                  orcsDaOrigem.length
                    ? <Sel label="Orçamento de origem *" value={copiarModal.orcOrigemId}
                           onChange={v=>setCopiarModal(m=>({...m,orcOrigemId:v}))}
                           options={[{v:"",l:"- Selecione -"}, ...orcsDaOrigem.map(o=>({v:o.id,l:`${o.nome} · V${o.versionNumber||1}`}))]}/>
                    : <p style={{fontSize:11.5,color:C.orange}}>Esta obra ainda não tem nenhum orçamento.</p>
                )}
                {copiarModal.orcOrigemId && (
                  <p style={{fontSize:11,color:C.muted}}>
                    {planoOrigemTemTarefas
                      ? "Esta origem tem um cronograma montado - será copiado junto, com as datas deslocadas para começar hoje."
                      : "Esta origem ainda não tem cronograma montado - só o orçamento será copiado."}
                  </p>
                )}
                {copiarModal.orcOrigemId && (
                  <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",padding:"8px 11px",
                          background: copiarModal.repetirQuantidades ? `${C.yellow}10` : C.surface,
                          border:`1.5px solid ${copiarModal.repetirQuantidades ? C.yellow : C.border}`,borderRadius:6}}>
                    <span style={{position:"relative",width:18,height:18,flexShrink:0,marginTop:1,display:"inline-block"}}>
                      <input type="checkbox" checked={copiarModal.repetirQuantidades}
                        onChange={e=>setCopiarModal(m=>({...m,repetirQuantidades:e.target.checked}))}
                        style={{position:"absolute",inset:0,width:"100%",height:"100%",margin:0,opacity:0,cursor:"pointer"}}/>
                      <div aria-hidden="true"
                           style={{width:18,height:18,borderRadius:4,
                                   border:`2px solid ${copiarModal.repetirQuantidades?C.yellow:C.muted}`,background:copiarModal.repetirQuantidades?C.yellow:"transparent",
                                   display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                        {copiarModal.repetirQuantidades && <span style={{color:"#fff",fontSize:11,fontWeight:900}}>ok</span>}
                      </div>
                    </span>
                    <div>
                      <p style={{fontSize:12.5,fontWeight:700,color:copiarModal.repetirQuantidades?C.yellow:C.text}}>Repetir as quantidades da obra de origem</p>
                      <p style={{fontSize:10.5,color:C.muted,marginTop:2,lineHeight:1.5}}>Desmarcado, os itens entram com quantidade zerada - a estrutura e o preço unitário de referência vêm, mas você lança a medida real desta obra.</p>
                    </div>
                  </label>
                )}
                <Inp label="Nome do novo orçamento" value={form.nome} onChange={F("nome")}
                     placeholder={copiarModal.orcOrigemId ? `Cópia de ${orcamentosParaCopia.find(o=>o.id===copiarModal.orcOrigemId)?.nome||""}` : ""}/>
                <div style={{display:"flex",gap:8}}>
                  <Btn v="ghost" onClick={()=>setCopiarModal(null)} full>Cancelar</Btn>
                  <Btn onClick={confirmarCopiaDeObra} full disabled={!copiarModal.orcOrigemId||!obraDestinoId}><Ic n="copy"/> Copiar</Btn>
                </div>
              </div>
            </Modal>
          );
        })()}

        <ConfirmDialog open={!!confirmDelOrc} onOpenChange={aberto=>!aberto&&setConfirmDelOrc(null)}
          title="Remover orçamento" tone="danger" confirmLabel="Remover"
          description={`Remover "${confirmDelOrc?.nome}"? Você pode desfazer logo em seguida, mas a opção some depois de alguns segundos.`}
          onConfirm={()=>executarDelOrc(confirmDelOrc.id)}/>
      </div>
    );
  }

  //  VIEW: EDITOR 
  if (!orc || !calc) { setView("lista"); return null; }

  return (
    <div className="anim" style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Voltar + título */}
      <button onClick={()=>{setView("lista");setSelOrc(null);}} style={{background:"transparent",border:0,color:C.muted,cursor:"pointer",fontSize:12,fontWeight:600,padding:0,textAlign:"left",display:"flex",alignItems:"center",gap:4}}>
        ← Todos os orçamentos
      </button>

      {undoEtapa && (
        <div style={{background:`${C.blue}0C`,border:`1px solid ${C.blue}55`,borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <p style={{fontSize:12,color:C.text}}>Etapa removida.</p>
          <Btn size="sm" v="ghost" onClick={desfazerDelEtapa}><Ic n="refresh" s={13}/> Desfazer</Btn>
        </div>
      )}

      {/* Resumo */}
      <div style={{background:C.bg,border:`1.5px solid ${C.border}`,borderTop:`3px solid ${C.yellow}`,borderRadius:8,padding:"14px 16px",boxShadow:`0 1px 4px ${C.shadow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{minWidth:0,flex:1}}>
            <p style={{fontSize:16,fontWeight:800,color:C.text}}>{orc.nome}</p>
            {orc.descricao && <p style={{fontSize:11,color:C.subtle,marginTop:3,lineHeight:1.45}}>{orc.descricao}</p>}
          </div>
          {!budgetIsImmutable(orc)&&<Btn size="sm" v="ghost" onClick={abrirEdicaoOrc}><Ic n="edit"/> Dados</Btn>}
        </div>
        <p style={{fontSize:11,color:C.muted,marginTop:2}}>
          {orc.fonte} {orc.uf}  {orc.dataBase||"sem data-base"}  {orc.desonerado?"Desonerado":"Não desonerado"}  BDI {orc.bdi}%
        </p>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7}}>{baselineAtiva.budget?.id===orc.id&&<Badge color={C.green}>BASELINE ATIVA</Badge>}<Badge color={budgetIsImmutable(orc)?C.blue:C.orange}>V{orc.versionNumber||1} · {budgetIsImmutable(orc)?"APROVADA E BLOQUEADA":"RASCUNHO EDITÁVEL"}</Badge>{budgetIsImmutable(orc)&&<Btn size="sm" onClick={criarRevisaoOrc}><Ic n="plus"/> Criar revisão</Btn>}{ehAdmin&&orc.obraId&&baselineAtiva.budget?.id!==orc.id&&<Btn size="sm" v="success" onClick={aprovarEAdotarBaseline}>{budgetIsImmutable(orc)?"Adotar como baseline":"Aprovar e adotar baseline"}</Btn>}</div>
        <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:8,marginTop:12}}>
          <SummaryCard label="Custo direto" value={fmt(calc.custoDireto)} tone="neutral"/>

          {/* BDI - clicável, com semáforo da faixa TCU */}
          {(() => {
            const sit = situacaoBDI(Number(orc.bdi||0), orc.bdiTipo || "edificios");
            const tomBDI = sit.st==="dentro" ? "info" : "warning";
            const detalheBDI = sit.st==="dentro" ? "Dentro da faixa TCU" : sit.st==="acima" ? "Acima do 3º quartil" : "Abaixo do 1º quartil";
            return (
              <SummaryCard label={`BDI ${orc.bdi}%`} value={fmt(calc.valorBDI)} detail={detalheBDI}
                tone={tomBDI} onClick={abrirBDI}/>
            );
          })()}

          <SummaryCard label="Total" value={fmt(calc.total)} tone="primary"/>

          <SummaryCard label={orc.areaM2>0?"Por m2":"Itens"} tone="success"
            value={orc.areaM2>0 ? fmt(calc.porM2) : String(calc.qtdItens)}/>
        </div>

        {/* Alerta quando o BDI está fora da faixa auditável */}
        {(() => {
          const sit = situacaoBDI(Number(orc.bdi||0), orc.bdiTipo || "edificios");
          if (sit.st === "dentro") return null;
          return (
            <button onClick={abrirBDI} style={{
              width:"100%", marginTop:8, textAlign:"left",
              background:`${sit.cor}0E`, border:`1px solid ${sit.cor}55`,
              borderRadius:6, padding:"8px 11px", cursor:"pointer",
            }}>
              <p style={{fontSize:11,fontWeight:700,color:sit.cor}}>
                ! BDI de {orc.bdi}% fora da faixa TCU para {sit.faixa.l.toLowerCase()}
              </p>
              <p style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.45}}>{sit.msg}</p>
            </button>
          );
        })()}
      </div>

      <div style={{display:"flex",gap:5,flexWrap:"wrap",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:5}}>
        {[
          ["orcamento","ORÇAMENTO"],
          ["insumos","INSUMOS E COMPOSIÇÕES / CURVA ABC"],
          ["proprias","COMPOSIÇÕES PRÓPRIAS"],
          ["memoria","MEMÓRIA DE CÁLCULO"],
        ].map(([valor,label])=><button key={valor} onClick={()=>setOrcAba(valor)} style={{
          flex:"1 1 180px",border:`1px solid ${orcAba===valor?C.blue:C.border}`,borderRadius:6,padding:"8px 10px",
          background:orcAba===valor?`${C.blue}12`:C.bg,color:orcAba===valor?C.blue:C.muted,
          fontSize:10.5,fontWeight:800,cursor:"pointer",fontFamily:"var(--arcd-font-sans)",
        }}>{label}</button>)}
      </div>

      {orcAba==="orcamento"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}><button onClick={()=>setFerramentasOrcAberto(v=>!v)} style={{width:"100%",border:0,background:"transparent",padding:"9px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Ic n="settings" s={14} color={C.blue}/><div><p style={{fontSize:11.5,fontWeight:850,color:C.text}}>Ferramentas do orçamento</p><p style={{fontSize:9,color:C.muted,marginTop:1}}>Importar, analisar e exportar</p></div></div><Ic n={ferramentasOrcAberto?"chevron":"chevR"} s={14} color={C.muted}/></button>{ferramentasOrcAberto&&<div style={{borderTop:`1px solid ${C.line}`,padding:8,display:"grid",gridTemplateColumns:cols(2,3,6),gap:6}}><label style={{display:"flex"}}><input type="file" accept=".xlsx,.xls" disabled={basePorCodigo.size===0||impLoad} onChange={e=>{importarOrcamentoXLSX(e.target.files?.[0]);e.target.value="";}} style={{display:"none"}}/><span style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:5,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 8px",fontSize:9.5,fontWeight:800,color:basePorCodigo.size?C.blue:C.muted,cursor:basePorCodigo.size?"pointer":"not-allowed"}}><Ic n="download" s={12}/> Importar planilha</span></label><Btn size="sm" v="ghost" onClick={()=>setOrcAba("insumos")}><Ic n="chart"/> Curva ABC</Btn><Btn size="sm" v="danger" onClick={exportPDF}><Ic n="file"/> PDF</Btn><Btn size="sm" v="success" onClick={exportXLSX}><Ic n="download"/> Excel completo</Btn><Btn size="sm" v="success" onClick={exportXLSXExportado}><Ic n="download"/> Excel padrão</Btn><Btn size="sm" v="ghost" onClick={exportXLSXCurvaABC}><Ic n="download"/> Excel ABC</Btn></div>}</div>}

      {orcAba==="orcamento"&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
        <button onClick={()=>setControleCustosAberto(v=>!v)} style={{width:"100%",border:0,background:"transparent",padding:"11px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Ic n="chart" s={15} color={C.green}/><div><p style={{fontSize:12,fontWeight:850,color:C.text}}>Controle integrado de custos</p><p style={{fontSize:9.5,color:C.muted,marginTop:1}}>Orçamento, compras, recebimento, aplicação e pagamento por etapa de 1º nível</p></div></div><Ic n={controleCustosAberto?"chevron":"chevR"} s={14} color={C.muted}/></button>
        {controleCustosAberto&&<div style={{borderTop:`1px solid ${C.line}`,padding:10}}>
          <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:6,marginBottom:9}}>{[["Orçado",controleCustos.total.orcado,C.blue],["Comprometido",controleCustos.total.comprometido,C.orange],["Saldo",controleCustos.total.saldo,controleCustos.total.saldo<0?C.red:C.green],["Projeção",controleCustos.total.projecao,controleCustos.total.projecao>controleCustos.total.orcado?C.red:C.purple]].map(([l,v,c])=><div key={l} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`3px solid ${c}`,borderRadius:6,padding:"7px 9px"}}><p style={{fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>{l}</p><p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:15,fontWeight:900,color:c,marginTop:2}}>{fmt(v)}</p></div>)}</div>
          <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:7}}><table style={{width:"100%",minWidth:850,borderCollapse:"collapse",fontSize:10.5}}><thead><tr style={{background:C.surface,color:C.muted,textAlign:"right"}}>{["Etapa de 1º nível","Orçado","Solicitado","Comprometido","Recebido","Aplicado","Pago","Saldo"].map((h,i)=><th key={h} style={{padding:"7px 8px",textAlign:i?"right":"left",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{controleCustos.etapas.map(l=><tr key={l.id} style={{borderTop:`1px solid ${C.line}`}}><td style={{padding:"8px",fontWeight:800,color:C.text}}>{l.nome}</td>{[l.orcado,l.solicitado,l.comprometido,l.recebido,l.aplicado,l.pago,l.saldo].map((v,i)=><td key={i} style={{padding:"8px",textAlign:"right",whiteSpace:"nowrap",fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontWeight:i===6?850:600,color:i===6&&v<0?C.red:C.text}}>{fmt(v)}</td>)}</tr>)}</tbody></table></div>
          {Object.values(controleCustos.semApropriacao).some(v=>v>0)&&<p style={{fontSize:9.5,color:C.orange,marginTop:7,lineHeight:1.45}}>Atenção: existem valores sem linha orçamentária vinculada — solicitado {fmt(controleCustos.semApropriacao.solicitado)}, comprometido {fmt(controleCustos.semApropriacao.comprometido)}, recebido {fmt(controleCustos.semApropriacao.recebido)} e aplicado {fmt(controleCustos.semApropriacao.aplicado)}. Eles não foram distribuídos artificialmente entre as etapas.</p>}
          <p style={{fontSize:9,color:C.muted,marginTop:6}}>Projeção atual = maior valor entre orçamento e compromissos assumidos. “Pago” exige pedido vinculado a uma transação conciliada.</p>
        </div>}
      </div>}

      {orcAba==="orcamento" && <>
      {/* CONFERENCIA DIMENSIONAL (IA) - forro x area construida etc */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
        <button onClick={()=>setConfAberta(v=>!v)} style={{
          width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",
          gap:8,padding:"12px 14px",background:"transparent",border:0,cursor:"pointer",textAlign:"left",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
            <Ic n="brain" s={17} color={C.purple}/>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:800,color:C.text}}>Auditoria técnica do orçamento</p>
              <p style={{fontSize:10.5,color:C.muted,marginTop:1}}>
                Escopo, preços, cotações, itens esquecidos, interfaces e quantitativos
              </p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {checklistAuditoria.filter(item=>item.status==="pendente").length > 0 && (
              <span style={{fontSize:10,fontWeight:800,color:C.red,background:`${C.red}14`,
                            padding:"2px 8px",borderRadius:12}}>
                {checklistAuditoria.filter(item=>item.status==="pendente").length} pendente(s)
              </span>
            )}
            {checklistAuditoria.length>0&&checklistAuditoria.every(item=>item.status!=="pendente") && (
              <span style={{fontSize:10,fontWeight:800,color:C.green,background:`${C.green}14`,
                            padding:"2px 8px",borderRadius:12}}>ok</span>
            )}
            <Ic n={confAberta ? "chevron" : "chevR"} s={16} color={C.muted}/>
          </div>
        </button>

        {confAberta && (
          <div style={{padding:"0 14px 14px",borderTop:`1px solid ${C.line}`}}>
            <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:6,marginTop:10}}>
              {[
                ["Falhas prováveis",auditoriaResultado?.resumo.criticos||0,C.red],
                ["Atenções",auditoriaResultado?.resumo.atencoes||0,C.orange],
                ["Cotações",auditoriaResultado?.resumo.cotacoes||0,C.blue],
                ["Confirmar escopo",auditoriaResultado?.resumo.escopo||0,C.purple],
              ].map(([label,value,color])=><div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderTop:`3px solid ${color}`,borderRadius:6,padding:"7px 9px"}}><p style={{fontSize:8.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>{label}</p><p style={{fontSize:18,fontWeight:900,color}}>{value}</p></div>)}
            </div>

            <div style={{display:"flex",gap:5,marginTop:9,overflowX:"auto"}}>
              {[["pendente","Pendentes"],["corrigido","Corrigidos"],["ignorado","Ignorados"],["todos","Todos"]].map(([valor,label])=>{
                const quantidade=valor==="todos"?checklistAuditoria.length:checklistAuditoria.filter(item=>item.status===valor).length;
                return <button key={valor} onClick={()=>setCheckFiltro(valor)} style={{border:`1px solid ${checkFiltro===valor?C.yellowD:C.border}`,background:checkFiltro===valor?`${C.yellow}18`:C.card,color:checkFiltro===valor?C.text:C.muted,borderRadius:6,padding:"5px 8px",fontSize:9,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>{label} · {quantidade}</button>;
              })}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:7}}>
              {checklistAuditoria.filter(item=>checkFiltro==="todos"||item.status===checkFiltro).map(achado=>{
                const cor=achado.nivel==="critico"?C.red:achado.nivel==="atencao"?C.orange:achado.nivel==="cotacao"?C.blue:C.purple;
                const rotulo=achado.nivel==="critico"?"FALHA PROVÁVEL":achado.nivel==="atencao"?"ATENÇÃO":achado.nivel==="cotacao"?"COTAÇÃO":"CONFIRMAR ESCOPO";
                const corStatus=achado.status==="corrigido"?C.green:achado.status==="ignorado"?C.muted:C.orange;
                return <div key={achado.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`3px solid ${cor}`,borderRadius:7,padding:"8px 10px",opacity:achado.ativo===false?.72:1}}><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:8,fontWeight:900,color:cor,background:`${cor}12`,padding:"2px 5px",borderRadius:4}}>{rotulo}</span><span style={{fontSize:8,fontWeight:900,color:corStatus,background:`${corStatus}12`,padding:"2px 5px",borderRadius:4}}>{achado.status==="corrigido"?"CORRIGIDO":achado.status==="ignorado"?"IGNORADO":"PENDENTE"}</span>{achado.origem==="ia"&&<span style={{fontSize:8,fontWeight:900,color:C.purple}}>IA</span>}<p style={{fontSize:11.5,fontWeight:800,color:C.text,flex:"1 1 220px"}}>{achado.titulo}</p><Btn size="sm" v="ghost" onClick={()=>setCheckEdit({...achado})}>Revisar</Btn></div><p style={{fontSize:9.5,color:C.muted,lineHeight:1.45,marginTop:3}}>{achado.detalhe}</p>{achado.acaoSugerida&&<p style={{fontSize:9.5,color:C.subtle,lineHeight:1.45,marginTop:4}}><b>Próxima ação:</b> {achado.acaoSugerida}</p>}{achado.observacao&&<p style={{fontSize:9,color:C.text,marginTop:5,padding:"5px 7px",background:C.card,borderRadius:5}}><b>Decisão:</b> {achado.observacao}{achado.atualizadoPor?` · ${achado.atualizadoPor}`:""}</p>}</div>;
              })}
              {checklistAuditoria.filter(item=>checkFiltro==="todos"||item.status===checkFiltro).length===0&&<p style={{fontSize:10,color:C.muted,padding:"9px",textAlign:"center"}}>Nenhum item neste estado.</p>}
            </div>

            <div style={{marginTop:11}}>
              <Btn v="ghost" size="sm" full onClick={analisarDimensionalIA} disabled={confIALoad||!(orc.itens||[]).some(item=>item.tipo!=="titulo")}>
                {confIALoad ? "Auditando orçamento..." : (<><Ic n="brain" s={14}/> Pedir segunda análise da IA</>)}
              </Btn>
              {confIA && <div style={{marginTop:9,background:`${C.purple}08`,border:`1px solid ${C.purple}33`,borderRadius:6,padding:"10px 12px"}}><p style={{fontSize:11,color:C.subtle,lineHeight:1.55}}>{confIA.resumo}</p>{confIA.achados?.length>0&&<p style={{fontSize:9,color:C.purple,fontWeight:800,marginTop:5}}>{confIA.achados.length} novo(s) item(ns) incluído(s) no checklist acima.</p>}{confIA.perguntas?.map((pergunta,i)=><p key={i} style={{fontSize:9.5,color:C.muted,marginTop:4}}>• {pergunta}</p>)}</div>}
            </div>

            <p style={{fontSize:10,fontWeight:900,color:C.text,marginTop:13,marginBottom:6,textTransform:"uppercase"}}>Conferência dimensional</p>
            {!confResultado?.temArea ? (
              <p style={{fontSize:11.5,color:C.muted,lineHeight:1.55,marginTop:10}}>
                Para conferir, cadastre a <strong>area construida</strong> no orcamento (campo
                "Area construida" na edicao) ou na obra vinculada. Sem area de referencia
                nao da para comparar as quantidades.
              </p>
            ) : confResultado.linhas.length === 0 ? (
              <p style={{fontSize:11.5,color:C.muted,lineHeight:1.55,marginTop:10}}>
                Nenhum item medido em m2 reconhecido (forro, piso, paredes, pintura...).
                A conferencia atua sobre itens de area.
              </p>
            ) : (
              <>
                <p style={{fontSize:10.5,color:C.muted,marginTop:10,marginBottom:8}}>
                  Base: <strong>{areaRef.toFixed(0)} m2</strong> de area construida
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {confResultado.linhas.map(l => {
                    const cor = l.status === "alto" ? C.red
                              : l.status === "baixo" ? C.orange : C.green;
                    return (
                      <div key={l.chave} style={{background:C.surface,border:`1px solid ${C.border}`,
                           borderLeft:`3px solid ${cor}`,borderRadius:7,padding:"8px 11px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize:12,fontWeight:700,color:C.text,textTransform:"capitalize"}}>{l.nome}</p>
                            <p style={{fontSize:10,color:C.muted,marginTop:1}}>
                              lancado {l.qtd.toLocaleString("pt-BR",{maximumFractionDigits:1})} m2
                              {" - "}esperado ~{l.esperado.toLocaleString("pt-BR",{maximumFractionDigits:0})} m2
                            </p>
                          </div>
                          <span style={{fontSize:12,fontWeight:800,color:cor,flexShrink:0}}>
                            {l.difPct > 0 ? "+" : ""}{l.difPct.toFixed(0)}%
                          </span>
                        </div>
                        {l.status !== "ok" && (
                          <p style={{fontSize:9.5,color:C.muted,marginTop:4,lineHeight:1.4}}>{l.obs}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p style={{fontSize:9.5,color:C.muted,marginTop:10,lineHeight:1.45}}>
                  A conferencia e um alerta, nao uma regra: projetos com pe-direito alto, muitos
                  vazios ou sacadas fogem dos fatores medios. Voce decide o que ajustar.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Centro técnico de bases: fica resumido para a planilha continuar sendo o foco. */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden"}}>
        <button onClick={()=>setBasesPainelAberto(v=>!v)} style={{width:"100%",border:0,background:"transparent",padding:"11px 13px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,cursor:"pointer",textAlign:"left"}}>
          <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}><span style={{width:31,height:31,borderRadius:8,display:"grid",placeItems:"center",background:`${C.blue}10`,color:C.blue,flexShrink:0}}><Ic n="box" s={15}/></span><div style={{minWidth:0}}><p style={{fontSize:12.5,fontWeight:850,color:C.text}}>Bases e preços</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>{basesVinculadas.length} vinculada(s) · {basesConsolidadas.length} base(s) única(s) · atualização automática por código</p></div></div>
          <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>{totalBasesDuplicadas>0&&<span style={{fontSize:9,fontWeight:800,color:C.orange,background:`${C.orange}12`,padding:"3px 7px",borderRadius:99}}>{totalBasesDuplicadas} REPETIDA(S)</span>}{basesVinculadas.length>0&&<span style={{fontSize:9,fontWeight:800,color:C.green,background:`${C.green}12`,padding:"3px 7px",borderRadius:99}}>OPERACIONAL</span>}<Ic n={basesPainelAberto?"chevron":"chevR"} s={15} color={C.muted}/></div>
        </button>
      </div>

      {basesPainelAberto&&<>
      {/* Cadastro/importação de bases (SINAPI/ORSE) é exclusivo do
          administrador agora, em BasesPrecoAdmin (Central do Administrador).
          Aqui fica só pesquisa, vínculo a uma base já cadastrada e reprecificação -
          disponível para qualquer usuário com acesso ao orçamento. */}
      <div style={{background:C.card,border:`1.5px solid ${C.blue}55`,borderLeft:`5px solid ${C.blue}`,borderRadius:8,padding:"13px 14px",display:"flex",flexDirection:"column",gap:11}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
          <div style={{minWidth:0,flex:1}}>
            <p style={{fontSize:14,fontWeight:800,color:C.text}}>Bases de referência no Supabase</p>
            <p style={{fontSize:10.5,color:C.muted,marginTop:3,lineHeight:1.5}}>Vincule SINAPI e ORSE ao mesmo orçamento e atualize os preços pelos códigos já lançados.</p>
          </div>
          <Btn size="sm" v="success" disabled={atualizandoPrecos || basesVinculadas.length===0} onClick={atualizarPrecosVinculados}>
            {atualizandoPrecos ? "Atualizando..." : "Atualizar preços dos itens"}
          </Btn>
        </div>
        {basesCarregando ? <p style={{fontSize:11,color:C.muted}}>Carregando bases cadastradas...</p>
        : basesVinculadas.length > 0 ? (
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {basesVinculadas.map(base => { const cor=base.fonte==="ORSE"?C.purple:C.blue; return (
              <div key={base.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:`${cor}0B`,border:`1px solid ${cor}3D`,padding:"8px 10px",borderRadius:6}}>
                <div style={{minWidth:0}}>
                  <p style={{fontSize:11.5,fontWeight:800,color:cor}}>{base.fonte} · {base.dataBase}{base.uf?` · ${base.uf}`:""}</p>
                  <p title={base.arquivo} style={{fontSize:9.5,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{base.fonte==="ORSE"?"Pesquisa oficial CEHOP":`${base.total.toLocaleString("pt-BR")} composições no Supabase`}{base.arquivo?` · ${base.arquivo}`:""}</p>
                </div>
                {ehAdmin&&<button onClick={()=>desvincularBase(base)} title="Desvincular" style={{border:`1px solid ${C.border}`,background:C.bg,color:C.muted,width:28,height:28,borderRadius:6,cursor:"pointer",fontWeight:900}}>×</button>}
              </div>); })}
          </div>
        ) : <div style={{background:C.surface,border:`1px dashed ${C.border}`,padding:10,borderRadius:6}}><p style={{fontSize:11,color:C.muted}}>Nenhuma base do Supabase vinculada a este orçamento.</p></div>}

        {basesDisponiveis.length>0 && <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:7,alignItems:"end"}}><Sel label="Vincular uma base já cadastrada" value={baseParaVincular} onChange={setBaseParaVincular} options={[{v:"",l:"Selecione"},...basesDisponiveis.map(base=>({v:base.id,l:`${base.fonte} ${base.dataBase}${base.uf?` · ${base.uf}`:""} · ${base.total||"oficial"}`}))]}/><Btn size="sm" v="info" disabled={!baseParaVincular} onClick={vincularBaseExistente}>Vincular</Btn></div>}
        <p style={{fontSize:9.5,color:C.muted,lineHeight:1.5}}>Ao alterar um código na linha, fonte, descrição, unidade e custo unitário são consultados e atualizados automaticamente. Cadastro de novas bases é feito pelo administrador em Central do Administrador → Bases de preço.</p>
        {(data.baseFavoritos||[]).length > 0 && (
          <p style={{fontSize:11,color:C.muted,paddingTop:9,borderTop:`1px solid ${C.line}`}}>
            {(data.baseFavoritos||[]).length} composição(ões) na sua base de favoritos (sempre disponível, sem depender de nenhuma base vinculada)
          </p>
        )}
      </div>
      </>}

      {/* Árvore de etapas + itens */}
      {(() => {
        // Render recursivo. Cada nível recua um pouco e afina a barra lateral,
        // dando a leitura de hierarquia sem depender de ícones de expandir.
        const CoresNivel = [C.yellow, C.blue, C.purple, C.green, C.orange];

        // Funcao de render, NAO componente. Declarar um componente dentro do
        // corpo do render cria um tipo novo a cada passagem: o React joga fora
        // toda a arvore de etapas e monta outra do zero. Era isso que zerava a
        // altura da pagina - e o navegador, sem conteudo abaixo, jogava o
        // scroll para o topo a cada tecla. Como funcao comum, o React reconhece
        // os mesmos elementos, atualiza so o que mudou e o scroll fica parado.
        const renderEtapa = (no) => {
          const cor = CoresNivel[(no.nivel - 1) % CoresNivel.length];
          const podeSub = no.nivel < MAX_NIVEL;
          const recuo = (no.nivel - 1) * 10;
          const recolhida = !!etapasFechadas[no.id];

          return (
            <div key={no.id} style={{ marginLeft: recuo }}>
              <div style={{
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderLeft: `${Math.max(4 - (no.nivel - 1), 2)}px solid ${cor}`,
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: `0 1px 3px ${C.shadow}`,
                marginBottom: 6,
              }}>
                {/* Cabeçalho da etapa */}
                <div style={{
                  background: no.nivel === 1 ? C.surface : `${cor}06`,
                  padding: no.nivel === 1 ? "9px 12px" : "7px 12px",
                  borderBottom: (no.itens.length || no.sub.length) ? `1px solid ${C.line}55` : "none",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontSize: Math.max(12 - (no.nivel - 1), 10),
                      fontWeight: no.nivel === 1 ? 800 : 700,
                      color: C.text, lineHeight: 1.3,
                    }}>
                      <span style={{ color: cor, marginRight: 5 }}>{no.codigo}</span>
                      {no.nome}
                    </p>
                    {(no.itens.length > 0 || no.sub.length > 0) && (
                      <p style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>
                        {no.sub.length > 0 && `${no.sub.length} subnível(is)`}
                        {no.sub.length > 0 && no.itens.length > 0 && "  "}
                        {no.itens.length > 0 && `${no.itens.length} item(ns)`}
                        {no.total > 0 && `  ${no.pct.toFixed(1)}%`}
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <button onClick={()=>setEtapasFechadas(f=>({...f,[no.id]:!f[no.id]}))}
                      title={recolhida?"Expandir nível":"Recolher nível"}
                      aria-expanded={!recolhida}
                      style={{background:recolhida?`${cor}12`:"transparent",border:`1px solid ${C.border}`,color:cor,
                               borderRadius:5,width:alvoToque,height:alvoToque,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,lineHeight:1,fontWeight:900}}>
                      {recolhida?"▸":"▾"}
                    </button>
                    {no.total > 0 && (
                      <p style={{ fontSize: 12, fontWeight: 800, color: cor, marginRight: 2 }}>{fmt(no.total)}</p>
                    )}
                    <button onClick={() => { setEtapaAlvo(no.id); setBusca(""); setBuscaModal(true); }}
                      title="Adicionar item"
                      style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.text,
                               borderRadius:5, width:alvoToque, height:alvoToque, cursor:"pointer", display:"flex",alignItems:"center",justifyContent:"center", fontSize:13, lineHeight:1 }}>+</button>
                    <button onClick={() => abrirExterno(no.id)}
                      title="Nova composição externa ou cotação"
                      style={{background:"transparent",border:`1px solid ${C.border}`,color:C.green,
                               borderRadius:5,width:alvoToque,height:alvoToque,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,lineHeight:1,fontWeight:800}}>R$</button>
                    <button onClick={() => addTitulo(no.id)}
                      title="Adicionar título (texto sem valor)"
                      style={{ background:"transparent", border:`1px solid ${C.border}`, color:C.muted,
                               borderRadius:5, width:alvoToque, height:alvoToque, cursor:"pointer", display:"flex",alignItems:"center",justifyContent:"center", fontSize:10,
                               lineHeight:1, fontWeight:800 }}>T</button>
                    {podeSub && (
                      <button onClick={() => abrirNovaEtapa(no.id)}
                        title="Criar subnível"
                        style={{ background:"transparent", border:`1px solid ${C.border}`, color:cor,
                                 borderRadius:5, width:alvoToque, height:alvoToque, cursor:"pointer", display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <Ic n="cornerDownRight" s={13}/>
                      </button>
                    )}
                    <button onClick={() => abrirEditarEtapa(no)}
                      title="Renomear"
                      style={{ background:"transparent", border:0, color:C.muted, cursor:"pointer", width:alvoToque, height:alvoToque, display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <Ic n="edit" s={13}/>
                    </button>
                    <button onClick={() => delEtapa(no)}
                      title="Excluir"
                      style={{ background:"transparent", border:0, color:C.muted, cursor:"pointer", width:alvoToque, height:alvoToque, display:"flex",alignItems:"center",justifyContent:"center", fontSize:15, lineHeight:1 }}>x</button>
                  </div>
                </div>

                {/* Sub-etapas */}
                {!recolhida && no.sub.length > 0 && (
                  <div style={{ padding: "6px 6px 0" }}>
                    {no.sub.map(sn => renderEtapa(sn))}
                  </div>
                )}

                {/* Linhas desta etapa: títulos e itens */}
                {!recolhida && no.itens.map((it, idx) => {
                  const primeira = idx === 0;
                  const ultima   = idx === no.itens.length - 1;

                  // Setas de reordenar - compartilhadas pelos dois tipos de linha.
                  // Funcao comum, NAO componente: um componente declarado aqui
                  // dentro nasce com identidade nova a cada render e faria o
                  // React desmontar e remontar a linha inteira.
                  const setas = () => (
                    <div style={{ display:"flex", flexDirection:"column", gap:1, flexShrink:0 }}>
                      <button onClick={() => moverLinha(it.id, -1)} disabled={primeira}
                        title="Mover para cima"
                        style={{ background:"transparent", border:0, cursor: primeira?"default":"pointer",
                                 color: primeira ? C.line : C.muted, width:isMobile?44:14, height:isMobile?22:11,
                                 display:"flex",alignItems:"center",justifyContent:"center", lineHeight:1 }}>
                        <Ic n="chevUp" s={isMobile?13:9}/>
                      </button>
                      <button onClick={() => moverLinha(it.id, +1)} disabled={ultima}
                        title="Mover para baixo"
                        style={{ background:"transparent", border:0, cursor: ultima?"default":"pointer",
                                 color: ultima ? C.line : C.muted, width:isMobile?44:14, height:isMobile?22:11,
                                 display:"flex",alignItems:"center",justifyContent:"center", lineHeight:1 }}>
                        <Ic n="chevron" s={isMobile?13:9}/>
                      </button>
                    </div>
                  );

                  //  Linha de TÍTULO: texto puro, sem código, sem valor 
                  if (it.tipo === "titulo") {
                    return (
                      <div key={it.id} style={{
                        padding: "7px 12px",
                        borderTop: `1px solid ${C.line}33`,
                        background: `${C.surface}`,
                        display: "flex", gap: 8, alignItems: "center",
                      }}>
                        <p style={{ fontSize:9, color:C.muted, fontWeight:700, minWidth:38 }}>
                          {it.codigoItem}
                        </p>
                        <CelulaTexto
                          value={it.descricao||""}
                          onCommit={valor => updTituloTexto(it.id, valor)}
                          placeholder="Título - ex.: Pavimento térreo"
                          style={{
                            flex:1, minWidth:0,
                            background:"transparent", border:0, borderBottom:`1px dashed ${C.border}`,
                            color:C.text, padding:"3px 0", outline:"none",
                            fontSize:11.5, fontWeight:700, letterSpacing:.3,
                            textTransform:"uppercase",
                            fontFamily:"var(--arcd-font-sans)",
                          }}
                        />
                        {setas()}
                        <button onClick={() => delItem(it.id)} title="Excluir título"
                          style={{ background:"transparent", border:0, color:C.muted, cursor:"pointer",
                                   fontSize:14, padding:"0 2px", lineHeight:1, flexShrink:0 }}>x</button>
                      </div>
                    );
                  }

                  //  Linha de ITEM: composição com valor 
                  const tot = itemTotal(it, orc.bdi);
                  const codigoPendente = !!it.codigoNaoEncontrado || !String(it.codigo||"").trim();
                  const alterado = precoAlterado(it);
                  const bdiEfetivo = bdiDoItem(it, orc.bdi);
                  const arrastando = arrastandoItem === it.id;
                  const alvoDrop   = sobreItem === it.id && arrastandoItem && arrastandoItem !== it.id;

                  // Monta a grade conforme as colunas visiveis. A alca de arrastar,
                  // fonte, descricao e quantidade sao fixas; as demais entram por colsOrc.
                  const gc = ["16px"];                       // alca de arrastar
                  gc.push("38px");                           // codigoItem (numeracao)
                  gc.push("58px");                           // fonte
                  if (colsOrc.codigo)    gc.push("92px");    // codigo editavel
                  gc.push("minmax(80px,1fr)");               // descricao (busca)
                  if (colsOrc.unidade)   gc.push("52px");    // unidade
                  gc.push("56px");                           // quantidade
                  if (colsOrc.custoUnit) gc.push("84px");    // custo unitario
                  if (colsOrc.bdi)       gc.push("56px");    // BDI proprio
                  gc.push("18px");                           // setas
                  if (colsOrc.total)     gc.push("165px");   // total + acoes (comp./editar/x)

                  return (
                    <div key={it.id}
                      className="budget-line-row"
                      draggable
                      onDragStart={e => { setArrastandoItem(it.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setArrastandoItem(null); setSobreItem(null); }}
                      onDragOver={e => { e.preventDefault(); if (sobreItem !== it.id) setSobreItem(it.id); }}
                      onDrop={e => { e.preventDefault(); moverItemPara(arrastandoItem, it.id); setArrastandoItem(null); setSobreItem(null); }}
                      style={{
                      padding: "7px 10px", borderTop: `1px solid ${C.line}33`,
                      display:"grid",gridTemplateColumns:gc.join(" "),
                      gap:6,alignItems:"center",width:"100%",boxSizing:"border-box",overflow:"hidden",
                      borderLeft: alvoDrop ? `3px solid ${C.blue}` : codigoPendente ? `3px solid ${C.orange}` : "3px solid transparent",
                      background: arrastando ? `${C.blue}12` : codigoPendente ? `${C.orange}09` : "transparent",
                      opacity: arrastando ? .5 : 1,
                    }}>
                      {/* Alca de arrastar */}
                      <span title="Arraste para reordenar" style={{cursor:"grab",color:C.muted,fontSize:12,lineHeight:1,userSelect:"none",textAlign:"center"}}>::</span>
                      <p style={{fontSize:9,color:C.muted,fontWeight:700,minWidth:0,whiteSpace:"nowrap"}}>
                        {it.codigoItem}
                      </p>
                      <div title="Fonte" style={{minWidth:0,overflow:"hidden"}}>
                        <span style={{display:"block",fontSize:9.5,fontWeight:800,color:it.fonte==="ORSE"?C.purple:C.blue,whiteSpace:"nowrap"}}>{it.fonte}</span>
                      </div>
                      {colsOrc.codigo && (
                      <div style={{minWidth:0,overflow:"hidden"}}>
                          <CelulaTexto value={it.codigo||""}
                            onCommit={valor=>updItemCampo(it.id,"codigo",valor)}
                            placeholder="Sem código" title={codigoAtualizando===it.id?"Consultando código nas bases...":codigoPendente?"Código não localizado na base":"Código da composição"}
                            style={{width:"100%",boxSizing:"border-box",background:codigoPendente?`${C.orange}12`:C.bg,border:`1.5px solid ${codigoPendente?C.orange:C.border}`,color:codigoPendente?C.orange:C.text,padding:"5px 7px",borderRadius:5,fontSize:10,outline:"none",textTransform:"uppercase",fontFamily:"var(--arcd-font-mono)"}}/>
                      </div>
                      )}
                      <div style={{minWidth:0,overflow:"hidden"}}>
                        <CelulaTexto value={it.descricao||""}
                          onDigitar={e=>setBuscaLinha({itemId:it.id,termo:e.target.value})}
                          onCommit={valor=>{
                            updItemCampo(it.id,"descricao",valor);
                            setBuscaLinha(atual=>atual.itemId===it.id?{itemId:"",termo:""}:atual);
                          }}
                          onEscape={()=>setBuscaLinha({itemId:"",termo:""})}
                          onEnter={()=>{
                            if(buscaLinha.itemId===it.id && resultadosLinha.length) {
                              selecionarReferenciaLinha(it.id,resultadosLinha[0]);
                              return true;   // a referencia manda: nao gravar o texto digitado
                            }
                            return false;
                          }}
                          title="Digite para pesquisar por descrição nas bases vinculadas"
                          style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"5px 7px",borderRadius:5,fontSize:11.5,outline:"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textTransform:"uppercase",fontFamily:"var(--arcd-font-sans)"}}/>
                      </div>
                      {colsOrc.unidade && (
                      <div style={{minWidth:0,overflow:"hidden"}}>
                          <CelulaTexto value={it.unidade||""}
                            onCommit={valor=>updItemCampo(it.id,"unidade",valor)}
                            title="Unidade do item"
                            style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"5px 7px",borderRadius:5,fontSize:10,outline:"none",textTransform:"uppercase",fontFamily:"var(--arcd-font-sans)"}}/>
                      </div>
                      )}
                      <div style={{minWidth:0,overflow:"hidden"}}>
                          <CelulaTexto type="number" step="any" inputMode="decimal" value={String(it.quantidade ?? "")}
                            onCommit={valor => updItemQtd(it.id, valor)}
                            title="Quantidade"
                            style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"5px 7px",borderRadius:5,fontSize:11,outline:"none",fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums"}}/>
                      </div>
                      {colsOrc.custoUnit && (
                      <div title={alterado?`Base: ${fmt(it.precoRef)} - editado`:"Custo unitário sem BDI"} style={{minWidth:0,overflow:"hidden",position:"relative"}}>
                          <CelulaTexto type="number" step="any" inputMode="decimal" value={String(it.precoUnit ?? "")}
                            onCommit={valor => updItemNumero(it.id, "precoUnit", valor)}
                            title={alterado?`Preço editado. Base da composição: ${fmt(it.precoRef)}. Duplo clique para restaurar.`:"Custo unitário sem BDI"}
                            onDoubleClick={()=>{ if(alterado) restaurarPrecoRef(it.id); }}
                            style={{width:"100%",boxSizing:"border-box",textAlign:"right",
                              background: alterado?`${C.yellow}14`:C.bg,
                              border:`1.5px solid ${alterado?C.yellowD:C.border}`,
                              color: alterado?C.yellowD:C.text, fontWeight: alterado?800:400,
                              padding:"5px 7px",borderRadius:5,fontSize:10.5,outline:"none",fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums"}}/>
                      </div>
                      )}
                      {colsOrc.bdi && (
                      <div title="BDI desta linha (vazio = usa o BDI global)" style={{minWidth:0,overflow:"hidden"}}>
                          <CelulaTexto type="number" step="any" inputMode="decimal"
                            value={it.bdi===""||it.bdi==null?"":String(it.bdi)}
                            placeholder={String(orc.bdi)}
                            onCommit={valor => updItemNumero(it.id, "bdi", valor===""?"":valor)}
                            style={{width:"100%",boxSizing:"border-box",textAlign:"right",
                              background:C.bg,border:`1.5px solid ${C.border}`,
                              color: (it.bdi!==""&&it.bdi!=null)?C.text:C.muted,
                              padding:"5px 7px",borderRadius:5,fontSize:10,outline:"none",fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums"}}/>
                      </div>
                      )}
                      {setas()}
                      {colsOrc.total && (
                      <div style={{minWidth:0,overflow:"hidden",textAlign:"right",whiteSpace:"nowrap"}}>
                        <span title={`Preço total com BDI (${bdiEfetivo}%)`} style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:12,fontWeight:800,color:alterado?C.yellowD:C.text}}>{fmt(tot)}</span>
                        <button onClick={() => analisarItemDoOrcamento(it)}
                          title="Ver a composição analítica deste item"
                          style={{background:"transparent",border:0,color:C.green,cursor:"pointer",fontSize:10,fontWeight:800,padding:"0 3px",marginLeft:4}}>Comp.</button>
                        <button onClick={() => setEditItem({...it})}
                          title={it.composicao?"Editar item e composição":"Editar item"}
                          style={{background:"transparent",border:0,color:C.blue,cursor:"pointer",fontSize:10,padding:"0 3px"}}>Editar</button>
                        <button onClick={() => delItem(it.id)} title="Excluir item"
                          style={{background:"transparent",border:0,color:C.muted,cursor:"pointer",fontSize:13,padding:0}}>x</button>
                      </div>
                      )}
                      {buscaLinha.itemId===it.id && buscaLinha.termo.trim().length>=2 && (
                        <div style={{
                          gridColumn:"4 / -1",minWidth:0,maxHeight:230,overflowY:"auto",
                          background:C.bg,border:`1.5px solid ${C.blue}`,borderRadius:7,
                          boxShadow:`0 8px 20px ${C.shadow}`,padding:5,zIndex:20,
                        }}>
                          <p style={{fontSize:9.5,color:C.muted,padding:"3px 6px 5px"}}>
                            {buscaLinhaLoading ? "Pesquisando nas bases vinculadas..." : "Selecione uma composição para atualizar código, unidade e preço"}
                          </p>
                          {buscaLinhaAviso && <p style={{fontSize:9.5,color:C.orange,padding:"2px 6px 5px"}}>{buscaLinhaAviso}</p>}
                          {resultadosLinha.slice(0,12).map((resultado,indice)=>(
                            <button key={`${resultado.fonte}-${resultado.codigo}-${indice}`}
                              onMouseDown={e=>e.preventDefault()}
                              onClick={()=>selecionarReferenciaLinha(it.id,resultado)}
                              style={{width:"100%",display:"grid",gridTemplateColumns:"74px minmax(0,1fr) 78px",gap:7,
                                alignItems:"center",background:"transparent",border:0,borderTop:indice?`1px solid ${C.line}`:"none",
                                padding:"6px",textAlign:"left",cursor:"pointer",fontFamily:"var(--arcd-font-sans)"}}>
                              <span style={{fontSize:9.5,fontWeight:800,color:resultado.fonte==="ORSE"?C.purple:C.blue,whiteSpace:"nowrap"}}>
                                {resultado.fonte||"SINAPI"} {resultado.codigo}
                              </span>
                              <span title={resultado.descricao} style={{fontSize:10.5,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                                {resultado.descricao}
                              </span>
                              <span style={{fontSize:10,fontWeight:800,color:C.yellowD,textAlign:"right",whiteSpace:"nowrap"}}>
                                {fmt(precoDoItem(resultado,orc))}/{resultado.unidade||"UN"}
                              </span>
                            </button>
                          ))}
                          {!buscaLinhaLoading && resultadosLinha.length===0 && (
                            <p style={{fontSize:10.5,color:C.muted,textAlign:"center",padding:10}}>Nenhuma composição encontrada.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!recolhida && no.itens.length === 0 && no.sub.length === 0 && (
                  <p style={{ padding:"9px 12px", fontSize:10.5, color:C.muted }}>Vazia - use + para item, T para título ou  para subnível.</p>
                )}
              </div>
            </div>
          );
        };

        return (
          <>
            <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginBottom:6,position:"relative"}}>
              <Btn v="ghost" size="sm" onClick={()=>setColsOrcAberto(a=>!a)}>Colunas</Btn>
              <Btn v="ghost" size="sm" onClick={()=>setEtapasFechadas({})}>Expandir todos</Btn>
              <Btn v="ghost" size="sm" onClick={()=>setEtapasFechadas(Object.fromEntries((orc.etapas||[]).map(e=>[e.id,true])))}>Recolher todos</Btn>
              {colsOrcAberto && (
                <div style={{position:"absolute",top:"100%",right:0,marginTop:4,zIndex:30,
                             background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:6,
                             boxShadow:`0 8px 24px ${C.shadow}`,padding:"10px 12px",minWidth:190}}>
                  <p style={{fontSize:10,fontWeight:800,color:C.muted,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>Colunas visíveis</p>
                  {[["codigo","Código"],["unidade","Unidade"],["custoUnit","Custo unitário"],["bdi","BDI por item"],["total","Total"]].map(([k,l])=>(
                    <label key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer",fontSize:12,color:C.text}}>
                      <input type="checkbox" checked={!!colsOrc[k]}
                        onChange={()=>setColsOrc(c=>({...c,[k]:!c[k]}))}
                        style={{width:15,height:15,accentColor:C.yellowD,cursor:"pointer"}}/>
                      {l}
                    </label>
                  ))}
                  <p style={{fontSize:9.5,color:C.muted,marginTop:7,lineHeight:1.45,borderTop:`1px solid ${C.line}`,paddingTop:7}}>
                    Fonte, descrição e quantidade ficam sempre visíveis.
                  </p>
                </div>
              )}
            </div>
            {calc.arvore.map(no => renderEtapa(no))}
            <Btn v="ghost" full onClick={() => abrirNovaEtapa("")} style={{ marginTop: 2 }}>
              <Ic n="plus"/> Nova etapa de 1º nível
            </Btn>
          </>
        );
      })()}

      {/* Totais finais */}
      <div style={{background:C.text,color:"#fff",borderRadius:8,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}><p style={{fontSize:12,opacity:.75}}>BDI ({orc.bdi}%)</p><p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:12,fontWeight:700}}>{fmt(calc.valorBDI)}</p></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:9,marginTop:6,borderTop:`1px solid rgba(255,255,255,.2)`}}>
          <p style={{fontSize:13,fontWeight:700}}>TOTAL GERAL</p>
          <p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:24,fontWeight:800,color:C.yellow}}>{fmt(calc.total)}</p>
        </div>
        {orc.areaM2>0 && (
          <p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:11,opacity:.7,textAlign:"right",marginTop:2}}>{fmt(calc.porM2)}/m  {orc.areaM2} m</p>
        )}
      </div>

      {false&&<>
      {/*  CURVA ABC  */}
      <div style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:8,overflow:"hidden",boxShadow:`0 1px 4px ${C.shadow}`}}>
        <button onClick={()=>setAbcAberta(a=>!a)}
                style={{width:"100%",background:C.surface,border:0,borderBottom:abcAberta?`1.5px solid ${C.border}`:"0",
                        padding:"12px 15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,textAlign:"left"}}>
          <div>
            <p style={{fontSize:10.5,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8}}>Análise de Pareto</p>
            <p style={{fontSize:15,fontWeight:800,color:C.text,marginTop:1}}>Curva ABC</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {abc && abc.itens.length>0 && (
              <p style={{fontSize:11,color:C.muted,textAlign:"right"}}>
                <b style={{color:CLASSE_ABC.A.cor}}>{abc.resumo[0].qtd} itens</b> = {abc.resumo[0].pctValor.toFixed(1)}% do custo
              </p>
            )}
            <span style={{fontSize:14,fontWeight:800,color:C.yellow}}>{abcAberta ? "-" : "+"}</span>
          </div>
        </button>

        {abcAberta && (!abc || abc.itens.length===0) && (
          <div style={{padding:"18px 15px",textAlign:"center"}}>
            <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6}}>
              A curva ABC precisa de itens com quantidade e preço.<br/>Adicione composições ao orçamento para vê-la.
            </p>
          </div>
        )}

        {abcAberta && abc && abc.itens.length>0 && (() => {
          const listaAbc = abcFiltro==="todas" ? abc.itens : abc.itens.filter(i=>i.classe===abcFiltro);
          const grafico  = abc.itens.slice(0, 20).map(i => ({
            nome: (i.descricao||"").slice(0,28) + ((i.descricao||"").length>28?"…":""),
            custo: Number(i.custoDireto.toFixed(2)),
            acum:  Number(i.pctAcum.toFixed(1)),
            cor:   CLASSE_ABC[i.classe].cor,
          }));
          return (
            <div style={{padding:"13px 15px",display:"flex",flexDirection:"column",gap:13}}>

              {/* Resumo por classe */}
              <div style={{display:"grid",gridTemplateColumns:cols(1,3,3),gap:8}}>
                {abc.resumo.map(r => (
                  <button key={r.classe} onClick={()=>setAbcFiltro(f=>f===r.classe?"todas":r.classe)}
                          style={{textAlign:"left",cursor:"pointer",background:abcFiltro===r.classe?`${r.cor}12`:C.surface,
                                  border:`1.5px solid ${abcFiltro===r.classe?r.cor:C.border}`,borderLeft:`4px solid ${r.cor}`,
                                  borderRadius:6,padding:"9px 11px"}}>
                    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:6}}>
                      <p style={{fontSize:12.5,fontWeight:800,color:r.cor}}>Classe {r.classe}</p>
                      <p style={{fontSize:10.5,color:C.muted}}>{r.qtd} item(ns)  {r.pctItens.toFixed(0)}%</p>
                    </div>
                    <p style={{fontSize:16,fontWeight:800,color:C.text,marginTop:3}}>{r.pctValor.toFixed(1)}%</p>
                    <p style={{fontSize:10.5,color:C.muted,marginTop:1}}>{fmt(r.custoDireto)} de custo direto</p>
                  </button>
                ))}
              </div>

              {/* Grafico: barras = custo, linha = % acumulado */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"11px 8px 4px"}}>
                <p style={{fontSize:10.5,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.7,paddingLeft:6,marginBottom:6}}>
                  20 itens de maior custo  linha = % acumulado
                </p>
                <div style={{height:250}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={grafico} margin={{top:4,right:8,left:0,bottom:4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.line}/>
                      <XAxis dataKey="nome" tick={false} axisLine={{stroke:C.border}} height={6}/>
                      <YAxis yAxisId="l" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}
                             tickFormatter={v=>`${Math.round(v/1000)}k`}/>
                      <YAxis yAxisId="r" orientation="right" domain={[0,100]} tick={{fontSize:10,fill:C.muted}}
                             axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                      <Tooltip
                        contentStyle={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}
                        formatter={(v,n)=> n==="acum" ? [`${v}%`,"Acumulado"] : [fmt(v),"Custo direto"]}/>
                      <Bar yAxisId="l" dataKey="custo" radius={[3,3,0,0]}>
                        {grafico.map((g,i)=><Cell key={i} fill={g.cor}/>)}
                      </Bar>
                      <Line yAxisId="r" type="monotone" dataKey="acum" stroke={C.yellow} strokeWidth={2} dot={false}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Controles */}
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,justifyContent:"space-between"}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <div onClick={()=>setAbcAgrupar(v=>!v)}
                       style={{width:18,height:18,borderRadius:4,flexShrink:0,cursor:"pointer",
                               border:`2px solid ${abcAgrupar?C.green:C.muted}`,background:abcAgrupar?C.green:"transparent",
                               display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {abcAgrupar && <span style={{color:"#fff",fontSize:11,fontWeight:900}}>ok</span>}
                  </div>
                  <p style={{fontSize:11.5,color:C.subtle}}>Agrupar o mesmo código somado entre etapas</p>
                </label>
                {abcFiltro!=="todas" && (
                  <button onClick={()=>setAbcFiltro("todas")}
                          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.muted,padding:"4px 10px",
                                  borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    Mostrando classe {abcFiltro}  limpar filtro
                  </button>
                )}
              </div>

              {/* Tabela */}
              <div style={{border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
                <div className="scroll-x" style={{maxHeight:360,overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5,minWidth:660}}>
                    <thead style={{position:"sticky",top:0,zIndex:1}}>
                      <tr style={{background:C.surface}}>
                        {["#","Cl.","Código","Descrição","Un.","Qtd.","Custo direto","% item","% acum."].map((h,i)=>(
                          <th key={h} style={{padding:"7px 8px",textAlign:i>=4?"right":"left",fontSize:10,fontWeight:800,
                                              color:C.muted,textTransform:"uppercase",letterSpacing:.5,
                                              borderBottom:`1.5px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {listaAbc.map(i => (
                        <tr key={`${i.codigo}-${i.ordem}`} style={{borderBottom:`1px solid ${C.line}`}}>
                          <td style={{padding:"6px 8px",color:C.muted}}>{i.ordem}</td>
                          <td style={{padding:"6px 8px"}}>
                            <span style={{display:"inline-block",minWidth:17,textAlign:"center",padding:"1px 5px",borderRadius:4,
                                          background:`${CLASSE_ABC[i.classe].cor}18`,color:CLASSE_ABC[i.classe].cor,
                                          fontSize:10,fontWeight:800}}>{i.classe}</span>
                          </td>
                          <td style={{padding:"6px 8px",color:C.subtle,whiteSpace:"nowrap"}}>{i.codigo||"-"}</td>
                          <td style={{padding:"6px 8px",color:C.text,minWidth:230}}>
                            {i.descricao}
                            {i.ocorrencias>1 && (
                              <span style={{marginLeft:6,fontSize:9.5,fontWeight:700,color:C.muted}}>({i.ocorrencias}x)</span>
                            )}
                          </td>
                          <td style={{padding:"6px 8px",textAlign:"right",color:C.muted}}>{i.unidade}</td>
                          <td style={{padding:"6px 8px",textAlign:"right",color:C.subtle,whiteSpace:"nowrap"}}>
                            {i.quantidade.toLocaleString("pt-BR",{maximumFractionDigits:2})}
                          </td>
                          <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>{fmt(i.custoDireto)}</td>
                          <td style={{padding:"6px 8px",textAlign:"right",color:C.muted}}>{i.pct.toFixed(2)}%</td>
                          <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:CLASSE_ABC[i.classe].cor}}>{i.pctAcum.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p style={{fontSize:10.5,color:C.muted,lineHeight:1.6}}>
                Classe A: itens até 80% do custo acumulado  B: até 95%  C: o restante.
                Os valores são de <b>custo direto</b>, sem BDI. Negociar preço nos itens A
                move o orçamento; nos itens C, quase não muda.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Importar planilha do orçamento (código + qtd) */}
      <div style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:8,padding:"13px 15px",boxShadow:`0 1px 4px ${C.shadow}`}}>
        <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>Importar planilha do orçamento</p>
        <p style={{fontSize:11,color:C.muted,marginBottom:9,lineHeight:1.55}}>
          A planilha precisa das colunas <b>Código</b> e <b>Qtd.</b> - descrição, unidade e preço
          vêm da base {orc.fonte} já carregada, na data-base deste orçamento.
          {basePorCodigo.size === 0
            ? <span style={{color:C.red,fontWeight:700}}> Importe a base SINAPI/ORSE antes.</span>
            : <> Base ativa: <b>{basePorCodigo.size.toLocaleString("pt-BR")}</b> códigos.</>}
        </p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
          <label style={{display:"inline-block",opacity: basePorCodigo.size===0 || impLoad ? .5 : 1}}>
            <input type="file" accept=".xlsx,.xls" disabled={basePorCodigo.size===0 || impLoad}
                   onChange={e=>{ importarOrcamentoXLSX(e.target.files?.[0]); e.target.value=""; }}
                   style={{display:"none"}}/>
            <span style={{display:"inline-flex",alignItems:"center",gap:6,background:C.yellow,color:"#fff",
                          border:`1.5px solid ${C.yellowD}`,padding:"8px 14px",borderRadius:6,
                          cursor: basePorCodigo.size===0||impLoad ? "not-allowed" : "pointer",
                          fontFamily:"var(--arcd-font-sans)",fontWeight:700,fontSize:12,
                          textTransform:"uppercase",letterSpacing:.5}}>
              {impLoad ? "Lendo..." : "Escolher planilha"}
            </span>
          </label>
          <p style={{fontSize:10.5,color:C.muted}}>
            Use o <b>Excel padrão</b> abaixo como modelo do layout.
          </p>
        </div>
      </div>

      {/* Modal: confirmar onde está cada coluna antes de qualquer linha ser lida */}
      {colMapModal && (() => {
        const { headerRow, rows, hIdx, col } = colMapModal;
        const primeiraLinha = rows[hIdx+1] || [];
        const opcoesColuna = [
          { v:"", l:"Não usar" },
          ...headerRow.map((cel,j) => ({ v:String(j), l:`${String(cel||"").trim()||"(vazio)"}  →  ${String(primeiraLinha[j] ?? "").slice(0,32)}` })),
        ];
        const setCol = (chave,valor) => setColMapModal(m => ({ ...m, col:{ ...m.col, [chave]: valor==="" ? undefined : Number(valor) } }));
        const campos = [
          { k:"codigo",    l:"Código",      obrig:true  },
          { k:"descricao", l:"Descrição",   obrig:true  },
          { k:"qtd",       l:"Quantidade",  obrig:true  },
          { k:"preco",     l:"Preço",       obrig:true  },
          { k:"tipo",      l:"Tipo",        obrig:false },
          { k:"unidade",   l:"Unidade",     obrig:false },
        ];
        return (
          <Modal title="Onde está cada coluna?" onClose={()=>setColMapModal(null)} wide>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>
                A detecção automática pelo nome do cabeçalho é só um palpite. Confirme (ou corrija) qual coluna da planilha é cada campo antes de importar - especialmente <b>Código</b>, <b>Descrição</b>, <b>Quantidade</b> e <b>Preço</b>.
              </p>
              <div style={{display:"grid",gridTemplateColumns:cols(1,2,2),gap:9}}>
                {campos.map(c => (
                  <Sel key={c.k} label={`${c.l}${c.obrig?" *":""}`} value={col[c.k]===undefined?"":String(col[c.k])}
                       onChange={v=>setCol(c.k,v)} options={opcoesColuna}/>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={()=>setColMapModal(null)} full>Cancelar</Btn>
                <Btn onClick={confirmarMapeamentoImportacao} full><Ic n="check"/> Confirmar e continuar</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Modal: conferir a importação antes de aplicar */}
      {impModal && (() => {
        const s = impModal.stats;
        const pend = impModal.linhas.filter(l => l.kind==="item" && (!l.achou || l.semPreco || l.semQtd));
        const Nm = ({v,l,cor}) => (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px"}}>
            <p style={{fontSize:16,fontWeight:800,color:cor||C.text}}>{v}</p>
            <p style={{fontSize:10,color:C.muted,marginTop:1}}>{l}</p>
          </div>
        );
        return (
          <Modal title="Conferir importação" onClose={()=>setImpModal(null)} wide>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:7}}>
                <Nm v={s.itens}    l="itens na planilha"/>
                <Nm v={s.ok}       l="prontos" cor={C.green}/>
                <Nm v={s.naoAchou} l="código fora da base" cor={s.naoAchou?C.red:C.muted}/>
                <Nm v={s.etapas}   l="etapas"/>
              </div>

              <div style={{background:`${C.yellow}12`,border:`1px solid ${C.yellow}44`,borderRadius:6,padding:"9px 12px",
                           display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <p style={{fontSize:11,color:C.muted}}>Custo direto que será importado</p>
                <p style={{fontSize:17,fontWeight:800,color:C.yellow}}>{fmt(s.valor)}</p>
              </div>

              {pend.length > 0 && (
                <div style={{border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.red}`,borderRadius:6,overflow:"hidden"}}>
                  <p style={{fontSize:11.5,fontWeight:700,color:C.text,padding:"8px 11px",background:C.surface}}>
                    {pend.length} linha(s) precisam de atenção
                  </p>
                  <div style={{maxHeight:150,overflowY:"auto",padding:"6px 11px"}}>
                    {pend.slice(0,40).map((p,i)=>(
                      <p key={i} style={{fontSize:11,color:C.muted,lineHeight:1.7,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        Linha {p._i}: <b style={{color:C.subtle}}>{p.codigo||"sem código"}</b>
                        {" - "}
                        {!p.achou   ? "não existe na base carregada"
                         : p.semQtd ? "sem quantidade"
                         : "a base não tem preço para este código"}
                      </p>
                    ))}
                    {pend.length>40 && <p style={{fontSize:10.5,color:C.muted,marginTop:4}}>...e mais {pend.length-40}.</p>}
                  </div>
                </div>
              )}

              {[
                { k:"incluirPend", cor:C.yellow, t:"Importar também as linhas com pendência",
                  s:"Entram com preço zerado para você completar depois. Desmarcado, elas são descartadas." },
                { k:"substituir", cor:C.red, t:"Substituir o conteúdo atual do orçamento",
                  s:"Apaga etapas e itens já lançados neste orçamento. Desmarcado, a planilha é somada ao que existe." },
              ].map(o => (
                <label key={o.k} style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",padding:"8px 11px",
                        background: impModal[o.k] ? `${o.cor}10` : C.surface,
                        border:`1.5px solid ${impModal[o.k] ? o.cor : C.border}`,borderRadius:6}}>
                  <div onClick={()=>setImpModal(m=>({...m,[o.k]:!m[o.k]}))}
                       style={{width:18,height:18,borderRadius:4,flexShrink:0,marginTop:1,
                               border:`2px solid ${impModal[o.k]?o.cor:C.muted}`,background:impModal[o.k]?o.cor:"transparent",
                               display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {impModal[o.k] && <span style={{color:"#fff",fontSize:11,fontWeight:900}}>ok</span>}
                  </div>
                  <div>
                    <p style={{fontSize:12.5,fontWeight:700,color:impModal[o.k]?o.cor:C.text}}>{o.t}</p>
                    <p style={{fontSize:10.5,color:C.muted,marginTop:2,lineHeight:1.5}}>{o.s}</p>
                  </div>
                </label>
              ))}

              <div style={{display:"flex",gap:8}}>
                <Btn v="ghost" onClick={()=>setImpModal(null)} full>Cancelar</Btn>
                <Btn onClick={aplicarImportacao} full><Ic n="check"/> Importar</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Exportar */}
      <div style={{display:"grid",gridTemplateColumns:cols("1fr 1fr","1fr 1fr","200px 200px"),gap:8}}>
        <Btn onClick={exportPDF}  v="danger"  full><Ic n="file"/> PDF</Btn>
        <Btn onClick={exportXLSX} v="success" full><Ic n="download"/> Excel completo</Btn>
        <Btn onClick={exportXLSXExportado} v="success" full><Ic n="download"/> Excel padrão</Btn>
        <Btn onClick={exportXLSXCurvaABC} v="ghost" full><Ic n="download"/> Curva ABC</Btn>
      </div>
      </>}

      {/* Modal: BDI - Acórdão 2622/2013-TCU */}
      {editMetaModal && (
        <Modal title="Editar dados do orçamento" onClose={()=>setEditMetaModal(false)} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Nome do orçamento *" value={form.nome} onChange={F("nome")}/>
            <label style={{display:"flex",flexDirection:"column",gap:5}}>
              <span style={{fontSize:11,fontWeight:700,color:C.text}}>Descrição</span>
              <textarea value={form.descricao||""} onChange={e=>F("descricao")(e.target.value)} rows={3}
                placeholder="Escopo, objetivo ou observações do orçamento"
                style={{background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"9px 11px",borderRadius:7,fontSize:12,outline:"none",resize:"vertical",fontFamily:"var(--arcd-font-sans)"}}/>
            </label>
            <Sel label="Obra vinculada" value={form.obraId} onChange={F("obraId")}
              options={[{v:"",l:"- Nenhuma -"},...(data.obras||[]).map(o=>({v:o.id,l:o.name}))]}/>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
              <Inp label="Cliente" value={form.cliente} onChange={F("cliente")}/>
              <Inp label="Área construída (m²)" type="number" value={form.areaM2} onChange={F("areaM2")}/>
              <Inp label="Local / Endereço" value={form.local} onChange={F("local")}/>
              <Inp label="UF" value={form.uf} onChange={F("uf")}/>
              <Sel label="Fonte" value={form.fonte} onChange={F("fonte")} options={[
                {v:"SINAPI",l:"SINAPI"},{v:"ORSE",l:"ORSE"},{v:"MISTO",l:"Misto (SINAPI + ORSE)"},{v:"EXTERNO",l:"Externo / Cotações"},
              ]}/>
              <Inp label="Data-base" value={form.dataBase} onChange={F("dataBase")} placeholder="Ex.: mai/2026"/>
              <Inp label="BDI (%)" type="number" value={form.bdi} onChange={F("bdi")}/>
              <Sel label="Status" value={form.status||"rascunho"} onChange={F("status")} options={[
                {v:"rascunho",l:"Rascunho"},{v:"revisao",l:"Em revisão"},{v:"enviado",l:"Enviado"},
              ]}/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"9px 12px",background:form.desonerado?`${C.green}08`:C.surface,borderRadius:6,border:`1.5px solid ${form.desonerado?C.green+"55":C.border}`}}>
              <input type="checkbox" checked={form.desonerado!==false} onChange={e=>F("desonerado")(e.target.checked)}/>
              <span style={{fontSize:12,fontWeight:700,color:C.text}}>Encargos desonerados</span>
            </label>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setEditMetaModal(false)} full>Cancelar</Btn>
              <Btn onClick={salvarDadosOrc} full><Ic n="check"/> Salvar dados</Btn>
            </div>
          </div>
        </Modal>
      )}

      {bdiModal && bdiP && (() => {
        const r   = calcBDI(bdiP);
        const sit = situacaoBDI(r.bdi, bdiTipo);
        const t   = BDI_TCU.find(x => x.v === bdiTipo) || BDI_TCU[0];
        const P   = k => v => setBdiP(p => ({ ...p, [k]: v }));

        // Campo compacto de percentual
        // A faixa de cada componente vem de BDI_COMPONENTES_EDIF, não de texto
        // solto: os números do hint e os da validação passam a ser os mesmos.
        // A tabela do acórdão é de EDIFICAÇÕES - para os outros tipos de obra o
        // que o TCU audita é o BDI total, então a baliza por componente só
        // aparece quando o tipo escolhido é "edificios".
        // Funcao de render (nao componente): declarada aqui dentro, um
        // componente seria recriado a cada tecla e o campo perderia o foco.
        const pct = (label, k, hint) => {
          const ref  = bdiTipo === "edificios" ? BDI_COMPONENTES_EDIF[k] : null;
          const val  = Number(bdiP[k] || 0);
          const fora = ref && val > 0 && (val < ref.q1 || val > ref.q3);
          const dica = hint || (ref ? `TCU edif.: ${f2p(ref.q1)} - ${f2p(ref.q3)}` : null);
          return (
            <label key={k} style={{display:"flex",flexDirection:"column",gap:3}}>
              <span style={{fontSize:10,fontWeight:600,color:C.text,letterSpacing:.3}}>{label}</span>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input type="number" step="0.01" value={bdiP[k]}
                  onChange={e => P(k)(e.target.value)}
                  style={{width:"100%",background:C.bg,
                          border:`1.5px solid ${fora ? C.orange : C.border}`,color:C.text,
                          padding:"7px 9px",borderRadius:6,fontSize:13,outline:"none",
                          fontFamily:"var(--arcd-font-sans)"}}/>
                <span style={{fontSize:11,color:C.muted}}>%</span>
              </div>
              {dica && (
                <span style={{fontSize:9,color: fora ? C.orange : C.muted}}>
                  {fora ? "! " : ""}{dica}
                </span>
              )}
            </label>
          );
        };

        return (
          <Modal title="BDI - Acórdão 2622/2013 (TCU)" onClose={()=>setBdiModal(false)} wide>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              {/* Abas */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[["faixa","Faixa referencial"],["detalhado","Cálculo detalhado"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setBdiAba(v)} style={{
                    padding:"8px 4px",
                    border:`2px solid ${bdiAba===v?C.yellow:C.border}`,
                    background:bdiAba===v?`${C.yellow}12`:"transparent",
                    color:bdiAba===v?C.text:C.muted,
                    fontFamily:"var(--arcd-font-sans)",
                    fontWeight:700,fontSize:12,cursor:"pointer",borderRadius:6,
                  }}>{l}</button>
                ))}
              </div>

              {/* Tipo de obra - comum às duas abas */}
              <Sel label="Tipo de obra (define a faixa auditável)" value={bdiTipo} onChange={setBdiTipo}
                options={BDI_TCU.map(x=>({v:x.v,l:x.l}))}/>

              {/*  ABA: FAIXA REFERENCIAL  */}
              {bdiAba === "faixa" && (<>
                <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>
                  O TCU não fixa um BDI: fixa um <strong style={{color:C.text}}>intervalo</strong>.
                  Dentro dele, o valor é aceito sem questionamento. Fora, é preciso justificar tecnicamente.
                </p>

                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {[
                    ["1º Quartil", t.q1,  C.blue,   "Mínimo aceitável"],
                    ["Médio",      t.med, C.yellow, "Referência usual"],
                    ["3º Quartil", t.q3,  C.orange, "Máximo aceitável"],
                  ].map(([l,val,cor,sub])=>{
                    const atual = Math.abs(Number(orc.bdi) - val) < 0.005;
                    return (
                      <button key={l} onClick={()=>aplicarBDI(val, bdiTipo, null)} style={{
                        background: atual ? `${cor}15` : C.bg,
                        border:`2px solid ${atual ? cor : C.border}`,
                        borderRadius:6, padding:"11px 6px", cursor:"pointer", textAlign:"center",
                      }}>
                        <p style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>{l}</p>
                        <p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:20,fontWeight:800,color:cor,marginTop:3,lineHeight:1}}>
                          {val.toFixed(2)}%
                        </p>
                        <p style={{fontSize:9,color:C.muted,marginTop:3}}>{sub}</p>
                        {atual && <p style={{fontSize:9,fontWeight:700,color:cor,marginTop:3,display:"flex",alignItems:"center",justifyContent:"center",gap:3}}><Ic n="check" s={10} color={cor}/> EM USO</p>}
                      </button>
                    );
                  })}
                </div>

                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px"}}>
                  <p style={{fontSize:10.5,color:C.muted,lineHeight:1.55}}>
                    Estes valores são o BDI <strong>total</strong>. Se você precisa demonstrar a
                    memória de cálculo (comum em perícia e em obra pública), use a aba
                    <strong style={{color:C.text}}> Cálculo detalhado</strong>.
                  </p>
                </div>
              </>)}

              {/*  ABA: CÁLCULO DETALHADO  */}
              {bdiAba === "detalhado" && (<>
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px"}}>
                  <p style={{fontSize:10,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Fórmula do TCU</p>
                  <p style={{fontSize:11,color:C.muted,fontFamily:"monospace",lineHeight:1.5}}>
                    BDI = [ (1+AC+S+R+G) x (1+DF) x (1+L)  (1I) ]  1
                  </p>
                </div>

                <p style={{fontSize:10,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:.7}}>Componentes</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  {pct("AC - Administração Central", "ac")}
                  {pct("S - Seguro", "seguro")}
                  {pct("R - Risco", "risco")}
                  {pct("G - Garantia", "garantia", "Opcional")}
                  {pct("DF - Despesas Financeiras", "df")}
                  {pct("L - Lucro", "lucro")}
                </div>

                <p style={{fontSize:10,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:.7,marginTop:2}}>
                  I - Tributos sobre o faturamento
                </p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  {pct("PIS", "pis", "Cumulativo: 0,65")}
                  {pct("COFINS", "cofins", "Cumulativo: 3,00")}
                  {pct("ISS", "iss", "Municipal: 2,00 - 5,00")}
                  {pct("CPRB", "cprb", "Só na folha desonerada: 4,50")}
                </div>

                {/* Coerência CPRB x tabela escolhida */}
                {(() => {
                  const usaDes = orc.desonerado !== false;
                  const temCprb = Number(bdiP.cprb || 0) > 0;
                  if (usaDes && !temCprb) return (
                    <div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"8px 11px"}}>
                      <p style={{fontSize:11,color:C.orange,fontWeight:700}}>! Orçamento desonerado sem CPRB</p>
                      <p style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.5}}>
                        Você escolheu a tabela <strong>desonerada</strong>, então a empresa recolhe CPRB (4,5% sobre a
                        receita) - e isso precisa estar nos tributos do BDI. Deixar em zero subestima o BDI.
                      </p>
                    </div>
                  );
                  if (!usaDes && temCprb) return (
                    <div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"8px 11px"}}>
                      <p style={{fontSize:11,color:C.orange,fontWeight:700}}>! Orçamento não desonerado com CPRB</p>
                      <p style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.5}}>
                        A tabela é <strong>não desonerada</strong> (encargos já na folha), logo não há CPRB.
                        Mantê-la infla o BDI indevidamente.
                      </p>
                    </div>
                  );
                  return null;
                })()}

                {/* Resultado */}
                <div style={{background:`${sit.cor}0A`,border:`2px solid ${sit.cor}`,borderRadius:8,padding:"13px 15px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <p style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.6}}>BDI calculado</p>
                      <p style={{fontSize:10,color:C.muted,marginTop:2}}>Tributos (I) = {r.tributos.toFixed(2)}%</p>
                    </div>
                    <p style={{fontFamily:"var(--arcd-font-mono)",fontVariantNumeric:"tabular-nums",fontSize:"clamp(18px,8vw,32px)",fontWeight:800,color:sit.cor,lineHeight:1}}>
                      {r.erro ? "-" : `${r.bdi.toFixed(2)}%`}
                    </p>
                  </div>
                  <div style={{marginTop:9,paddingTop:9,borderTop:`1px solid ${sit.cor}33`}}>
                    <p style={{fontSize:11,fontWeight:700,color:sit.cor}}>
                      {sit.st==="dentro" ? "Dentro da faixa TCU" : sit.st==="acima" ? "Acima do 3º quartil" : "Abaixo do 1º quartil"}
                    </p>
                    <p style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>
                      {r.erro || sit.msg}
                    </p>
                    <p style={{fontSize:9.5,color:C.muted,marginTop:5}}>
                      Faixa para <strong>{t.l.toLowerCase()}</strong>: {t.q1}% (1ºQ)  {t.med}% (médio)  {t.q3}% (3ºQ)
                    </p>
                  </div>
                </div>

                <Btn v="primary" full disabled={!!r.erro}
                  onClick={()=>aplicarBDI(r.bdi, bdiTipo, bdiP)}>
                  <Ic n="check"/> Aplicar {r.erro ? "" : `${r.bdi.toFixed(2)}%`} ao orçamento
                </Btn>
              </>)}

              <p style={{fontSize:9.5,color:C.muted,textAlign:"center",lineHeight:1.5}}>
                Faixas do Acórdão 2622/2013-TCU-Plenário. Confira sempre contra a íntegra do
                acórdão antes de usar em processo.
              </p>
            </div>
          </Modal>
        );
      })()}

      {/* Modal: nova etapa / subnível / renomear */}
      {etapaModal && (
        <Modal
          title={etapaModal.modo==="editar" ? "Renomear etapa"
               : etapaModal.modo==="sub"    ? "Novo subnível"
               : "Nova etapa"}
          onClose={()=>{setEtapaModal(null);setEtapaNome("");}}
        >
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {etapaModal.paiId && (() => {
              const pai = orc.etapas.find(e=>e.id===etapaModal.paiId);
              const nivelPai = nivelDaEtapa(orc.etapas, etapaModal.paiId);
              return (
                <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"9px 12px"}}>
                  <p style={{fontSize:10,color:C.muted,textTransform:"uppercase",fontWeight:700,letterSpacing:.6}}>Dentro de</p>
                  <p style={{fontSize:13,fontWeight:700,color:C.text,marginTop:2}}>{pai?.nome}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:3}}>
                    Será o nível {nivelPai+1} de {MAX_NIVEL}
                  </p>
                </div>
              );
            })()}
            <Inp label="Nome da etapa *" value={etapaNome} onChange={setEtapaNome}
              placeholder={etapaModal.modo==="sub" ? "Ex.: Alvenaria de vedação" : "Ex.: PAREDES E PAINÉIS"}/>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>{setEtapaModal(null);setEtapaNome("");}} full>Cancelar</Btn>
              <Btn onClick={salvarEtapa} full><Ic n="check"/> Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: buscar composição */}
      {buscaModal && (
        <Modal title="Adicionar item à etapa" onClose={()=>{setBuscaModal(false);setBusca("");}} wide>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Inp label="Buscar por código ou descrição" value={busca} onChange={setBusca}
              placeholder={temBasePesquisa ? "Ex.: 93358, alvenaria, contrapiso..." : "Vincule uma base ou use seus favoritos"}/>

            {!temBasePesquisa && (
              <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:16,textAlign:"center"}}>
                <p style={{fontSize:12,color:C.muted}}>Nenhuma base vinculada. Cadastre ou vincule uma base SINAPI/ORSE neste orçamento.</p>
              </div>
            )}
            {buscaRemotaLoading && <p style={{fontSize:10.5,color:C.blue,fontWeight:700}}>Pesquisando nas bases vinculadas...</p>}
            {buscaRemotaAviso && <div style={{background:`${C.orange}0B`,border:`1px solid ${C.orange}44`,borderRadius:7,padding:"7px 9px"}}><p style={{fontSize:10.5,color:C.orange}}>{buscaRemotaAviso}</p></div>}

            {!busca && baseBusca.some(i=>i._fav) && (
              <p style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8,display:"flex",alignItems:"center",gap:4}}><Ic n="star" s={11} color={C.yellow}/> Seus favoritos</p>
            )}

            <div style={{maxHeight:340,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
              {resultados.map((r,i)=>(
                <button key={`${r.codigo}-${i}`} onClick={()=>{setQtdModal(r);setQtd("");setBuscaModal(false);}} style={{
                  background:C.bg, border:`1.5px solid ${C.border}`,
                  borderLeft:`3px solid ${r._fav?C.yellow:(r.fonte==="ORSE"?C.purple:C.blue)}`,
                  borderRadius:6, padding:"8px 11px", textAlign:"left", cursor:"pointer",
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:12,color:C.text,lineHeight:1.4}}>{r.descricao}</p>
                      <p style={{fontSize:10,color:C.muted,marginTop:2,display:"flex",alignItems:"center",gap:3,flexWrap:"wrap"}}>
                        {r._fav && <Ic n="star" s={9} color={C.yellow}/>}
                        <span style={{fontWeight:700,color:r.fonte==="ORSE"?C.purple:C.blue}}>{r.fonte||"SINAPI"}</span>
                        {" "}{r.codigo}  {r.unidade}
                        {r.dataBase?` · ${r.dataBase}`:""}{r.uf?` · ${r.uf}`:""}
                      </p>
                    </div>
                    <p style={{fontSize:13,fontWeight:800,color:C.yellow,flexShrink:0}}>{fmt(precoDoItem(r, orc))}</p>
                  </div>
                </button>
              ))}
              {busca.trim().length>=2 && resultados.length===0 && !buscaRemotaLoading && (
                <p style={{fontSize:12,color:C.muted,textAlign:"center",padding:16}}>Nenhum resultado para "{busca}".</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: quantidade */}
      {qtdModal && (
        <Modal title="Quantidade" onClose={()=>{setQtdModal(null);setQtd("");}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {(() => {
              const pu = precoDoItem(qtdModal, orc);
              const substituido = precoFoiSubstituido(qtdModal, orc);
              return (<>
                <div style={{background:C.surface,border:`1.5px solid ${C.border}`,borderRadius:6,padding:"11px 13px"}}>
                  <p style={{fontSize:12,color:C.text,lineHeight:1.4}}>{qtdModal.descricao}</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:4}}>
                    <span style={{fontWeight:700,color:qtdModal.fonte==="ORSE"?C.purple:C.blue}}>{qtdModal.fonte||"SINAPI"}</span>
                    {" "}{qtdModal.codigo}  {fmt(pu)}/{qtdModal.unidade} <span style={{color:C.muted}}>(sem BDI)</span>
                    {qtdModal.dataBase?` · ${qtdModal.dataBase}`:""}{qtdModal.uf?` · ${qtdModal.uf}`:""}
                  </p>
                  {qtdModal.detailUrl && <a href={qtdModal.detailUrl} target="_blank" rel="noreferrer" style={{display:"inline-block",fontSize:10,color:C.blue,marginTop:5,fontWeight:700}}>Ver composição oficial</a>}
                  {substituido && (
                    <p style={{fontSize:10,color:C.orange,marginTop:4,fontWeight:600}}>
                      ! Preço {orc.desonerado!==false ? "não desonerado" : "desonerado"} - a coluna escolhida no orçamento está vazia nesta base.
                    </p>
                  )}
                </div>
                <Inp label={`Quantidade (${qtdModal.unidade}) *`} type="number" value={qtd} onChange={setQtd} placeholder="0,00"/>
                {qtd && Number(qtd)>0 && (
                  <div style={{background:`${C.yellow}12`,border:`1px solid ${C.yellow}44`,borderRadius:6,padding:"9px 13px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <p style={{fontSize:11,color:C.muted}}>Custo direto</p>
                      <p style={{fontSize:11,color:C.muted}}>{fmt(Number(qtd)*pu)}</p>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <p style={{fontSize:12,color:C.text,fontWeight:700}}>Total c/ BDI {orc.bdi}%</p>
                      <p style={{fontSize:17,fontWeight:800,color:C.yellow}}>
                        {fmt(Number(qtd)*pu*(1+Number(orc.bdi||0)/100))}
                      </p>
                    </div>
                  </div>
                )}
              </>);
            })()}
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>{setQtdModal(null);setQtd("");}} full>Cancelar</Btn>
              <Btn onClick={addItem} full><Ic n="check"/> Adicionar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title="Editar item do orçamento" onClose={()=>setEditItem(null)} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
              <Inp label="Código" value={editItem.codigo||""} onChange={v=>setEditItem(x=>({...x,codigo:v}))}/>
              <Inp label="Fonte" value={editItem.fonte||""} onChange={v=>setEditItem(x=>({...x,fonte:v}))}/>
              <Inp label="Descrição *" value={editItem.descricao||""} onChange={v=>setEditItem(x=>({...x,descricao:v}))}/>
              <Inp label="Unidade" value={editItem.unidade||""} onChange={v=>setEditItem(x=>({...x,unidade:v}))}/>
              <Inp label="Quantidade" type="number" value={editItem.quantidade} onChange={v=>setEditItem(x=>({...x,quantidade:v}))}/>
              <Inp label="Preço unitário sem BDI" type="number" value={editItem.precoUnit} onChange={v=>setEditItem(x=>({...x,precoUnit:v}))}/>
            </div>
            <label style={{display:"flex",flexDirection:"column",gap:5}}>
              <span style={{fontSize:11,fontWeight:700,color:C.text}}>Composição / memória de preços</span>
              <textarea value={editItem.composicao||""} onChange={e=>setEditItem(x=>({...x,composicao:e.target.value}))}
                placeholder="Material, mão de obra, equipamentos, coeficientes e valores..." rows={5}
                style={{background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"9px 11px",borderRadius:7,fontSize:12,outline:"none",resize:"vertical",fontFamily:"var(--arcd-font-sans)"}}/>
            </label>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setEditItem(null)} full>Cancelar</Btn>
              <Btn onClick={salvarItemCompleto} full><Ic n="check"/> Salvar alterações</Btn>
            </div>
          </div>
        </Modal>
      )}

      {externoModal && (
        <Modal title="Nova composição externa / cotação" onClose={()=>setExternoModal(false)} wide>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>
              Use para serviços próprios, cotações de fornecedores ou composições que não existem na base SINAPI/ORSE.
            </p>
            <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:10}}>
              <Inp label="Código (opcional)" value={externoForm.codigo} onChange={v=>setExternoForm(f=>({...f,codigo:v}))}/>
              <Inp label="Fonte" value={externoForm.fonte} onChange={v=>setExternoForm(f=>({...f,fonte:v}))} placeholder="EXTERNO ou COTAÇÃO"/>
              <Inp label="Descrição *" value={externoForm.descricao} onChange={v=>setExternoForm(f=>({...f,descricao:v}))}/>
              <Inp label="Unidade *" value={externoForm.unidade} onChange={v=>setExternoForm(f=>({...f,unidade:v}))}/>
              <Inp label="Quantidade *" type="number" value={externoForm.quantidade} onChange={v=>setExternoForm(f=>({...f,quantidade:v}))}/>
              <Inp label="Custo unitário sem BDI *" type="number" value={externoForm.precoUnit} onChange={v=>setExternoForm(f=>({...f,precoUnit:v}))}/>
            </div>
            <label style={{display:"flex",flexDirection:"column",gap:5}}>
              <span style={{fontSize:11,fontWeight:700,color:C.text}}>Composição / detalhes da cotação</span>
              <textarea value={externoForm.composicao} onChange={e=>setExternoForm(f=>({...f,composicao:e.target.value}))}
                rows={5} placeholder="Materiais, mão de obra, fornecedor, validade, coeficientes..."
                style={{background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"9px 11px",borderRadius:7,fontSize:12,outline:"none",resize:"vertical",fontFamily:"var(--arcd-font-sans)"}}/>
            </label>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setExternoModal(false)} full>Cancelar</Btn>
              <Btn onClick={salvarExterno} full><Ic n="check"/> Adicionar ao orçamento</Btn>
            </div>
          </div>
        </Modal>
      )}
      </>}

      {orcAba==="insumos" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.blue}`,borderRadius:6,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:7}}>
              <div><p style={{fontSize:12.5,fontWeight:900,color:C.text}}>CONSULTA ANALÍTICA DAS BASES</p><p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Pesquise e abra separadamente os insumos ou as composições SINAPI/ORSE vinculadas.</p></div>
              <div style={{display:"flex",gap:4}}>{[["TODOS","TODOS"],["INSUMO","INSUMOS"],["COMPOSICAO","COMPOSIÇÕES"]].map(([valor,label])=><button key={valor} onClick={()=>setCompTipoBusca(valor)} style={{border:`1px solid ${compTipoBusca===valor?C.blue:C.border}`,background:compTipoBusca===valor?`${C.blue}10`:C.bg,color:compTipoBusca===valor?C.blue:C.muted,borderRadius:5,padding:"5px 8px",fontSize:8.5,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div>
            </div>
            <Inp value={compBusca} onChange={setCompBusca} placeholder={compTipoBusca==="INSUMO"?"Pesquisar insumo por código ou descrição...":compTipoBusca==="COMPOSICAO"?"Pesquisar composição por código ou descrição...":"Pesquisar insumo ou composição por código ou descrição..."}/>
            {(compBusca.trim().length>=2||compBuscaLoading)&&<div style={{marginTop:5,maxHeight:250,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:7}}>
              {compBuscaLoading&&<p style={{fontSize:10,color:C.blue,padding:8,fontWeight:800}}>PESQUISANDO...</p>}
              {compBuscaAviso&&<p style={{fontSize:10,color:C.orange,padding:8}}>{compBuscaAviso}</p>}
              {compResultados.map((item,index)=><div key={`${item.fonte}-${item.codigo}-${index}`} style={{display:"grid",gridTemplateColumns:"115px minmax(0,1fr) 95px auto",gap:7,padding:"7px 8px",borderTop:index?`1px solid ${C.line}`:"none",alignItems:"center"}}>
                <span><b style={{display:"block",fontSize:9.5,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte} {item.codigo}</b><small style={{fontSize:7.5,color:item.tipoItem==="COMPOSICAO"?C.green:C.orange,fontWeight:900}}>{item.tipoItem==="COMPOSICAO"?"COMPOSIÇÃO":"INSUMO"}</small></span>
                <span title={item.descricao} style={{fontSize:10.5,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</span>
                <span style={{fontSize:10,color:C.yellowD,textAlign:"right"}}>{fmt(precoDoItem(item,orc))}/{item.unidade}</span>
                <button onClick={()=>analisarItemReferencia(item)} style={{border:`1px solid ${C.blue}`,background:`${C.blue}08`,color:C.blue,borderRadius:5,padding:"5px 8px",fontSize:9,fontWeight:800,cursor:"pointer"}}>ANALISAR</button>
              </div>)}
              {!compBuscaLoading&&!compResultados.length&&<p style={{fontSize:10,color:C.muted,textAlign:"center",padding:10}}>Nenhum resultado.</p>}
            </div>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:5}}>
            {[["insumos","CURVA ABC DE INSUMOS"],["composicoes","CURVA ABC DE COMPOSIÇÕES"]].map(([valor,label])=><button key={valor} onClick={()=>{setAbcTipo(valor);setAbcFiltro("todas");setAbcInsumoFiltro("todas");}} style={{border:`1px solid ${abcTipo===valor?C.blue:C.border}`,background:abcTipo===valor?C.blue:C.bg,color:abcTipo===valor?"#fff":C.muted,borderRadius:6,padding:"8px 10px",fontSize:10,fontWeight:900,cursor:"pointer"}}>{label}</button>)}
          </div>

          {abcTipo==="insumos"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div>
              <p style={{fontSize:14,fontWeight:800,color:C.text}}>QUANTITATIVOS DE INSUMOS</p>
              <p style={{fontSize:10.5,color:C.muted,marginTop:2}}>Expansão analítica das composições SINAPI, ORSE e próprias conforme as quantidades do orçamento. O que a base não abre em insumos fica marcado como COMPOSIÇÃO e não entra na curva de insumos.</p>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Btn size="sm" v="info" onClick={carregarDetalhesComposicoes} disabled={detalhesLoading}>{detalhesLoading?"CARREGANDO...":"ATUALIZAR INSUMOS"}</Btn>
              <Btn size="sm" v="success" onClick={exportarABCInsumos}>EXCEL</Btn>
            </div>
          </div>
          {detalhesAviso&&<div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}55`,borderRadius:7,padding:"8px 10px",fontSize:10.5,color:C.orange}}>{detalhesAviso}</div>}

          {/* Alerta acionavel: nao basta dizer "faltam N composicoes da fonte X" -
              sem o codigo e a descricao, o administrador nao sabe qual composicao
              especifica precisa ir buscar/importar na base analitica. Ordenada por
              custo para a mais cara (mais urgente) aparecer primeiro. */}
          {composicoesNaoDocumentadas.length>0&&<div style={{background:`${C.orange}0f`,border:`1px solid ${C.orange}66`,borderRadius:6,padding:"9px 11px"}}>
            <p style={{fontSize:11,fontWeight:900,color:C.orange}}>⚠ COMPOSIÇÕES SEM DOCUMENTAÇÃO ANALÍTICA - BUSQUE A COMPOSIÇÃO CORRESPONDENTE</p>
            <p style={{fontSize:10,color:C.muted,lineHeight:1.55,marginTop:3}}>
              Estas composições entraram inteiras na curva (marcadas como COMPOSIÇÃO) porque a base vinculada não tem a relação delas com insumos.
              Localize o código na fonte oficial (SINAPI ou ORSE) e reenvie a planilha/tabelas analíticas em Administração → Bases de preço para documentá-las.
            </p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7}}>
              {naoAbertasPorFonte.map(linha=>(
                <button key={linha.fonte} onClick={()=>{setAbcInsumoTipo("COMPOSICAO");setAbcInsumoFiltro("todas");}}
                  title="Ver só as composições não abertas"
                  style={{border:`1px solid ${linha.fonte==="ORSE"?C.purple:C.blue}55`,background:C.bg,
                          borderRadius:6,padding:"5px 9px",cursor:"pointer",textAlign:"left"}}>
                  <b style={{fontSize:10,fontWeight:900,color:linha.fonte==="ORSE"?C.purple:C.blue}}>{linha.fonte}</b>
                  <span style={{fontSize:9.5,color:C.muted,marginLeft:6}}>{linha.qtd} composição(ões) · {fmt(linha.custo)}</span>
                </button>
              ))}
            </div>
            <div style={{marginTop:8,maxHeight:180,overflowY:"auto",border:`1px solid ${C.orange}33`,borderRadius:5}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                <thead><tr style={{background:C.bg}}>{["FONTE","CÓDIGO","DESCRIÇÃO","CUSTO NO ORÇAMENTO"].map(h=><th key={h} style={{padding:"5px 7px",textAlign:h==="CUSTO NO ORÇAMENTO"?"right":"left",color:C.muted,fontSize:8.5,position:"sticky",top:0,background:C.bg,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                <tbody>{composicoesNaoDocumentadas.map(item=><tr key={`${item.fonte}-${item.codigo}`} style={{borderBottom:`1px solid ${C.line}`}}>
                  <td style={{padding:"4px 7px",fontWeight:800,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte}</td>
                  <td style={{padding:"4px 7px",color:C.text}}>{item.codigo}</td>
                  <td title={item.descricao} style={{padding:"4px 7px",color:C.text,maxWidth:320,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</td>
                  <td style={{padding:"4px 7px",textAlign:"right",fontWeight:700,color:C.orange}}>{fmt(item.custo)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:7}}>
            {[
              [abcInsumos.qtdInsumos,"INSUMOS CONSOLIDADOS",C.blue],
              [abcInsumos.qtdComposicoes,"COMPOSIÇÕES NÃO ABERTAS",abcInsumos.qtdComposicoes?C.orange:C.green],
              [fmt(abcInsumosCurva.total),abcInsumoTipo==="INSUMO"?"CUSTO EM INSUMOS":abcInsumoTipo==="COMPOSICAO"?"CUSTO EM COMPOSIÇÕES":"CUSTO ANALÍTICO",C.yellow],
              [abcInsumos.semPreco.length,"SEM PREÇO",abcInsumos.semPreco.length?C.red:C.green],
            ].map(([valor,label,cor])=><div key={label} style={{background:C.bg,border:`1px solid ${C.border}`,borderTop:`3px solid ${cor}`,borderRadius:6,padding:"9px 11px"}}>
              <p style={{fontSize:15,fontWeight:800,color:cor}}>{valor}</p><p style={{fontSize:9,color:C.muted,fontWeight:700,marginTop:2}}>{label}</p>
            </div>)}
          </div>
          {/* Familia primeiro: a curva e recalculada dentro do que voce escolheu. */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:9,fontWeight:800,color:C.muted,letterSpacing:.5}}>MOSTRAR</span>
            {[["INSUMO","SÓ INSUMOS"],["COMPOSICAO","SÓ COMPOSIÇÕES"],["TODOS","TUDO JUNTO"]].map(([valor,label])=>(
              <button key={valor} onClick={()=>{setAbcInsumoTipo(valor);setAbcInsumoFiltro("todas");}} style={{
                border:`1px solid ${abcInsumoTipo===valor?C.blue:C.border}`,
                background:abcInsumoTipo===valor?C.blue:C.bg,
                color:abcInsumoTipo===valor?"#fff":C.muted,
                borderRadius:6,padding:"5px 10px",fontSize:9.5,fontWeight:800,cursor:"pointer",
              }}>{label}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {["todas","A","B","C"].map(classe=><button key={classe} onClick={()=>setAbcInsumoFiltro(classe)} style={{
              border:`1px solid ${abcInsumoFiltro===classe?(classe==="todas"?C.blue:CLASSE_ABC[classe].cor):C.border}`,
              background:abcInsumoFiltro===classe?`${classe==="todas"?C.blue:CLASSE_ABC[classe].cor}12`:C.bg,
              color:classe==="todas"?C.blue:CLASSE_ABC[classe].cor,borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:800,cursor:"pointer",
            }}>{classe==="todas"?"TODAS":`CLASSE ${classe}`}</button>)}
          </div>
          <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:6,background:C.bg}}>
            <table style={{width:"100%",minWidth:940,borderCollapse:"collapse",fontSize:10.5}}>
              <thead><tr style={{background:C.surface}}>{["CL.","TIPO","FONTE","CÓDIGO","DESCRIÇÃO","UN.","QUANTIDADE","CUSTO UNIT.","CUSTO TOTAL","%","% ACUM."].map(h=><th key={h} style={{padding:"7px 8px",textAlign:h.includes("CUSTO")||h.includes("%")||h==="QUANTIDADE"?"right":"left",color:C.muted,fontSize:9,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>{abcInsumosCurva.itens.filter(item=>abcInsumoFiltro==="todas"||item.classe===abcInsumoFiltro).map(item=><tr key={`${item.tipo}-${item.fonte}-${item.codigo}-${item.unidade}`} style={{borderBottom:`1px solid ${C.line}`}}>
                <td style={{padding:"6px 8px",fontWeight:900,color:CLASSE_ABC[item.classe].cor}}>{item.classe}</td>
                <td title={item.tipo==="COMPOSICAO"?"Composição que a base analítica não abriu em insumos":"Insumo"} style={{padding:"6px 8px",fontWeight:900,fontSize:8.5,color:item.tipo==="COMPOSICAO"?C.green:C.orange}}>{item.tipo==="COMPOSICAO"?"COMPOSIÇÃO":"INSUMO"}</td>
                <td style={{padding:"6px 8px",fontWeight:800,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte}</td>
                <td style={{padding:"6px 8px",color:C.text}}>{item.codigo}</td>
                <td title={item.descricao} style={{padding:"6px 8px",color:C.text,maxWidth:440,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</td>
                <td style={{padding:"6px 8px",color:C.muted}}>{item.unidade}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:C.text}}>{item.quantidade.toLocaleString("pt-BR",{maximumFractionDigits:6})}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:item.precoUnit?C.text:C.red}}>{fmt(item.precoUnit)}</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontWeight:800,color:C.text}}>{fmt(item.custo)}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:C.muted}}>{item.pct.toFixed(2)}%</td>
                <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:CLASSE_ABC[item.classe].cor}}>{item.pctAcum.toFixed(2)}%</td>
              </tr>)}</tbody>
            </table>
            {!abcInsumosCurva.itens.length&&!detalhesLoading&&<p style={{padding:20,textAlign:"center",fontSize:11,color:C.muted}}>{abcInsumos.linhas.length?"Nenhuma linha nesta família. Troque o filtro acima.":"Nenhum quantitativo calculado. Confira se os itens possuem código, quantidade e custo unitário."}</p>}
          </div>
          {/* SEM DETALHAMENTO (chaves cruas fonte|codigo) some daqui - o alerta
              acionavel acima ja mostra a mesma informacao com codigo, descricao
              e custo, que e o que importa para ir buscar a composicao certa. */}
          {abcInsumos.semPreco.length>0&&<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 11px"}}>
            <p style={{fontSize:10,color:C.red,lineHeight:1.6}}><b>SEM PREÇO:</b> {abcInsumos.semPreco.slice(0,20).join(", ")}{abcInsumos.semPreco.length>20?"...":""}</p>
          </div>}
          </>}

          {abcTipo==="composicoes"&&<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div><p style={{fontSize:14,fontWeight:800,color:C.text}}>CURVA ABC DE COMPOSIÇÕES</p><p style={{fontSize:10.5,color:C.muted,marginTop:2}}>Somente serviços e composições lançados no orçamento. Insumos analíticos não entram nesta curva.</p></div>
              <Btn size="sm" v="success" onClick={exportXLSXCurvaABC}>EXCEL</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:cols(2,4,4),gap:7}}>
              <div style={{background:C.bg,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.blue}`,borderRadius:6,padding:"9px 11px"}}><p style={{fontSize:15,fontWeight:800,color:C.blue}}>{abc?.itens?.length||0}</p><p style={{fontSize:9,color:C.muted,fontWeight:700,marginTop:2}}>COMPOSIÇÕES CONSOLIDADAS</p></div>
              <div style={{background:C.bg,border:`1px solid ${C.border}`,borderTop:`3px solid ${C.yellow}`,borderRadius:6,padding:"9px 11px"}}><p style={{fontSize:15,fontWeight:800,color:C.yellowD}}>{fmt(abc?.totalCD||0)}</p><p style={{fontSize:9,color:C.muted,fontWeight:700,marginTop:2}}>CUSTO DIRETO DAS COMPOSIÇÕES</p></div>
              {(abc?.resumo||[]).map(r=><div key={r.classe} style={{background:C.bg,border:`1px solid ${C.border}`,borderTop:`3px solid ${r.cor}`,borderRadius:6,padding:"9px 11px"}}><p style={{fontSize:15,fontWeight:800,color:r.cor}}>{r.qtd}</p><p style={{fontSize:9,color:C.muted,fontWeight:700,marginTop:2}}>CLASSE {r.classe} · {r.pctValor.toFixed(1)}%</p></div>)}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {["todas","A","B","C"].map(classe=><button key={classe} onClick={()=>setAbcFiltro(classe)} style={{border:`1px solid ${abcFiltro===classe?(classe==="todas"?C.blue:CLASSE_ABC[classe].cor):C.border}`,background:abcFiltro===classe?`${classe==="todas"?C.blue:CLASSE_ABC[classe].cor}12`:C.bg,color:classe==="todas"?C.blue:CLASSE_ABC[classe].cor,borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:800,cursor:"pointer"}}>{classe==="todas"?"TODAS":`CLASSE ${classe}`}</button>)}
            </div>
            <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:6,background:C.bg}}>
              <table style={{width:"100%",minWidth:940,borderCollapse:"collapse",fontSize:10.5}}>
                <thead><tr style={{background:C.surface}}>{["CL.","FONTE","CÓDIGO","DESCRIÇÃO DA COMPOSIÇÃO","UN.","QUANTIDADE","CUSTO UNIT.","CUSTO TOTAL","%","% ACUM."].map(h=><th key={h} style={{padding:"7px 8px",textAlign:h.includes("CUSTO")||h.includes("%")||h==="QUANTIDADE"?"right":"left",color:C.muted,fontSize:9,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>{(abc?.itens||[]).filter(item=>abcFiltro==="todas"||item.classe===abcFiltro).map(item=><tr key={`${item.codigo}-${item.ordem}`} style={{borderBottom:`1px solid ${C.line}`}}>
                  <td style={{padding:"6px 8px",fontWeight:900,color:CLASSE_ABC[item.classe].cor}}>{item.classe}</td><td style={{padding:"6px 8px",fontWeight:800,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte||"-"}</td><td style={{padding:"6px 8px",color:C.text}}>{item.codigo}</td>
                  <td title={item.descricao} style={{padding:"6px 8px",color:C.text,maxWidth:440,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</td><td style={{padding:"6px 8px",color:C.muted}}>{item.unidade}</td>
                  <td style={{padding:"6px 8px",textAlign:"right"}}>{Number(item.quantidade||0).toLocaleString("pt-BR",{maximumFractionDigits:6})}</td><td style={{padding:"6px 8px",textAlign:"right"}}>{fmt(item.precoUnit)}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:800}}>{fmt(item.custoDireto)}</td><td style={{padding:"6px 8px",textAlign:"right",color:C.muted}}>{item.pct.toFixed(2)}%</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:CLASSE_ABC[item.classe].cor}}>{item.pctAcum.toFixed(2)}%</td>
                </tr>)}</tbody>
              </table>
              {!(abc?.itens||[]).length&&<p style={{padding:20,textAlign:"center",fontSize:11,color:C.muted}}>Nenhuma composição com quantidade e preço foi encontrada no orçamento.</p>}
            </div>
          </>}
        </div>
      )}

      {orcAba==="proprias" && (
        <div style={{display:"grid",gridTemplateColumns:cols("1fr","1fr","300px minmax(0,1fr)"),gap:10,alignItems:"start"}}>
          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,marginBottom:8}}>
              <div><p style={{fontSize:13,fontWeight:800,color:C.text}}>COMPOSIÇÕES SALVAS</p><p style={{fontSize:9.5,color:C.muted}}>{composicoesEmpresa.length} cadastrada(s) na empresa</p></div>
              <Btn size="sm" v="ghost" onClick={()=>novaComposicao()}>NOVA</Btn>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>{composicoesEmpresa.map(comp=>{
              const custo=(comp.itens||[]).reduce((s,item)=>s+Number(item.coeficiente||0)*Number(item.precoUnit||0),0);
              return <div key={comp.id} style={{border:`1px solid ${compForm.id===comp.id?C.blue:C.border}`,borderRadius:7,padding:"8px 9px",background:compForm.id===comp.id?`${C.blue}08`:C.surface}}>
                <p style={{fontSize:10,fontWeight:800,color:C.blue}}>{comp.codigo} · {comp.unidade}</p>
                <p title={comp.descricao} style={{fontSize:10.5,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginTop:2}}>{comp.descricao}</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:8,flexWrap:"wrap"}}>
                  <b style={{fontSize:11,color:C.yellowD}}>{fmt(custo)}</b>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    <button onClick={()=>setCompForm({...comp,itens:(comp.itens||[]).map(item=>({...item}))})} style={{display:"inline-flex",alignItems:"center",gap:4,minHeight:28,padding:"5px 8px",border:`1px solid ${C.blue}55`,borderRadius:6,background:`${C.blue}09`,color:C.blue,fontSize:9,fontWeight:800,cursor:"pointer"}}><Ic n="edit" s={11}/> EDITAR</button>
                    <button title="Criar uma nova composição a partir desta" onClick={()=>novaComposicao({...comp,id:"",itens:(comp.itens||[]).map(item=>({...item,id:uid()})),codigo:proximoCodigoProprio()})} style={{display:"inline-flex",alignItems:"center",gap:4,minHeight:28,padding:"5px 8px",border:`1px solid ${C.green}55`,borderRadius:6,background:`${C.green}09`,color:C.green,fontSize:9,fontWeight:800,cursor:"pointer"}}><Ic n="copy" s={11}/> DUPLICAR</button>
                    <button onClick={()=>excluirComposicaoPropria(comp)} style={{display:"inline-flex",alignItems:"center",gap:4,minHeight:28,padding:"5px 8px",border:`1px solid ${C.red}44`,borderRadius:6,background:`${C.red}08`,color:C.red,fontSize:9,fontWeight:800,cursor:"pointer"}}><Ic n="trash" s={11}/> EXCLUIR</button>
                  </div>
                </div>
              </div>;
            })}{!composicoesEmpresa.length&&<p style={{fontSize:10.5,color:C.muted,textAlign:"center",padding:14}}>Nenhuma composição da empresa.</p>}</div>
          </div>
          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:12,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
              <div><p style={{fontSize:14,fontWeight:800,color:C.text}}>{compForm.id?"EDITAR COMPOSIÇÃO":"NOVA COMPOSIÇÃO PRÓPRIA"}</p><p style={{fontSize:10.5,color:C.muted,marginTop:2}}>Comece do zero ou traga uma composição pronta da base e ajuste coeficientes e preços. O custo unitário é calculado pelos coeficientes.</p></div>
              <Btn size="sm" v="info" onClick={()=>{setCompTipoBusca("COMPOSICAO");buscaCompRef.current?.focus();}}>
                <Ic n="copy"/> IMPORTAR DA BASE
              </Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:8}}>
              <Inp label="Código automático" value={compForm.codigo} onChange={()=>{}} disabled/>
              <Inp label="Unidade *" value={compForm.unidade} onChange={valor=>setCompForm(form=>({...form,unidade:valor}))} placeholder="M2"/>
              <div style={{background:`${C.yellow}10`,border:`1px solid ${C.yellow}44`,borderRadius:7,padding:"7px 9px"}}><p style={{fontSize:9,color:C.muted,fontWeight:700}}>CUSTO UNITÁRIO</p><p style={{fontSize:15,fontWeight:800,color:C.yellowD,marginTop:2}}>{fmt(custoCompForm)}</p></div>
            </div>
            <Inp label="Descrição *" value={compForm.descricao} onChange={valor=>setCompForm(form=>({...form,descricao:valor}))} placeholder="DESCRIÇÃO DA COMPOSIÇÃO"/>
            {compForm.origemCodigo&&<div style={{background:`${C.blue}08`,border:`1px solid ${C.blue}35`,borderRadius:7,padding:"7px 9px"}}><p style={{fontSize:9,color:C.muted,fontWeight:800}}>COMPOSIÇÃO COPIADA DE</p><p style={{fontSize:10.5,color:C.blue,fontWeight:800,marginTop:2}}>{compForm.origemFonte} {compForm.origemCodigo}{compForm.origemDataBase?` · ${compForm.origemDataBase}`:""}{compForm.origemUf?` · ${compForm.origemUf}`:""}</p></div>}
            <div style={{position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:8,flexWrap:"wrap",marginBottom:5}}>
                <p style={{fontSize:9.5,fontWeight:800,color:C.muted,textTransform:"uppercase"}}>Pesquisar nas bases vinculadas</p>
                <div style={{display:"flex",gap:4}}>{[["TODOS","TODOS"],["INSUMO","INSUMOS"],["COMPOSICAO","COMPOSIÇÕES"]].map(([valor,label])=><button key={valor} onClick={()=>setCompTipoBusca(valor)} style={{border:`1px solid ${compTipoBusca===valor?C.blue:C.border}`,background:compTipoBusca===valor?`${C.blue}10`:C.bg,color:compTipoBusca===valor?C.blue:C.muted,borderRadius:5,padding:"4px 7px",fontSize:8.5,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div>
              </div>
              <Inp inputRef={buscaCompRef} value={compBusca} onChange={setCompBusca} placeholder={compTipoBusca==="INSUMO"?"Pesquisar insumo por código ou descrição...":compTipoBusca==="COMPOSICAO"?"Pesquisar composição pronta para importar...":"Pesquisar insumo ou composição..."}/>
              {compItemSubstituirId&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:5,padding:"6px 8px",borderRadius:6,background:`${C.orange}10`,border:`1px solid ${C.orange}44`,fontSize:10,color:C.orange}}><span>Selecione abaixo o insumo que substituirá a linha escolhida.</span><button onClick={()=>{setCompItemSubstituirId("");setCompBusca("");}} style={{border:0,background:"transparent",color:C.orange,fontWeight:900,cursor:"pointer"}}>CANCELAR</button></div>}
              {(compBusca.trim().length>=2||compBuscaLoading)&&<div style={{marginTop:4,maxHeight:240,overflowY:"auto",border:`1px solid ${C.blue}`,borderRadius:7,padding:4}}>
                {compBuscaLoading&&<p style={{fontSize:10,color:C.blue,padding:6}}>PESQUISANDO...</p>}
                {compBuscaAviso&&<p style={{fontSize:10,color:C.orange,padding:6}}>{compBuscaAviso}</p>}
                {compResultados.map((item,index)=><div key={`${item.fonte}-${item.codigo}-${index}`} style={{display:"grid",gridTemplateColumns:"105px minmax(0,1fr) 82px auto",gap:7,padding:"6px 7px",borderTop:index?`1px solid ${C.line}`:"none",alignItems:"center"}}>
                  <span><b style={{display:"block",fontSize:9.5,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte} {item.codigo}</b><small style={{fontSize:7.5,color:item.tipoItem==="COMPOSICAO"?C.green:C.orange,fontWeight:900}}>{item.tipoItem==="COMPOSICAO"?"COMPOSIÇÃO":"INSUMO"}</small></span><span title={item.descricao} style={{fontSize:10.5,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</span><span style={{fontSize:10,color:C.yellowD,textAlign:"right"}}>{fmt(precoDoItem(item,orc))}/{item.unidade}</span>
                  <span style={{display:"flex",gap:4}}>
                    <button onClick={()=>analisarItemReferencia(item)} style={{border:`1px solid ${C.blue}`,background:`${C.blue}08`,color:C.blue,borderRadius:5,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>ANALISAR</button>
                    <button onClick={()=>adicionarItemComposicao(item)} title={item.tipoItem==="COMPOSICAO"?"Usar como composição auxiliar":"Adicionar insumo"} style={{border:`1px solid ${C.border}`,background:C.bg,color:C.blue,borderRadius:5,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>+</button>
                    {item.tipoItem==="COMPOSICAO"&&<button disabled={!!clonandoComposicao} onClick={()=>clonarComposicaoReferencia(item)} style={{border:`1px solid ${C.green}`,background:`${C.green}10`,color:C.green,borderRadius:5,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>{clonandoComposicao===`${item.fonte}|${item.codigo}`?"COPIANDO...":"CLONAR"}</button>}
                  </span>
                </div>)}
                {!compBuscaLoading&&!compResultados.length&&<p style={{fontSize:10,color:C.muted,textAlign:"center",padding:9}}>Nenhum resultado.</p>}
              </div>}
              {compBusca.trim()&&compTipoBusca!=="COMPOSICAO"&&<button onClick={criarInsumoDaBusca} style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:6,border:`1px solid ${C.green}`,background:`${C.green}0C`,color:C.green,borderRadius:6,padding:"6px 9px",fontSize:9.5,fontWeight:900,cursor:"pointer"}}><Ic n="plus"/> CRIAR INSUMO “{compBusca.trim().slice(0,55)}{compBusca.trim().length>55?"…":""}”</button>}
            </div>
            <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:7}}><table style={{width:"100%",minWidth:750,borderCollapse:"collapse",fontSize:10}}>
              <thead><tr style={{background:C.surface}}>{["TIPO","FONTE","CÓDIGO","DESCRIÇÃO","UN.","COEFICIENTE","PREÇO UNIT.","TOTAL",""] .map(h=><th key={h} style={{padding:"6px",textAlign:h.includes("PREÇO")||h==="TOTAL"||h==="COEFICIENTE"?"right":"left",color:C.muted,fontSize:9,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
              <tbody>{(compForm.itens||[]).map(item=><tr key={item.id} style={{borderBottom:`1px solid ${C.line}`}}>
                <td style={{padding:6,color:C.muted}}>{item.tipoItem}</td><td style={{padding:6,fontWeight:800,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte}</td><td style={{padding:6}}>{item.codigo}</td>
                <td style={{padding:4,maxWidth:300}}><input title="Edite para pesquisar e substituir este insumo" value={compItemSubstituirId===item.id?compBusca:item.descricao} onFocus={()=>{setCompItemSubstituirId(item.id);setCompTipoBusca("INSUMO");setCompBusca(item.descricao||"");}} onChange={e=>{setCompItemSubstituirId(item.id);setCompTipoBusca("INSUMO");setCompBusca(e.target.value);}} style={{width:"100%",boxSizing:"border-box",padding:"5px 6px",border:`1px solid ${compItemSubstituirId===item.id?C.blue:C.border}`,borderRadius:4,background:C.bg,color:C.text,fontSize:10}}/></td><td style={{padding:6}}>{item.unidade}</td>
                <td style={{padding:4}}><input type="number" step="any" value={item.coeficiente} onChange={e=>setCompForm(form=>({...form,itens:form.itens.map(x=>x.id===item.id?{...x,coeficiente:e.target.value}:x)}))} style={{width:85,boxSizing:"border-box",padding:"4px 5px",border:`1px solid ${C.border}`,borderRadius:4,background:C.bg,color:C.text,textAlign:"right"}}/></td>
                <td style={{padding:4}}><input type="number" step="any" value={item.precoUnit} onChange={e=>setCompForm(form=>({...form,itens:form.itens.map(x=>x.id===item.id?{...x,precoUnit:e.target.value}:x)}))} style={{width:90,boxSizing:"border-box",padding:"4px 5px",border:`1px solid ${C.border}`,borderRadius:4,background:C.bg,color:C.text,textAlign:"right"}}/></td>
                <td style={{padding:6,textAlign:"right",fontWeight:800}}>{fmt(Number(item.coeficiente||0)*Number(item.precoUnit||0))}</td><td style={{padding:4}}><button onClick={()=>setCompForm(form=>({...form,itens:form.itens.filter(x=>x.id!==item.id)}))} style={{border:0,background:"transparent",color:C.red,cursor:"pointer"}}>x</button></td>
              </tr>)}</tbody>
            </table>{!(compForm.itens||[]).length&&<p style={{fontSize:10.5,color:C.muted,textAlign:"center",padding:13}}>Pesquise e adicione os insumos.</p>}</div>
            <div style={{display:"flex",gap:7,justifyContent:"flex-end"}}><Btn v="ghost" onClick={()=>novaComposicao()}>LIMPAR</Btn><Btn onClick={salvarComposicaoPropria}><Ic n="check"/> SALVAR COMPOSIÇÃO</Btn></div>
          </div>
        </div>
      )}

      {orcAba==="memoria" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:`${C.blue}0a`,border:`1px solid ${C.blue}33`,borderRadius:7,padding:"9px 11px"}}>
            <p style={{fontSize:10.5,color:C.muted,lineHeight:1.55}}>
              Painel de referência: os quantitativos aqui não alteram sozinhos as linhas do orçamento - sirvam para conferir e, depois de validados, lançar manualmente a quantidade correta na composição correspondente. Ficam salvos junto com esta versão do orçamento.
            </p>
          </div>

          <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:11,display:"flex",flexDirection:"column",gap:8}}>
            <div><p style={{fontSize:12,fontWeight:850,color:C.text}}>IMPORTAR PROJETO (PDF)</p><p style={{fontSize:10,color:C.muted,marginTop:2}}>Sinalize qual documento é e o sistema tenta preencher a memória de cálculo sozinho - você sempre confere antes de aplicar.</p></div>
            <select aria-label="Tipo de documento do PDF" value={pdfTipoDocumento} onChange={e=>setPdfTipoDocumento(e.target.value)} style={{padding:"7px 8px",border:`1px solid ${C.border}`,borderRadius:6,background:C.card,color:C.text,fontSize:10.5,fontWeight:700,maxWidth:360}}>
              <option value="estrutural-completo">Projeto estrutural completo - Fundação, Pilares, Vigas e Laje</option>
              <option value="quantitativos">Quantitativos de superfícies e volumes - concreto/fôrma de vigas e laje</option>
            </select>
            <label onDragOver={e=>{e.preventDefault();setPdfArrastando(true);}} onDragLeave={()=>setPdfArrastando(false)}
              onDrop={e=>{e.preventDefault();setPdfArrastando(false);const arquivo=e.dataTransfer.files?.[0];if(arquivo)processarPdfProjeto(arquivo);}}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,border:`1.5px dashed ${pdfArrastando?C.blue:C.border}`,background:pdfArrastando?`${C.blue}0a`:"transparent",borderRadius:7,padding:"14px 10px",cursor:pdfProcessando?"wait":"pointer"}}>
              <input type="file" accept=".pdf" disabled={pdfProcessando} onChange={e=>{const arquivo=e.target.files?.[0];e.target.value="";if(arquivo)processarPdfProjeto(arquivo);}} style={{display:"none"}}/>
              <Ic n="download" s={16} color={C.muted}/>
              <span style={{fontSize:10.5,fontWeight:800,color:C.blue}}>{pdfProcessando?"Lendo PDF...":"Selecionar PDF"}</span>
              <span style={{fontSize:9,color:C.muted}}>ou arraste o arquivo aqui</span>
            </label>
            {pdfAviso&&<p style={{fontSize:10,color:C.orange,lineHeight:1.5}}>{pdfAviso}</p>}
            {pdfPreviewCompleto&&<div style={{border:`1px solid ${C.green}55`,background:`${C.green}0a`,borderRadius:7,padding:"9px 11px",display:"flex",flexDirection:"column",gap:7}}>
              <p style={{fontSize:10.5,fontWeight:850,color:C.green}}>Encontrado - confira antes de aplicar.</p>
              <div style={{border:`1px solid ${C.orange}55`,background:`${C.orange}12`,borderRadius:6,padding:"7px 9px"}}>
                <p style={{fontSize:10,fontWeight:850,color:C.orange}}>⚠ Reimportar substitui a versão anterior de cada pavimento - nunca soma/duplica, mas também não tem desfazer depois de aplicar.</p>
              </div>

              {!!pdfPreviewCompleto.sapatas.length&&<div style={{display:"flex",flexDirection:"column",gap:5}}>
                <p style={{fontSize:10,fontWeight:850,color:C.text}}>FUNDAÇÃO: {pdfPreviewCompleto.sapatas.length} tipo(s) de sapata</p>
                {pdfPreviewCompleto.resumoAcoSapatas&&(()=>{
                  const totalCalculado=pdfPreviewCompleto.sapatas.reduce((s,sapata)=>s+calcularSapataTipo(sapata).pesoAcoTotal,0);
                  const diferenca=Math.abs(totalCalculado-pdfPreviewCompleto.resumoAcoSapatas.totalKg);
                  const bateu=diferenca<=pdfPreviewCompleto.resumoAcoSapatas.totalKg*0.02; // até 2% de diferença por arredondamento
                  return <div style={{border:`1px solid ${bateu?C.green:C.orange}55`,background:C.card,borderRadius:6,padding:"7px 9px"}}>
                    <p style={{fontSize:10,fontWeight:850,color:bateu?C.green:C.orange}}>{bateu?"✓":"⚠"} Conferência com o Resumo Aço da folha</p>
                    <p style={{fontSize:9.5,color:C.muted,marginTop:2}}>Extraído (com os comprimentos resolvidos): <b>{totalCalculado.toFixed(1)} kg</b> · Total pronto do projeto: <b>{pdfPreviewCompleto.resumoAcoSapatas.totalKg.toFixed(1)} kg</b>{!bateu&&" - a diferença indica que algum comprimento de armadura não foi identificado (fica marcado para completar à mão)."}</p>
                  </div>;
                })()}
                <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:160,overflowY:"auto"}}>
                  {pdfPreviewCompleto.sapatas.map(sapata=><div key={sapata.tipo} style={{fontSize:9.5,color:C.text}}>
                    <b>{sapata.tipo}</b> · {sapata.qtd} peça(s) · {(sapata.largura*100).toFixed(0)}x{(sapata.comprimento*100).toFixed(0)}cm · alt. {(sapata.alturaBase*100).toFixed(0)}/{(sapata.alturaTronco*100).toFixed(0)}cm
                    {" · X:"}{sapata.armaduraX.quantidade}∅{sapata.armaduraX.bitola}{sapata.armaduraX.comprimento?` (${sapata.armaduraX.comprimento.toFixed(2)}m)`:" (comprimento não identificado - complete à mão)"}
                    {" · Y:"}{sapata.armaduraY.quantidade}∅{sapata.armaduraY.bitola}{sapata.armaduraY.comprimento?` (${sapata.armaduraY.comprimento.toFixed(2)}m)`:" (comprimento não identificado - complete à mão)"}
                  </div>)}
                </div>
              </div>}

              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {PAVIMENTOS_ESTRUTURA.map(([pav,label])=>{
                  const pilares=pdfPreviewCompleto.pilares[pav]||[];
                  const acoPilares=pdfPreviewCompleto.pilaresAcoPorBitola[pav];
                  const acoVigas=pdfPreviewCompleto.vigasAcoPorBitola[pav];
                  const acoLaje=pdfPreviewCompleto.lajesAcoPorBitola[pav];
                  if(!pilares.length&&!acoPilares&&!acoVigas&&!acoLaje)return null;
                  const concretoPilares=pilares.reduce((s,p)=>s+Number(p.concretoUnit||0)*Number(p.qtd||0),0);
                  const formaPilares=pilares.reduce((s,p)=>s+Number(p.formaUnit||0)*Number(p.qtd||0),0);
                  return <p key={pav} style={{fontSize:9.5,color:C.text}}>
                    <b>{label}:</b> {pilares.length>0?`pilares ${concretoPilares.toFixed(2)}m³ concreto / ${formaPilares.toFixed(2)}m² fôrma`:""}
                    {acoPilares?` · aço de pilares: ${acoPilares.totalKg.toFixed(1)}kg`:""}
                    {acoVigas?` · aço de vigas: ${acoVigas.totalKg.toFixed(1)}kg`:""}
                    {acoLaje?` · aço de laje: ${acoLaje.totalKg.toFixed(1)}kg`:""}
                  </p>;
                })}
              </div>
              <div style={{display:"flex",gap:7}}><Btn size="sm" v="ghost" onClick={()=>setPdfPreviewCompleto(null)}>DESCARTAR</Btn><Btn size="sm" onClick={()=>setConfirmarAplicarPdf(true)}><Ic n="check"/> APLICAR (SUBSTITUI A VERSÃO ANTERIOR)</Btn></div>
            </div>}

            {pdfPreviewQuantitativos&&<div style={{border:`1px solid ${C.green}55`,background:`${C.green}0a`,borderRadius:7,padding:"9px 11px",display:"flex",flexDirection:"column",gap:7}}>
              <p style={{fontSize:10.5,fontWeight:850,color:C.green}}>Encontrado nos três pavimentos - confira antes de aplicar:</p>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {pdfPreviewQuantitativos.map(grupo=><p key={grupo.pavimento} style={{fontSize:9.5,color:C.text}}>
                  <b>{grupo.pavimento}:</b> vigas {grupo.concretoVigasM3?.toFixed(2)}m³ concreto / {grupo.formaVigasM2?.toFixed(2)}m² fôrma{grupo.avisoConcretoIncorreto?<span style={{color:C.orange,fontWeight:800}}> ⚠ o próprio projeto avisa que este volume pode estar incorreto - confira</span>:""}
                  {" · laje "}{grupo.volumeLajesM3?.toFixed(2)}m³{grupo.volumeLajesM3?` (${grupo.lajeMacicasM3?.toFixed(2)}m³ maciça + ${grupo.lajeVigotasM3?.toFixed(2)}m³ vigota)`:""}
                </p>)}
              </div>
              <div style={{display:"flex",gap:7}}><Btn size="sm" v="ghost" onClick={()=>setPdfPreviewQuantitativos(null)}>DESCARTAR</Btn><Btn size="sm" onClick={()=>setConfirmarAplicarQuantitativos(true)}><Ic n="check"/> APLICAR NAS TABELAS</Btn></div>
            </div>}
          </div>

          <ConfirmDialog open={confirmarAplicarPdf} onOpenChange={aberto=>!aberto&&setConfirmarAplicarPdf(false)}
            title="Aplicar projeto estrutural completo" tone="danger" confirmLabel="Aplicar mesmo assim"
            description={descricaoSubstituicaoPdfCompleto()}
            onConfirm={()=>{aplicarPdfPreviewCompleto();setConfirmarAplicarPdf(false);}}/>
          <ConfirmDialog open={confirmarAplicarQuantitativos} onOpenChange={aberto=>!aberto&&setConfirmarAplicarQuantitativos(false)}
            title="Aplicar Quantitativos de superfícies e volumes" tone="danger" confirmLabel="Aplicar mesmo assim"
            description={descricaoSubstituicaoQuantitativos()}
            onConfirm={()=>{aplicarPdfPreviewQuantitativos();setConfirmarAplicarQuantitativos(false);}}/>

          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[["fundacao","FUNDAÇÃO"],...PAVIMENTOS_ESTRUTURA].map(([valor,label])=>(
              <button key={valor} onClick={()=>setPavimentoMemoria(valor)} style={{
                border:`1px solid ${pavimentoMemoria===valor?C.blue:C.border}`,
                background:pavimentoMemoria===valor?`${C.blue}12`:C.bg,
                color:pavimentoMemoria===valor?C.blue:C.muted,
                borderRadius:6,padding:"7px 12px",fontSize:10,fontWeight:800,cursor:"pointer",
              }}>{label}</button>
            ))}
          </div>

          {pavimentoMemoria==="fundacao" ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <div><p style={{fontSize:14,fontWeight:800,color:C.text}}>SAPATAS</p><p style={{fontSize:10.5,color:C.muted,marginTop:2}}>Uma linha por tipo de sapata (peças com a mesma dimensão), com a quantidade de peças daquele tipo - mesmo agrupamento que o próprio projeto estrutural já usa.</p></div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <div title="Espaçamento das colunas na tela - vale para a memória de cálculo de todos os orçamentos até você trocar de novo" style={{display:"flex",border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
                    {[["compacto","COMPACTO"],["normal","NORMAL"],["confortavel","CONFORTÁVEL"]].map(([valor,label])=>(
                      <button key={valor} onClick={()=>salvarDensidadeMemoria(valor)} style={{
                        border:0,padding:"7px 9px",fontSize:9,fontWeight:800,cursor:"pointer",
                        background:densidadeMemoria===valor?C.blue:C.bg,color:densidadeMemoria===valor?"#fff":C.muted,
                      }}>{label}</button>
                    ))}
                  </div>
                  <Btn size="sm" v="ghost" onClick={exportPDFSapatas} title="Gera uma versão em A4 paisagem para imprimir ou salvar como PDF"><Ic n="file"/> PDF / IMPRIMIR</Btn>
                  <Btn size="sm" v="success" onClick={exportXLSXSapatas}><Ic n="download"/> EXCEL</Btn>
                  <Btn size="sm" v="info" onClick={adicionarSapataTipo}><Ic n="plus"/> NOVO TIPO</Btn>
                </div>
              </div>

              {/* Glossário sempre visível - achado da crítica Impeccable: antes só
                  existia como tooltip de hover em 2 colunas, inacessível por teclado
                  e invisível até passar o mouse por cima. */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px",display:"flex",flexWrap:"wrap",gap:"3px 16px"}}>
                {[["Folga","quanto a cova é maior que a sapata, de cada lado"],
                  ["Tronco","parte da sapata que sobe até o pilar, acima da base"],
                  ["Conc. magro","concreto pobre só de regularização, sob a sapata"],
                  ["Fôrmas","molde para a concretagem da base (perímetro x altura)"],
                  ["Bitola","diâmetro da barra de aço, em milímetros"]].map(([termo,def])=>(
                  <span key={termo} style={{fontSize:9.5,color:C.muted}}><b style={{color:C.text}}>{termo}:</b> {def}</span>
                ))}
              </div>

              {undoSapata && (
                <div style={{background:`${C.blue}0C`,border:`1px solid ${C.blue}55`,borderRadius:8,padding:"9px 11px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <p style={{fontSize:11.5,color:C.text}}>Tipo "{undoSapata.tipo?.tipo||"sem nome"}" removido.</p>
                  <Btn size="sm" v="ghost" onClick={desfazerRemocaoSapata}><Ic n="refresh" s={13}/> Desfazer</Btn>
                </div>
              )}

              <div style={{background:`${C.blue}0a`,border:`1px solid ${C.blue}33`,borderRadius:7,padding:"9px 11px",display:"flex",flexDirection:"column",gap:7}}>
                <p style={{fontSize:10.5,fontWeight:850,color:C.text}}>Vai usar o padrão de folga (20cm) e profundidade (1,5m) de escavação em todas as sapatas, ou tipos diferentes precisam de valores próprios?</p>
                <p style={{fontSize:9.5,color:C.muted,lineHeight:1.5}}>Ajuste os dois valores abaixo e aplique de uma vez a todos os tipos - depois, se algum tipo específico precisar de um valor diferente (ex.: um pilar mais profundo), edite só a linha dele na tabela.</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
                  <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>FOLGA PADRÃO (m)</span><input type="number" step="any" min="0" value={padraoEscavacaoFundacao.folga} onChange={e=>salvarPadraoEscavacaoFundacao({folga:e.target.value.replace(",",".")})} style={{width:80,padding:"6px 7px",border:`1px solid ${C.border}`,borderRadius:5,background:C.card,color:C.text,textAlign:"right"}}/></label>
                  <label style={{display:"flex",flexDirection:"column",gap:3}}><span style={{fontSize:9,fontWeight:800,color:C.muted}}>PROFUNDIDADE PADRÃO (m)</span><input type="number" step="any" min="0" value={padraoEscavacaoFundacao.profundidade} onChange={e=>salvarPadraoEscavacaoFundacao({profundidade:e.target.value.replace(",",".")})} style={{width:90,padding:"6px 7px",border:`1px solid ${C.border}`,borderRadius:5,background:C.card,color:C.text,textAlign:"right"}}/></label>
                  <Btn size="sm" onClick={aplicarPadraoEscavacaoATodos} disabled={!sapatasFundacao.length}><Ic n="check"/> APLICAR A TODOS OS TIPOS</Btn>
                </div>
              </div>

              <details open={larguraColunasAberto} onToggle={e=>setLarguraColunasAberto(e.target.open)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"7px 11px"}}>
                <summary style={{cursor:"pointer",fontSize:10.5,fontWeight:850,color:C.text}}>AJUSTAR LARGURA DAS COLUNAS <span style={{fontWeight:600,color:C.muted}}>(vale pra empresa inteira, até você trocar de novo)</span></summary>
                <div style={{display:"flex",flexWrap:"wrap",gap:"6px 10px",marginTop:8,maxHeight:180,overflowY:"auto"}}>
                  {COLUNAS_SAPATAS.filter(col=>col.chave!=="acoes").map(col=>(
                    <label key={col.chave} style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:9,color:C.muted,minWidth:98}}>{col.rotulo||"AÇÕES"}</span>
                      <input type="number" min="24" step="1" value={larguraColunaEfetiva(col.chave)} onChange={e=>salvarLarguraColunaSapatas(col.chave,e.target.value)}
                        style={{width:52,padding:"3px 5px",border:`1px solid ${C.border}`,borderRadius:4,background:C.card,color:C.text,textAlign:"right",fontSize:9.5}}/>
                    </label>
                  ))}
                </div>
              </details>

              {/* Some inputs numéricos nativos (type=number) mostram setinhas de
                  incremento que comem ~20px do campo - numa coluna de 40-50px isso
                  cortava o valor digitado (achado do usuário via screenshot). */}
              <style>{`.sapata-num-input::-webkit-outer-spin-button,.sapata-num-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}.sapata-num-input{-moz-appearance:textfield}`}</style>
              <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:7}}>
                <table style={{width:"100%",minWidth:COLUNAS_SAPATAS.reduce((s,c)=>s+larguraColunaEfetiva(c.chave),0),tableLayout:"fixed",borderCollapse:"collapse",fontSize:dSapatas.fonte,userSelect:colunaArrastando?"none":"auto"}}>
                  <colgroup>{COLUNAS_SAPATAS.map(col=><col key={col.chave} style={{width:larguraColunaEfetiva(col.chave)}}/>)}</colgroup>
                  <thead>
                    {/* Cabeçalho em dois níveis - agrupa as 23 colunas em blocos
                        (Dimensões/Escavação/Concreto/Armadura X/Armadura Y), achado
                        da crítica Impeccable contra a densidade da tabela. Rótulo
                        QUEBRA linha (sem nowrap) - achado do usuário: "nowrap"
                        forçava a coluna a ficar tão larga quanto o texto do título,
                        bem mais que o dado embaixo precisa. */}
                    <tr style={{background:C.surface}}>
                      <th colSpan={2} style={{position:"sticky",left:0,zIndex:2,background:C.surface,borderBottom:`1px solid ${C.border}`}}/>
                      {GRUPOS_CABECALHO_SAPATAS.filter(g=>g.nome).map(g=>
                        <th key={g.nome} colSpan={g.span} style={{padding:dSapatas.pad,textAlign:"center",color:C.subtle,fontSize:dSapatas.fonteGrupo,fontWeight:800,letterSpacing:.4,borderBottom:`1px solid ${C.border}`,borderLeft:`1px solid ${C.line}`}}>{g.nome}</th>
                      )}
                      <th colSpan={2} style={{borderBottom:`1px solid ${C.border}`}}/>
                    </tr>
                    <tr style={{background:C.surface}}>
                      {COLUNAS_SAPATAS.map((col,i)=><th key={col.chave} scope="col" style={{position:"relative",padding:dSapatas.padHeader,textAlign:/\(m|QTD|PEÇAS/.test(col.rotulo)?"right":"left",color:C.muted,fontSize:dSapatas.fonteHeader,borderBottom:`1px solid ${C.border}`,whiteSpace:"normal",wordBreak:"break-word",lineHeight:1.15,
                        ...(i===0?{position:"sticky",left:0,zIndex:2,background:C.surface}:{}),
                        ...(i===1?{position:"sticky",left:larguraColunaEfetiva("tipo"),zIndex:2,background:C.surface,borderRight:`1px solid ${C.line}`}:{}),
                      }}>{col.rotulo}
                        {col.chave!=="acoes"&&<span onMouseDown={e=>iniciarArrastoColuna(col.chave,e)} title="Arraste para ajustar a largura desta coluna" style={{position:"absolute",top:0,right:-4,bottom:0,width:8,cursor:"col-resize",zIndex:3,display:"flex",justifyContent:"center"}}>
                          <span style={{width:1,height:"100%",background:colunaArrastando?.chave===col.chave?C.blue:C.border}}/>
                        </span>}
                      </th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {resumoSapatasFundacao.linhas.map(({tipo,calc})=>{
                      // "step=any" com type=number não aceita vírgula decimal (teclado
                      // brasileiro digita "0,2") - o navegador filtra a vírgula e deixa
                      // um valor truncado/inválido no campo. Normaliza para ponto antes
                      // de gravar.
                      const numInput=(campo,largura="100%",rotulo=ROTULO_CAMPO_SAPATA[campo])=><input type="number" step="any" min="0" className="sapata-num-input" aria-label={rotulo} value={tipo[campo]} onChange={e=>atualizarSapataTipo(tipo.id,{[campo]:e.target.value.replace(",",".")})}
                        style={{width:largura,boxSizing:"border-box",padding:dSapatas.pad,border:`1px solid ${C.border}`,borderRadius:4,background:C.bg,color:C.text,textAlign:"right",fontSize:dSapatas.fonte}}/>;
                      const armInput=(direcao,campo,largura="100%")=><input type="number" step="any" min="0" className="sapata-num-input" aria-label={`${campo==="quantidade"?"Quantidade":"Comprimento"} da armadura ${direcao==="armaduraX"?"X":"Y"}`} value={tipo[direcao]?.[campo]} onChange={e=>atualizarSapataTipo(tipo.id,{[direcao]:{...tipo[direcao],[campo]:e.target.value.replace(",",".")}})}
                        style={{width:largura,boxSizing:"border-box",padding:dSapatas.pad,border:`1px solid ${C.border}`,borderRadius:4,background:C.bg,color:C.text,textAlign:"right",fontSize:dSapatas.fonte}}/>;
                      const armSelect=direcao=><select aria-label={`Bitola da armadura ${direcao==="armaduraX"?"X":"Y"}`} value={tipo[direcao]?.bitola} onChange={e=>atualizarSapataTipo(tipo.id,{[direcao]:{...tipo[direcao],bitola:e.target.value}})}
                        style={{width:"100%",boxSizing:"border-box",padding:dSapatas.pad,border:`1px solid ${C.border}`,borderRadius:4,background:C.bg,color:C.text,fontSize:dSapatas.fonte}}>
                        {BITOLAS_ACO.map(b=><option key={b} value={b}>∅{b}</option>)}
                      </select>;
                      // Vermelho ganha de laranja: escavação insuficiente é um erro de
                      // medida (mais grave) - precisaRevisar é só "ainda não conferi".
                      const corLinha = calc.escavacaoInsuficiente ? `${C.red}0a` : (tipo.precisaRevisar ? `${C.orange}08` : "transparent");
                      const corFixa = calc.escavacaoInsuficiente ? (C.red+"14") : (tipo.precisaRevisar ? (C.orange+"10") : C.bg);
                      return (
                        <tr key={tipo.id} style={{borderBottom:`1px solid ${C.line}`,background:corLinha}}>
                          <td style={{padding:dSapatas.pad,position:"sticky",left:0,zIndex:1,background:corFixa}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              {tipo.precisaRevisar&&<span title="Importado do PDF - ainda não revisado. Editar qualquer campo desta linha remove este aviso." style={{flexShrink:0,width:7,height:7,borderRadius:"50%",background:C.orange}}/>}
                              <input aria-label="Tipo (referência dos pilares)" value={tipo.tipo} onChange={e=>atualizarSapataTipo(tipo.id,{tipo:e.target.value})} placeholder="Ex.: P1, P4, P5..." style={{width:"100%",boxSizing:"border-box",padding:dSapatas.pad,border:`1px solid ${C.border}`,borderRadius:4,background:C.bg,color:C.text,fontSize:dSapatas.fonte}}/>
                            </div>
                          </td>
                          <td style={{padding:dSapatas.pad,position:"sticky",left:larguraColunaEfetiva("tipo"),zIndex:1,background:corFixa,borderRight:`1px solid ${C.line}`}}>{numInput("qtd")}</td>
                          <td style={{padding:dSapatas.pad}}>{numInput("largura")}</td>
                          <td style={{padding:dSapatas.pad}}>{numInput("comprimento")}</td>
                          <td style={{padding:dSapatas.pad}}>{numInput("alturaBase")}</td>
                          <td style={{padding:dSapatas.pad}}>{numInput("alturaTronco")}</td>
                          <td style={{padding:dSapatas.pad}} title="Quanto a cova é maior que a sapata, de cada lado (2x este valor soma em largura e em comprimento)">{numInput("folgaEscavacao")}</td>
                          <td style={{padding:dSapatas.pad}}>{numInput("profundidadeEscavacao")}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",color:calc.escavacaoInsuficiente?C.red:C.blue,fontWeight:700}} title={calc.escavacaoInsuficiente?`⚠ A cova (${calc.larguraEscavacaoUnit.toFixed(2)} x ${calc.comprimentoEscavacaoUnit.toFixed(2)}m) é menor que o volume de concreto da sapata - confira as medidas, a sapata não cabe nessa escavação.`:`Cova: ${calc.larguraEscavacaoUnit.toFixed(2)} x ${calc.comprimentoEscavacaoUnit.toFixed(2)}m`}>{calc.escavacaoInsuficiente?"⚠ ":""}{calc.volumeEscavacaoTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",color:C.muted}}>{calc.areaConcretoMagroTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",color:C.muted}} title="Perímetro da base x altura da base">{calc.formaAreaTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",color:C.muted}}>{calc.volumeBaseTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",color:C.muted}}>{calc.volumeTroncoTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",fontWeight:800,color:C.text}}>{calc.volumeSapataTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",color:C.orange}}>{calc.reaterroTotal.toFixed(2)}</td>
                          <td style={{padding:dSapatas.pad}}>{armSelect("armaduraX")}</td>
                          <td style={{padding:dSapatas.pad}}>{armInput("armaduraX","quantidade")}</td>
                          <td style={{padding:dSapatas.pad}}>{armInput("armaduraX","comprimento")}</td>
                          <td style={{padding:dSapatas.pad}}>{armSelect("armaduraY")}</td>
                          <td style={{padding:dSapatas.pad}}>{armInput("armaduraY","quantidade")}</td>
                          <td style={{padding:dSapatas.pad}}>{armInput("armaduraY","comprimento")}</td>
                          <td style={{padding:dSapatas.pad,textAlign:"right",fontWeight:800,color:C.purple}}>{calc.pesoAcoTotal.toFixed(1)}</td>
                          <td style={{padding:dSapatas.pad,display:"flex",gap:6}}>
                            <button aria-label="Duplicar este tipo" title="Duplicar" onClick={()=>duplicarSapataTipo(tipo.id)} style={{border:0,background:"transparent",color:C.blue,cursor:"pointer",display:"flex"}}><Ic n="copy" s={13}/></button>
                            <button aria-label="Remover este tipo" title="Remover" onClick={()=>removerSapataTipo(tipo.id)} style={{border:0,background:"transparent",color:C.red,cursor:"pointer",fontWeight:800}}>x</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {resumoSapatasFundacao.linhas.length>0&&<tfoot>
                    <tr style={{background:C.surface,fontWeight:800}}>
                      <td style={{padding:dSapatas.padHeader,position:"sticky",left:0,zIndex:1,background:C.surface}}>TOTAIS</td>
                      <td style={{position:"sticky",left:larguraColunaEfetiva("tipo"),zIndex:1,background:C.surface,borderRight:`1px solid ${C.line}`}}/>
                      <td/><td/><td/><td/><td/><td/>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right",color:C.blue}}>{resumoSapatasFundacao.totais.volumeEscavacao.toFixed(2)}</td>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right"}}>{resumoSapatasFundacao.totais.areaConcretoMagro.toFixed(2)}</td>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right"}}>{resumoSapatasFundacao.totais.formaArea.toFixed(2)}</td>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right"}}>{resumoSapatasFundacao.totais.volumeBase.toFixed(2)}</td>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right"}}>{resumoSapatasFundacao.totais.volumeTronco.toFixed(2)}</td>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right"}}>{resumoSapatasFundacao.totais.volumeSapata.toFixed(2)}</td>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right",color:C.orange}}>{resumoSapatasFundacao.totais.reaterro.toFixed(2)}</td>
                      <td/><td/><td/><td/><td/><td/>
                      <td style={{padding:dSapatas.padHeader,textAlign:"right",color:C.purple}}>{resumoSapatasFundacao.totais.pesoAco.toFixed(1)}</td>
                      <td/>
                    </tr>
                  </tfoot>}
                </table>
                {!resumoSapatasFundacao.linhas.length&&<p style={{padding:20,textAlign:"center",fontSize:11,color:C.muted}}>Nenhum tipo de sapata cadastrado. Clique em "NOVO TIPO" para começar.</p>}
              </div>

              {resumoSapatasFundacao.acoPorBitola.length>0&&<div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 11px"}}>
                <p style={{fontSize:10.5,fontWeight:900,color:C.purple}}>RESUMO DE AÇO POR BITOLA (já com 10% de perda)</p>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:6}}>
                  {resumoSapatasFundacao.acoPorBitola.map(l=><div key={l.bitola} style={{border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px"}}>
                    <b style={{fontSize:11,color:C.text}}>∅{l.bitola}mm</b><span style={{fontSize:10.5,color:C.muted,marginLeft:6}}>{l.kg.toFixed(1)} kg</span>
                  </div>)}
                  <div style={{border:`1px solid ${C.purple}55`,background:`${C.purple}0c`,borderRadius:6,padding:"6px 10px"}}>
                    <b style={{fontSize:11,color:C.purple}}>TOTAL</b><span style={{fontSize:10.5,color:C.purple,marginLeft:6,fontWeight:800}}>{resumoSapatasFundacao.totais.pesoAco.toFixed(1)} kg</span>
                  </div>
                </div>
              </div>}

              {/* Vincular ao orçamento: painel de referência deixa de ser só
                  referência aqui, por pedido explícito do usuário - cada total
                  pode ser ligado a UMA linha já lançada no orçamento, e um botão
                  sincroniza a quantidade sob demanda (nunca em segundo plano). */}
              <div style={{background:C.bg,border:`1px solid ${C.blue}44`,borderRadius:7,padding:"9px 11px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                  <div><p style={{fontSize:12,fontWeight:850,color:C.text}}>VINCULAR AO ORÇAMENTO</p><p style={{fontSize:10,color:C.muted,marginTop:2}}>Escolha, para cada total, qual linha já lançada no orçamento deve receber essa quantidade. Nada muda sozinho - só ao clicar em "sincronizar".</p></div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Btn size="sm" v="ghost" onClick={sugerirVinculosFundacao} disabled={!itensOrcamentoParaVincular.length}><Ic n="search"/> SUGERIR VÍNCULOS</Btn>
                    <Btn size="sm" onClick={sincronizarVinculosFundacao} disabled={!Object.keys(vinculosFundacao).length}><Ic n="refresh"/> SINCRONIZAR QUANTIDADES</Btn>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {TOTAIS_VINCULAVEIS_FUNDACAO.map(({chave,rotulo,unidade})=>{
                    const valor = resumoSapatasFundacao.totais[chave];
                    const itemVinculado = itensOrcamentoParaVincular.find(it=>it.id===vinculosFundacao[chave]);
                    return (
                      <div key={chave} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"5px 0",borderBottom:`1px solid ${C.line}`}}>
                        <div style={{minWidth:170}}><b style={{fontSize:10.5,color:C.text}}>{rotulo}</b><span style={{fontSize:9.5,color:C.muted,marginLeft:6}}>{valor.toFixed(valor<10?3:2)} {unidade}</span></div>
                        <Ic n="chevR" s={12} color={C.muted}/>
                        <select aria-label={`Linha do orçamento vinculada a ${rotulo}`} value={vinculosFundacao[chave]||""} onChange={e=>salvarVinculosFundacao({[chave]:e.target.value||undefined})}
                          style={{flex:"1 1 260px",minWidth:200,padding:"5px 7px",border:`1px solid ${itemVinculado?C.blue:C.border}`,borderRadius:5,background:C.card,color:C.text,fontSize:10}}>
                          <option value="">Sem vínculo</option>
                          {itensOrcamentoParaVincular.map(it=><option key={it.id} value={it.id}>{it.codigo?`${it.codigo} · `:""}{(it.descricao||"sem descrição").slice(0,70)} ({it.unidade||"UN"})</option>)}
                        </select>
                        {itemVinculado&&<span title="Quantidade atual desta linha no orçamento" style={{fontSize:9.5,color:C.muted}}>atual: {Number(itemVinculado.quantidade||0).toLocaleString("pt-BR",{maximumFractionDigits:3})} {itemVinculado.unidade}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {renderCardPilar(pavimentoMemoria)}
              {renderCardViga(pavimentoMemoria)}
              {PAVIMENTOS_COM_LAJE.includes(pavimentoMemoria) && renderCardLaje(pavimentoMemoria)}
              {renderVincularPavimento(pavimentoMemoria)}
            </div>
          )}
        </div>
      )}

      {checkEdit&&<Modal title="Revisar item do orçamento" onClose={()=>setCheckEdit(null)} wide>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 11px"}}><p style={{fontSize:12,fontWeight:850,color:C.text}}>{checkEdit.titulo}</p><p style={{fontSize:10,color:C.muted,lineHeight:1.5,marginTop:4}}>{checkEdit.detalhe}</p>{checkEdit.acaoSugerida&&<p style={{fontSize:10,color:C.subtle,lineHeight:1.5,marginTop:5}}><b>Próxima ação sugerida:</b> {checkEdit.acaoSugerida}</p>}</div>
          <div><p style={{fontSize:9,fontWeight:850,color:C.muted,textTransform:"uppercase",marginBottom:5}}>Decisão do operador</p><div style={{display:"grid",gridTemplateColumns:formGrid(3),gap:6}}>{[["pendente","Pendente",C.orange],["corrigido","Corrigido",C.green],["ignorado","Ignorar",C.muted]].map(([status,label,color])=><button key={status} onClick={()=>setCheckEdit(item=>({...item,status}))} style={{border:`1.5px solid ${checkEdit.status===status?color:C.border}`,background:checkEdit.status===status?`${color}12`:C.card,color:checkEdit.status===status?color:C.muted,borderRadius:7,padding:"8px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>{label}</button>)}</div></div>
          <label style={{display:"flex",flexDirection:"column",gap:5}}><span style={{fontSize:10,fontWeight:800,color:C.text}}>Observação {checkEdit.status==="ignorado"?"*":""}</span><textarea rows={4} value={checkEdit.observacao||""} onChange={e=>setCheckEdit(item=>({...item,observacao:e.target.value}))} placeholder={checkEdit.status==="corrigido"?"Descreva o que foi corrigido e onde conferir.":checkEdit.status==="ignorado"?"Justifique por que o item não se aplica ao escopo.":"Registre a dúvida, responsável ou ação combinada."} style={{background:C.bg,border:`1.5px solid ${C.border}`,color:C.text,padding:"9px 10px",borderRadius:7,fontSize:11,outline:"none",resize:"vertical",fontFamily:"var(--arcd-font-sans)"}}/></label>
          <p style={{fontSize:9,color:C.muted}}>A decisão ficará vinculada a este orçamento com operador e data. A IA nunca marca um item como corrigido ou ignorado automaticamente.</p>
          <div style={{display:"flex",gap:7}}><Btn v="ghost" onClick={()=>setCheckEdit(null)} full>Cancelar</Btn><Btn onClick={salvarRevisaoChecklist} full><Ic n="check"/> Salvar revisão</Btn></div>
        </div>
      </Modal>}

      {analiseReferencia&&<Modal title={`${analiseReferencia.tipoItem==="COMPOSICAO"?"Composição":"Insumo"} ${analiseReferencia.fonte} ${analiseReferencia.codigo}`} onClose={()=>{setAnaliseReferencia(null);setAnaliseComponentes([]);setAnaliseReferenciaAviso("");}} wide>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:10}}>
            <p style={{fontSize:13,fontWeight:900,color:C.text}}>{analiseReferencia.descricao}</p>
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:7,fontSize:10.5,color:C.muted}}>
              <span><b>Tipo:</b> {analiseReferencia.tipoItem==="COMPOSICAO"?"Composição":"Insumo"}</span>
              <span><b>Unidade:</b> {analiseReferencia.unidade||"UN"}</span>
              <span><b>Preço:</b> {fmt(precoDoItem(analiseReferencia,orc))}</span>
              {analiseReferencia.doOrcamento&&<span><b>Quantidade no orçamento:</b> {Number(analiseReferencia.quantidadeOrc||0).toLocaleString("pt-BR",{maximumFractionDigits:4})} {analiseReferencia.unidade||"UN"}</span>}
              {analiseReferencia.doOrcamento&&<span><b>Custo da linha:</b> {fmt(Number(analiseReferencia.quantidadeOrc||0)*precoDoItem(analiseReferencia,orc))}</span>}
              <span><b>Data-base:</b> {analiseReferencia.dataBase||orc?.dataBase||"-"}</span>
              {analiseReferencia.uf&&<span><b>UF:</b> {analiseReferencia.uf}</span>}
              {analiseReferencia.classificacao&&<span><b>Classificação:</b> {analiseReferencia.classificacao}</span>}
            </div>
          </div>

          {analiseReferenciaLoading&&<p style={{padding:18,textAlign:"center",fontSize:11,color:C.blue,fontWeight:800}}>CARREGANDO ANÁLISE...</p>}
          {analiseReferenciaAviso&&<div style={{background:`${C.orange}10`,border:`1px solid ${C.orange}55`,borderRadius:7,padding:"8px 10px",fontSize:10.5,color:C.orange}}>{analiseReferenciaAviso}</div>}

          {analiseReferencia.memoriaTexto&&<div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px"}}>
            <p style={{fontSize:11,fontWeight:900,color:C.text,marginBottom:5}}>MEMÓRIA DE PREÇOS DO ITEM</p>
            <pre style={{fontSize:10.5,color:C.muted,lineHeight:1.6,whiteSpace:"pre-wrap",fontFamily:"var(--arcd-font-sans)",margin:0}}>{analiseReferencia.memoriaTexto}</pre>
          </div>}

          {analiseReferencia.tipoItem==="COMPOSICAO"&&!analiseReferenciaLoading&&analiseComponentes.length>0&&<>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><p style={{fontSize:12,fontWeight:900,color:C.text}}>COMPOSIÇÃO ANALÍTICA DIRETA</p><b style={{fontSize:13,color:C.yellowD}}>{fmt(analiseComponentes.reduce((s,item)=>s+Number(item.coeficiente||0)*precoDoItem(item,orc),0))}</b></div>
            <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:7,maxHeight:390,overflowY:"auto"}}><table style={{width:"100%",minWidth:760,borderCollapse:"collapse",fontSize:10}}>
              <thead style={{position:"sticky",top:0,zIndex:1}}><tr style={{background:C.surface}}>{["TIPO","FONTE","CÓDIGO","DESCRIÇÃO","UN.","COEFICIENTE","PREÇO UNIT.","TOTAL"].map(h=><th key={h} style={{padding:"7px 6px",textAlign:["COEFICIENTE","PREÇO UNIT.","TOTAL"].includes(h)?"right":"left",color:C.muted,fontSize:8.5,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
              <tbody>{analiseComponentes.map((item,index)=><tr key={`${item.itemType}-${item.itemCode}-${index}`} style={{borderBottom:`1px solid ${C.line}`}}>
                <td style={{padding:6,color:item.itemType==="COMPOSICAO"?C.green:C.orange,fontWeight:800}}>{item.itemType}</td>
                <td style={{padding:6,fontWeight:800,color:item.fonte==="ORSE"?C.purple:C.blue}}>{item.fonte}</td><td style={{padding:6}}>{item.itemCode}</td>
                <td title={item.descricao} style={{padding:6,maxWidth:310,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.descricao}</td><td style={{padding:6}}>{item.unidade}</td>
                <td style={{padding:6,textAlign:"right"}}>{Number(item.coeficiente||0).toLocaleString("pt-BR",{maximumFractionDigits:8})}</td><td style={{padding:6,textAlign:"right"}}>{fmt(precoDoItem(item,orc))}</td><td style={{padding:6,textAlign:"right",fontWeight:800}}>{fmt(Number(item.coeficiente||0)*precoDoItem(item,orc))}</td>
              </tr>)}</tbody>
            </table></div>
          </>}

          <div style={{display:"flex",justifyContent:"flex-end",gap:7,flexWrap:"wrap"}}>
            {/* Clonar so faz sentido para composicao que vive na base de referencia.
                Composicao propria e cotacao ja sao da empresa - para essas o
                caminho e editar/duplicar na aba Próprias. */}
            {analiseReferencia.tipoItem==="COMPOSICAO"
              && !/^(PR[ÓO]PRIA|EXTERNO|COTA[CÇ][AÃ]O)$/.test(String(analiseReferencia.fonte||"").toUpperCase())
              && !analiseReferencia.memoriaTexto
              && <Btn v="success" onClick={()=>{const item=analiseReferencia;setAnaliseReferencia(null);clonarComposicaoReferencia(item);}}>CLONAR PARA A EMPRESA</Btn>}
            <Btn v="ghost" onClick={()=>{setAnaliseReferencia(null);setAnaliseComponentes([]);setAnaliseReferenciaAviso("");}}>FECHAR</Btn>
          </div>
        </div>
      </Modal>}

      <ConfirmDialog open={!!confirmDelEtapa} onOpenChange={aberto=>!aberto&&setConfirmDelEtapa(null)}
        title="Excluir etapa" tone="danger" confirmLabel="Excluir"
        description={confirmDelEtapa?.aviso}
        onConfirm={executarDelEtapa}/>
    </div>
  );
}
