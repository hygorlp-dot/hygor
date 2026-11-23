import {contar} from '../../../design-system/copy.js';
import {useId,useMemo,useState} from "react";
import { Ic } from "../../../legacy/ui.jsx";
import { Button } from "../../../components/ui/button.jsx";
import { FilterBar } from "../../../design-system/patterns/FilterBar.jsx";
import { Input } from "../../../design-system/primitives/Input.jsx";
import { useWorkspaceState } from "../../../features/workflow/workspace-session.jsx";
import { fmt, fmtCompact } from "../../../legacy/format.js";
import {SITUACAO_REGRA as R,SITUACOES} from "../gestao-a-vista.js";
import { DIARY_GOAL, DIARY_MILESTONES, previousOperationDay, summarizeDiaryChallenge, summarizeOperationDay } from "../daily-operation.js";

// "Suas obras hoje": uma linha por obra ativa, lida da esquerda para a direita
// (situação → etapa → equipe → custo × avanço → entrega). Só exibe o resumo
// pronto de resumoGestaoAVista; nenhuma regra de cálculo mora aqui.
const ORDEM=["ok","atencao","critico"];
const ICONE={ok:"check",atencao:"clock",critico:"alert"};
const pct=v=>`${Number(v).toLocaleString("pt-BR",{maximumFractionDigits:1})}%`;
const dataBr=iso=>iso.split("-").reverse().join("/");
const normalizarBusca=texto=>texto.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR').trim();
export const WORK_SCORE_SEARCH_ID = 'buscar-obra-no-placar';

function Etapas({linha}){
  if(!linha.etapas.length)return <span className="gav-vazio">{linha.avanco===null?"Sem cronograma":`Sem cronograma · ${pct(linha.avanco)} medido`}</span>;
  return <div className="gav-etapas">
    <div className="gav-etapas__trilho" aria-hidden="true">{linha.etapas.map(e=><span key={e.id} className={`gav-etapas__passo is-${e.estado}`} style={{flexGrow:e.peso}} title={e.nome}/>)}</div>
    {/* Barra sozinha não diz quanto falta: o avanço físico vai escrito ao lado da etapa. */}
    <span className="gav-etapas__nome">{linha.etapaAtual}{linha.avanco!==null?` · ${pct(linha.avanco)} ${linha.avancoFonte==="cronograma"?"no plano":"medido"}`:""}</span>
  </div>;
}

// Enquanto o custo oficial (servidor) não chega, ou se o perfil não pode vê-lo,
// a coluna diz isso em vez de mostrar uma barra sem custo.
const SEM_CUSTO={carregando:"Calculando o custo…","sem-acesso":"Custo visível só para quem acessa a DRE",erro:"Custo indisponível agora"};

function CustoAvanco({linha,custoStatus}){
  if(custoStatus!=="ok")return <span className="gav-vazio">{SEM_CUSTO[custoStatus]||SEM_CUSTO.erro}</span>;
  if(linha.orcado===null)return <span className="gav-vazio">Sem orçamento aprovado</span>;
  if(!linha.orcado)return <span className="gav-vazio">Orçamento aprovado sem valor</span>;
  // Custo null nunca é "gasto 0%": o servidor não calcula obra sem data de início.
  if(linha.custo===null||linha.gastoPct===null)return <span className="gav-vazio">Custo não calculado (obra sem data de início)</span>;
  if(linha.avanco===null)return <span className="gav-vazio">Gasto {pct(linha.gastoPct)} · sem medição</span>;
  const aFrente=linha.desvio!==null&&linha.desvio>=R.atencaoDesvio;
  return <div className="gav-custo">
    <div className="gav-custo__barra" role="img" aria-label={`Gasto ${pct(linha.gastoPct)} do orçado, executado ${pct(linha.avanco)}`}>
      <span className={`gav-custo__gasto${aFrente?" is-alerta":""}`} style={{width:`${Math.min(100,linha.gastoPct)}%`}}/>
      <span className="gav-custo__marca" style={{left:`${Math.min(100,linha.avanco)}%`}}/>
    </div>
    <span className="gav-custo__legenda">Gasto <b>{pct(linha.gastoPct)}</b> · executado <b>{pct(linha.avanco)}</b>{linha.avancoFonte==="cronograma"?" (cronograma)":""}</span>
    <span className="gav-custo__legenda" title={`${fmt(linha.custo)} de ${fmt(linha.orcado)}`}>{fmtCompact(linha.custo)} de {fmtCompact(linha.orcado)}</span>
  </div>;
}

function Entrega({linha}){
  if(!linha.entrega)return <span className="gav-vazio">Sem data de entrega</span>;
  const d=linha.diasEntrega;
  return <div className="gav-entrega">
    <span>{dataBr(linha.entrega)}</span>
    <span className={d<0?"is-critico":d<R.atencaoDiasEntrega?"is-atencao":""}>{d<0?`vencida há ${contar(-d,"dia","dias")}`:d===0?"hoje":`em ${contar(d,"dia","dias")}`}</span>
  </div>;
}

function PontoDaObra({ponto}) {
  if (!ponto) return <span className="gav-vazio">Ponto indisponível</span>;
  if (!ponto.present && !ponto.absent) return <span className="gav-vazio">Sem presença ou falta registrada</span>;
  return <div className="gav-ponto">
    <span>{contar(ponto.present,'presença','presenças')}</span>
    <span data-absence={ponto.absent>0}>{contar(ponto.absent,'falta','faltas')}</span>
  </div>;
}

function DiarioDaObra({report,diariosDaSemana,obra,dia,onAbrirDiario}) {
  if (diariosDaSemana===undefined) return <span className="gav-vazio">Diário fora do recorte</span>;
  const status=report?.status;
  const next=DIARY_MILESTONES.find(marco=>diariosDaSemana<marco);
  const remaining=next-diariosDaSemana;
  const acao=status==='cancelado'?'Consultar cancelamento':report?'Abrir rascunho':'Preparar diário';
  return <div className="gav-diario">
    <span>{status==='concluido'?'Concluído':status==='cancelado'?'Cancelado':report?'Em preparação':'Sem diário'}</span>
    <div className="gav-diario__trilho" aria-hidden="true">
      {Array.from({length:DIARY_GOAL},(_,index)=><span key={index} data-complete={index<diariosDaSemana}/>)}
    </div>
    <span className="gav-vazio gav-diario__meta">{next?`${diariosDaSemana}/${DIARY_GOAL} · ${remaining===1?'Falta':'Faltam'} ${contar(remaining,'dia','dias')} para o marco de ${next}`:<strong className="gav-diario__conquista"><Ic n="check" s={12}/> Meta conquistada · {contar(diariosDaSemana,'dia','dias')}</strong>}</span>
    {status!=='concluido'&&onAbrirDiario&&<Button type="button" size="sm" variant="link" className="gav-diario__acao"
      aria-label={`${acao} de ${obra.nome} em ${dataBr(dia)}`} onClick={()=>onAbrirDiario(obra.id,dia,report?.id)}>{acao}</Button>}
  </div>;
}

function WorkScoreRow({linha, onAbrirObra, onAbrirDiario, acompanhamento, mostrarPonto, showDiaries, registro, desafio, dia, custoStatus}) {
  const [expanded, setExpanded] = useState(false);
  const prefix = useId();
  const ids = ['etapa','custo','prazo'].map(key => `${prefix}-${key}`);
  const workId = String(linha.id);
  const ponto = registro?.attendanceByWork && (registro.attendanceByWork.get(workId) || {present:0,absent:0});
  const rotulo = expanded ? 'Ocultar indicadores' : 'Ver indicadores';
  return <div className="gav-linha" role="row" data-details-open={expanded}>
    <span role="cell" className="gav-obra">
      {onAbrirObra?<button type="button" className="gav-obra__nome" onClick={()=>onAbrirObra(linha.id)}>{linha.nome}</button>:<strong className="gav-obra__nome-estatico">{linha.nome}</strong>}
    </span>
    {acompanhamento&&<div role="cell" className="gav-situacao">
      <span className={`gav-chip is-${linha.situacao}`}><Ic n={ICONE[linha.situacao]} s={12}/>{SITUACOES[linha.situacao]}</span>
      <span className="gav-obra__motivo">{linha.motivo}</span>
    </div>}
    {mostrarPonto&&<div role="cell" className="gav-ponto-celula"><span className="gav-mobile-label">Ponto</span>{registro?<PontoDaObra ponto={ponto}/>:linha.equipeHoje}</div>}
    {showDiaries&&<div role="cell"><span className="gav-mobile-label">Diário</span>{desafio?<DiarioDaObra report={registro.diaryByWork?.get(workId)} diariosDaSemana={desafio.get(workId)} obra={linha} dia={dia} onAbrirDiario={onAbrirDiario}/>:<span className="gav-vazio">Diário indisponível</span>}</div>}
    {acompanhamento&&<>
      <div role="cell" className="gav-details-toggle"><Button type="button" variant="ghost" size="sm" aria-expanded={expanded} aria-controls={ids.join(' ')} aria-label={`${rotulo} de ${linha.nome}`} onClick={()=>setExpanded(value=>!value)}>{rotulo}</Button></div>
      <div role="cell" id={ids[0]} className="gav-technical gav-etapa-celula"><span className="gav-mobile-label">Etapa e avanço</span><Etapas linha={linha}/></div>
      <div role="cell" id={ids[1]} className="gav-technical"><span className="gav-mobile-label">Custo vs. avanço</span><CustoAvanco linha={linha} custoStatus={custoStatus}/></div>
      <div role="cell" id={ids[2]} className="gav-technical"><span className="gav-mobile-label">Entrega</span><Entrega linha={linha}/></div>
    </>}
  </div>;
}

export default function GestaoAVistaObras({resumo,hoje,onAbrirObra,onAbrirDiario,custoStatus="ok",data,works,diaryWorks,workId,showAttendance=false,showDiaries=false}){
  const [filtro,setFiltro]=useWorkspaceState('home','placarSituacao',null);
  const [ontem,setOntem]=useWorkspaceState('home','placarOntem',false);
  const [busca,setBusca]=useWorkspaceState('home','placarBusca','');
  const dia=ontem?previousOperationDay(hoje):hoje;
  const mostrarPonto=showAttendance||!data;
  const acompanhamento=Boolean(resumo);
  const todas=resumo?.linhas||works.map(obra=>({id:obra.id,nome:obra.name||'Obra sem nome'}));
  const termo=normalizarBusca(busca);
  const linhas=todas.filter(l=>(!filtro||l.situacao===filtro)&&(!termo||normalizarBusca(l.nome).includes(termo)));
  const idsDiario=useMemo(()=>showDiaries?new Set(diaryWorks.map(obra=>String(obra.id))):null,[showDiaries,diaryWorks]);
  const registro=useMemo(()=>data?summarizeOperationDay(data,dia,{workId,diaryWorks:idsDiario,showAttendance}):null,[data,dia,workId,idsDiario,showAttendance]);
  const desafio=useMemo(()=>idsDiario?summarizeDiaryChallenge(data,hoje,idsDiario):null,[data,hoje,idsDiario]);
  const conquistas=desafio?[...desafio.values()].filter(total=>total>=DIARY_GOAL).length:0;
  return <section className="gav" aria-labelledby="gav-titulo">
    <header className="gav__topo">
      <div>
        <h2 id="gav-titulo" className="gav__titulo">Placar das obras</h2>
        <p className="gav__sub">{data?contar(todas.length,'obra em acompanhamento','obras em acompanhamento'):`${dataBr(hoje)} · ${contar(resumo.equipeHoje,'pessoa','pessoas')} em campo`}{custoStatus==="ok"&&resumo?.custoAte?` · custo até ${resumo.custoAte.split("-").reverse().join("/")}`:""}</p>
      </div>
      {acompanhamento&&<div className="gav-placar" role="group" aria-label="Filtrar obras por situação">
        {ORDEM.map(s=><button key={s} type="button" className={`gav-placar__item is-${s}`} data-zero={resumo.contagem[s]===0||undefined} aria-pressed={filtro===s} onClick={()=>setFiltro(f=>f===s?null:s)}>
          <b>{resumo.contagem[s]}</b><span>{SITUACOES[s]}</span>
        </button>)}
      </div>}
    </header>
    {todas.length>0&&<FilterBar className="gav-periodo" label="Filtros do placar">
      <Input id={WORK_SCORE_SEARCH_ID} type="search" fieldClassName="gav-busca" label="Buscar obra" value={busca} onChange={event=>setBusca(event.target.value)}/>
      {(showAttendance||showDiaries)&&<div className="gav-periodo__data">
        <div className="dashboard-queue-filters" role="group" aria-label="Dia do ponto e do diário">
          <Button type="button" size="sm" variant={ontem?'ghost':'secondary'} aria-pressed={!ontem} onClick={()=>setOntem(false)}>Hoje</Button>
          <Button type="button" size="sm" variant={ontem?'secondary':'ghost'} aria-pressed={ontem} onClick={()=>setOntem(true)}>Ontem</Button>
        </div>
        <time dateTime={dia}>{dataBr(dia)}</time>
      </div>}
    </FilterBar>}
    {desafio?.size>0&&<div className="gav-desafio">
      <div><h3>Desafio dos diários</h3><p>Meta por obra de {DIARY_GOAL} dias com diário concluído nos últimos 7 dias, com marcos em 1, 3 e 5.</p></div>
      <p><strong>{conquistas} de {desafio.size}</strong> {desafio.size===1?'obra conquistou':'obras conquistaram'} a meta</p>
    </div>}
    {termo&&linhas.length>0&&<p className="gav-resultado gav-vazio" role="status">{linhas.length} de {contar(todas.length,'obra no placar','obras no placar')}</p>}
    {!todas.length?<p className="gav-vazio gav__nada">Nenhuma obra ativa.</p>:<div className="gav-lista" role="table" aria-label="Situação das obras ativas" data-management={acompanhamento} data-attendance={mostrarPonto} data-diaries={showDiaries}>
      <div className="gav-linha gav-linha--cabecalho" role="row">
        <span role="columnheader">Obra</span>
        {acompanhamento&&<span role="columnheader">Situação da obra</span>}
        {mostrarPonto&&<span role="columnheader">{data?'Presenças e faltas':'Equipe hoje'}</span>}
        {showDiaries&&<span role="columnheader">Diário e desafio</span>}
        {acompanhamento&&<><span role="columnheader">Etapa e avanço</span><span role="columnheader">Custo vs. avanço físico</span><span role="columnheader">Entrega</span></>}
      </div>
      {linhas.map(linha=><WorkScoreRow key={linha.id} linha={linha} onAbrirObra={onAbrirObra} onAbrirDiario={onAbrirDiario} acompanhamento={acompanhamento}
        mostrarPonto={mostrarPonto} showDiaries={showDiaries} registro={registro} desafio={desafio} dia={dia} custoStatus={custoStatus}/>)}
    </div>}
    {todas.length>0&&!linhas.length&&<p className="gav-vazio gav__nada" role="status">{termo?'Nenhuma obra encontrada com os filtros atuais.':`Nenhuma obra em “${SITUACOES[filtro]}”.`}</p>}
    {acompanhamento&&<details className="gav__legenda"><summary>Como é calculada a situação da obra</summary>
      <p>Crítico por custo mais de {R.criticoDesvio} pontos à frente do avanço ou prazo vencido. Atenção por diferença de {R.atencaoDesvio} a {R.criticoDesvio} pontos, entrega em menos de {R.atencaoDiasEntrega} dias{mostrarPonto?" ou ponto sem registro no último dia útil":""}.{custoStatus!=="ok"?(mostrarPonto?" Sem o custo, a situação considera só prazo e ponto.":" Neste acesso, a situação indica os alertas de prazo."):""}{mostrarPonto?" Faltas registradas aparecem no Ponto e não mudam a classificação.":""}</p>
    </details>}
  </section>;
}
