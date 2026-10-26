import { ArrowRight } from "lucide-react";
import { Button } from "../../../design-system/primitives/Button";
import "./purchases-by-work.css";

const moeda = valor => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor || 0);
const moedaExata = valor => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
const percentual = pct => `${pct >= 1000 ? "+999" : Math.round(pct)}%`;

const SEM_CONTROLE = {
  sem_orcamento: { label: "Sem orçamento", dica: "A obra ainda não tem orçamento. Crie um em Orçamento para comparar o que foi comprado." },
  baseline_ausente: { label: "Sem baseline aprovada", dica: "Há orçamento, mas nenhuma versão foi aprovada como baseline de controle. Em Orçamento, use “Aprovar baseline” (somente administrador)." },
  baseline_ambigua: { label: "Baseline duplicada", dica: "Há mais de uma baseline de controle ativa nesta obra. Mantenha apenas uma em Orçamento." },
  versao_ausente: { label: "Baseline sem versão", dica: "A baseline aponta para uma versão de orçamento que não existe mais. Adote outra em Orçamento." },
};

// Por que a obra não tem orçamento de controle: "não tem orçamento" e "falta
// aprovar a baseline" pedem providências diferentes.
export const motivoSemControle = linha => (!linha.temOrcamento && linha.motivoSemControle === "baseline_ausente"
  ? SEM_CONTROLE.sem_orcamento
  : SEM_CONTROLE[linha.motivoSemControle] || SEM_CONTROLE.baseline_ausente);

const tomDoOrcamento = linha => (linha.gravidade === 0 ? "danger" : linha.pctOrcado != null && linha.pctOrcado >= 90 ? "warning" : "ok");

const resumoDePrazo = linha => (linha.atrasados > 0
  ? { tom: "danger", texto: `${linha.atrasados} atrasada${linha.atrasados > 1 ? "s" : ""}` }
  : linha.atencaoPrazo > 0
    ? { tom: "warning", texto: `${linha.atencaoPrazo} em atenção` }
    : linha.andamento > 0 ? { tom: "success", texto: "No prazo" } : { tom: "neutral", texto: "Sem pendências" });

export function PurchasesByWork({ model, onOpenWork, titulo = "Compras por obra", legenda }) {
  const { linhas, totais } = model;
  if (!linhas.length) return null;
  return <section className="purchase-by-work" aria-label={titulo}>
    <header>
      <div><h4>{titulo}</h4>
        <p>{legenda || "Ordenado por risco: orçamento estourado, entrega atrasada e perto do limite primeiro."}</p></div>
      {totais.semControle > 0 && <span className="purchase-by-work__note">{totais.semControle} de {totais.obras} obra(s) sem orçamento de controle</span>}
    </header>
    <div className="purchase-table-scroll" tabIndex={0} role="region" aria-label={`${titulo}: tabela comparativa`}>
      <table className="purchase-work-table">
        <caption className="purchase-sr-only">Orçado, comprometido, a receber, a pagar e prazos de compras em cada obra</caption>
        <thead><tr>
          <th scope="col">Obra</th><th scope="col">Orçado</th><th scope="col">Comprometido</th>
          <th scope="col">A receber</th><th scope="col">A pagar</th><th scope="col">Prazos</th><th scope="col"><span className="purchase-sr-only">Ação</span></th>
        </tr></thead>
        <tbody>{linhas.map(linha => {
          const prazo = resumoDePrazo(linha);
          const tom = tomDoOrcamento(linha);
          const semControle = linha.temControle ? null : motivoSemControle(linha);
          return <tr key={linha.obraId}>
            <td role="rowheader" className="purchase-work-name" data-label="Obra"><b>{linha.obra}</b>
              {linha.estouradas > 0 && <span className="purchase-chip" data-tone="danger">Estourou em {linha.estouradas} etapa{linha.estouradas > 1 ? "s" : ""}</span>}
              {linha.estouradas === 0 && linha.atencaoOrcamento > 0 && <span className="purchase-chip" data-tone="warning">{linha.atencaoOrcamento} etapa{linha.atencaoOrcamento > 1 ? "s" : ""} perto do limite</span>}
              {semControle && <span className="purchase-chip" data-tone="neutral" title={semControle.dica}>{semControle.label}</span>}
            </td>
            <td data-label="Orçado" className="purchase-num">{linha.temControle ? <span title={moedaExata(linha.orcado)}>{moeda(linha.orcado)}</span> : <span aria-label="sem orçamento de controle">—</span>}</td>
            <td data-label="Comprometido" className="purchase-num">
              <span title={moedaExata(linha.comprometido)}>{moeda(linha.comprometido)}</span>
              {linha.pctOrcado != null && <>
                <span className="purchase-work-bar" data-tone={tom} role="img" aria-label={`${percentual(linha.pctOrcado)} do orçamento comprometido`}>
                  <i style={{ width: `${Math.min(100, linha.pctOrcado)}%` }} /></span>
                <small data-tone={tom}>{linha.pctOrcado > 100 ? "▲ " : ""}{percentual(linha.pctOrcado)} do orçado</small></>}
            </td>
            <td data-label="A receber" className="purchase-num"><span title={moedaExata(linha.aReceber)}>{moeda(linha.aReceber)}</span></td>
            <td data-label="A pagar" className="purchase-num"><span title={moedaExata(linha.aPagar)}>{moeda(linha.aPagar)}</span></td>
            <td data-label="Prazos"><span className="purchase-chip" data-tone={prazo.tom}>{prazo.texto}</span>
              {linha.andamento > 0 && <small>{linha.andamento} em andamento</small>}</td>
            <td className="purchase-work-action"><Button variant="secondary" size="sm" onClick={() => onOpenWork(linha.obraId)} aria-label={`Abrir compras de ${linha.obra}`}>Abrir<ArrowRight size={14} aria-hidden="true" /></Button></td>
          </tr>;
        })}</tbody>
        <tfoot><tr>
          <td role="rowheader" className="purchase-work-name" data-label="Obra">Todas as obras ({totais.obras})</td>
          <td data-label="Orçado" className="purchase-num">{totais.semControle < totais.obras
            ? <><span title={moedaExata(totais.orcado)}>{moeda(totais.orcado)}</span>{totais.semControle > 0 && <small>só obras com orçamento de controle</small>}</>
            : <span aria-label="nenhuma obra com orçamento de controle">—</span>}</td>
          <td data-label="Comprometido" className="purchase-num"><span title={moedaExata(totais.comprometido)}>{moeda(totais.comprometido)}</span>
            {totais.pctOrcado != null && <small>{percentual(totais.pctOrcado)} do orçado nas obras com controle</small>}</td>
          <td data-label="A receber" className="purchase-num"><span title={moedaExata(totais.aReceber)}>{moeda(totais.aReceber)}</span></td>
          <td data-label="A pagar" className="purchase-num"><span title={moedaExata(totais.aPagar)}>{moeda(totais.aPagar)}</span></td>
          <td data-label="Prazos"><span className="purchase-chip" data-tone={totais.atrasados > 0 ? "danger" : "neutral"}>{totais.atrasados > 0 ? `${totais.atrasados} atrasada${totais.atrasados > 1 ? "s" : ""}` : "Sem atrasos"}</span><small>{totais.andamento} em andamento</small></td>
          <td />
        </tr></tfoot>
      </table>
    </div>
  </section>;
}
