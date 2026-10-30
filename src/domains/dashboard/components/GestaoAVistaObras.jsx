import {useState} from "react";
import {Ic} from "../../../LegacyApp";
import {SITUACAO_REGRA as R,SITUACOES} from "../gestao-a-vista.js";

// "Suas obras hoje": uma linha por obra ativa, lida da esquerda para a direita
// (situação → etapa → equipe → custo × avanço → entrega). Só exibe o resumo
// pronto de resumoGestaoAVista; nenhuma regra de cálculo mora aqui.
const ORDEM=["ok","atencao","critico"];
const ICONE={ok:"check",atencao:"clock",critico:"alert"};
const pct=v=>`${Number(v).toLocaleString("pt-BR",{maximumFractionDigits:1})}%`;
const dataBr=iso=>iso.split("-").reverse().join("/");

function Etapas({linha}){
  if(!linha.etapas.length)return <span className="gav-vazio">Sem cronograma</span>;
  return <div className="gav-etapas">
    <div className="gav-etapas__trilho" aria-hidden="true">{linha.etapas.map(e=><span key={e.id} className={`gav-etapas__passo is-${e.estado}`} style={{flexGrow:e.peso}} title={e.nome}/>)}</div>
    <span className="gav-etapas__nome">{linha.etapaAtual}</span>
  </div>;
}

function CustoAvanco({linha}){
  if(linha.orcado===null)return <span className="gav-vazio">Sem orçamento aprovado</span>;
  if(linha.avanco===null)return <span className="gav-vazio">Gasto {pct(linha.gastoPct)} · sem medição</span>;
  const aFrente=linha.desvio!==null&&linha.desvio>=R.atencaoDesvio;
  return <div className="gav-custo">
    <div className="gav-custo__barra" role="img" aria-label={`Gasto ${pct(linha.gastoPct)} do orçado, executado ${pct(linha.avanco)}`}>
      <span className={`gav-custo__gasto${aFrente?" is-alerta":""}`} style={{width:`${Math.min(100,linha.gastoPct)}%`}}/>
      <span className="gav-custo__marca" style={{left:`${Math.min(100,linha.avanco)}%`}}/>
    </div>
    <span className="gav-custo__legenda">Gasto <b>{pct(linha.gastoPct)}</b> · executado <b>{pct(linha.avanco)}</b>{linha.avancoFonte==="cronograma"?" (cronograma)":""}</span>
  </div>;
}

function Entrega({linha}){
  if(!linha.entrega)return <span className="gav-vazio">Sem data de entrega</span>;
  const d=linha.diasEntrega;
  return <div className="gav-entrega">
    <span>{dataBr(linha.entrega)}</span>
    <span className={d<0?"is-critico":d<R.atencaoDiasEntrega?"is-atencao":""}>{d<0?`vencida há ${-d} dia(s)`:d===0?"hoje":`em ${d} dia(s)`}</span>
  </div>;
}

export default function GestaoAVistaObras({resumo,hoje,onAbrirObra}){
  const [filtro,setFiltro]=useState(null);
  const linhas=filtro?resumo.linhas.filter(l=>l.situacao===filtro):resumo.linhas;
  return <section className="gav" aria-labelledby="gav-titulo">
    <header className="gav__topo">
      <div>
        <h3 id="gav-titulo" className="gav__titulo">Suas obras hoje</h3>
        <p className="gav__sub">{dataBr(hoje)} · {resumo.equipeHoje} pessoa(s) em campo{resumo.custoAte?` · custo até ${resumo.custoAte.split("-").reverse().join("/")}`:""}</p>
      </div>
      <div className="gav-placar" role="group" aria-label="Filtrar obras por situação">
        {ORDEM.map(s=><button key={s} type="button" className={`gav-placar__item is-${s}`} aria-pressed={filtro===s} onClick={()=>setFiltro(f=>f===s?null:s)}>
          <b>{resumo.contagem[s]}</b><span>{SITUACOES[s]}</span>
        </button>)}
      </div>
    </header>
    {!resumo.linhas.length?<p className="gav-vazio gav__nada">Nenhuma obra ativa.</p>:<div className="gav-lista" role="table" aria-label="Situação das obras ativas">
      <div className="gav-linha gav-linha--cabecalho" role="row">
        {["Obra","Situação","Etapa","Equipe hoje","Custo × avanço","Entrega"].map(t=><span key={t} role="columnheader">{t}</span>)}
      </div>
      {linhas.map(l=><div key={l.id} className="gav-linha" role="row">
        <span role="cell" className="gav-obra">
          <button type="button" className="gav-obra__nome" onClick={()=>onAbrirObra?.(l.id)}>{l.nome}</button>
          <span className="gav-obra__motivo">{l.motivo}</span>
        </span>
        <span role="cell"><span className={`gav-chip is-${l.situacao}`}><Ic n={ICONE[l.situacao]} s={12}/>{SITUACOES[l.situacao]}</span></span>
        <span role="cell"><Etapas linha={l}/></span>
        <span role="cell" className="gav-equipe">{l.equipeHoje}</span>
        <span role="cell"><CustoAvanco linha={l}/></span>
        <span role="cell"><Entrega linha={l}/></span>
      </div>)}
    </div>}
    {filtro&&resumo.linhas.length>0&&!linhas.length&&<p className="gav-vazio gav__nada">Nenhuma obra em “{SITUACOES[filtro]}”.</p>}
    <p className="gav__legenda">Crítico: custo mais de {R.criticoDesvio} pontos à frente do avanço ou prazo vencido. Atenção: {R.atencaoDesvio} a {R.criticoDesvio} pontos, entrega em menos de {R.atencaoDiasEntrega} dias ou ponto pendente.</p>
  </section>;
}
