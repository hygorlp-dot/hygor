import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { Button } from "../../design-system/primitives/Button.jsx";
import { formatMoney } from "./rental-operations.js";

const pct = value => value == null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const signedMoney = value => `${value < 0 ? "−" : ""}${formatMoney(Math.abs(Number(value || 0)))}`;

const metricLabel = metric => ({
  receita: "receita líquida",
  custo: "custo",
  resultado: "resultado",
  margem: "margem",
}[metric] || "resultado");

function Metric({ label, value, note, negative = false, highlight = false }) {
  return <div className="bc-analysis__metric" data-negative={negative} data-highlight={highlight}>
    <span>{label}</span>
    <strong className="bc-mono">{value}</strong>
    {note && <small>{note}</small>}
  </div>;
}

export default function BillingOwnershipAnalysis({
  analysis, focus = "resultado", scope = "", formatDate, formatComposition, onEditRental, onClose,
}) {
  const closeRef = useRef(null);
  const [equipmentId, setEquipmentId] = useState(analysis?.equipments?.[0]?.id || "");

  useEffect(() => {
    setEquipmentId(analysis?.equipments?.[0]?.id || "");
  }, [analysis?.ownership, analysis?.equipments]);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const keydown = event => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus?.();
    };
  }, [onClose]);

  if (!analysis) return null;
  const { summary } = analysis;
  const selected = analysis.equipments.find(item => item.id === equipmentId) || analysis.equipments[0] || null;
  const loss = summary.resultado < 0 ? Math.abs(summary.resultado) : 0;

  return <div className="bc-analysis-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose?.();
  }}>
    <aside className="bc-analysis" role="dialog" aria-modal="true" aria-labelledby="bc-analysis-title">
      <header className="bc-analysis__header">
        <div>
          <p className="bc-eyebrow">Memória de cálculo · {scope}</p>
          <h3 id="bc-analysis-title">Análise de {metricLabel(focus)} · {analysis.label}</h3>
          <p className="bc-note">
            {summary.resultado < 0
              ? `O custo supera a receita líquida em ${formatMoney(loss)} neste recorte.`
              : `O resultado deste recorte é ${signedMoney(summary.resultado)}.`}
          </p>
        </div>
        <button ref={closeRef} type="button" className="bc-analysis__close" onClick={onClose} aria-label="Fechar análise"><X size={18} aria-hidden="true" /></button>
      </header>

      <section className="bc-analysis__section" aria-labelledby="bc-analysis-equation">
        <div className="bc-analysis__section-head">
          <h4 id="bc-analysis-equation">Como o número é formado</h4>
          <span className="bc-note">{analysis.equipments.length} equipamento(s) · {analysis.negativeEquipments} com resultado negativo</span>
        </div>
        <div className="bc-analysis__equation">
          <Metric label="Receita contratual" value={formatMoney(summary.receitaContratual)} />
          <span aria-hidden="true">−</span>
          <Metric label="Descontos" value={formatMoney(summary.descontos)} />
          <span aria-hidden="true">=</span>
          <Metric label="Receita líquida" value={formatMoney(summary.receitaLiquida)} highlight={focus === "receita"} />
          <span aria-hidden="true">−</span>
          <Metric label="Custo" value={formatMoney(summary.custo)} note={summary.manutencaoApropriada ? "repasses + manutenção" : "repasses"} highlight={focus === "custo"} />
          <span aria-hidden="true">=</span>
          <Metric label="Resultado" value={signedMoney(summary.resultado)} negative={summary.resultado < 0} highlight={focus === "resultado"} />
          <Metric label="Margem" value={pct(summary.margem)} negative={summary.margem != null && summary.margem < 0} highlight={focus === "margem"} />
        </div>
        <div className="bc-analysis__costs">
          <span>Repasses <b className="bc-mono">{formatMoney(summary.repasses)}</b></span>
          <span>Manutenção <b className="bc-mono">{summary.manutencaoApropriada ? formatMoney(summary.manutencao) : "não apropriada"}</b></span>
          <span>Reconciliação <b className="bc-mono">{Math.abs(analysis.differences.resultado) < 0.005 ? "✓ fecha com o painel" : signedMoney(analysis.differences.resultado)}</b></span>
        </div>
      </section>

      {analysis.owners.length > 0 && <section className="bc-analysis__section" aria-labelledby="bc-analysis-owners">
        <div className="bc-analysis__section-head"><h4 id="bc-analysis-owners">Por proprietário</h4></div>
        <div className="bc-table-wrap">
          <table className="bc-table bc-table--compact">
            <thead><tr><th scope="col">Proprietário</th><th scope="col" className="num">Equip.</th><th scope="col" className="num">Receita líquida</th><th scope="col" className="num">Repasse</th><th scope="col" className="num">Resultado</th><th scope="col" className="num">Margem</th></tr></thead>
            <tbody>{analysis.owners.map(owner => <tr key={owner.owner} data-negative={owner.finance.resultado < 0}>
              <td><strong>{owner.owner}</strong><span className="bc-note">{owner.locacoes} locação(ões)</span></td>
              <td className="num bc-mono">{owner.equipamentos}</td>
              <td className="num bc-mono">{formatMoney(owner.finance.receitaLiquida)}</td>
              <td className="num bc-mono">{formatMoney(owner.finance.repasses)}</td>
              <td className="num bc-mono" data-negative={owner.finance.resultado < 0}>{signedMoney(owner.finance.resultado)}</td>
              <td className="num bc-mono" data-negative={owner.finance.margem != null && owner.finance.margem < 0}>{pct(owner.finance.margem)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}

      <section className="bc-analysis__section" aria-labelledby="bc-analysis-equipment">
        <div className="bc-analysis__section-head">
          <h4 id="bc-analysis-equipment">Por equipamento</h4>
          <span className="bc-note">Selecione uma linha para abrir as locações que formam o resultado.</span>
        </div>
        <div className="bc-table-wrap">
          <table className="bc-table bc-analysis__equipment-table">
            <thead><tr><th scope="col">Equipamento</th><th scope="col">Proprietário / obras</th><th scope="col" className="num">Receita líquida</th><th scope="col" className="num">Repasse</th><th scope="col" className="num">Manutenção</th><th scope="col" className="num">Resultado</th><th scope="col" className="num">Margem</th><th scope="col">Diagnóstico</th></tr></thead>
            <tbody>{analysis.equipments.map(item => <tr key={item.id} data-selected={item.id === selected?.id} data-negative={item.finance.resultado < 0}>
              <td><button type="button" className="bc-link bc-strong" onClick={() => setEquipmentId(item.id)} aria-label={`Analisar ${item.equipamento.nome}`}>{item.equipamento.nome}</button><span className="bc-note">{item.equipamento.patrimonio || item.equipamento.categoria || "Sem identificação complementar"}</span></td>
              <td>{item.owner}<span className="bc-note">{item.obras.join(" · ")}</span></td>
              <td className="num bc-mono">{formatMoney(item.finance.receitaLiquida)}</td>
              <td className="num bc-mono">{formatMoney(item.finance.repasses)}</td>
              <td className="num bc-mono">{item.finance.manutencaoApropriada ? formatMoney(item.finance.manutencao) : "—"}</td>
              <td className="num bc-mono" data-negative={item.finance.resultado < 0}>{signedMoney(item.finance.resultado)}</td>
              <td className="num bc-mono" data-negative={item.finance.margem != null && item.finance.margem < 0}>{pct(item.finance.margem)}</td>
              <td>{item.diagnosticos.length ? item.diagnosticos.map(text => <span key={text} className="bc-analysis__reason"><AlertTriangle size={12} aria-hidden="true" />{text}</span>) : <span className="bc-note">Sem alerta de margem</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      {selected && <section className="bc-analysis__section bc-analysis__rentals" aria-labelledby="bc-analysis-rentals">
        <div className="bc-analysis__section-head">
          <div><h4 id="bc-analysis-rentals">{selected.equipamento.nome}</h4><span className="bc-note">Memória das locações · resultado por locação não rateia manutenção.</span></div>
          <strong className="bc-mono" data-negative={selected.finance.resultado < 0}>{signedMoney(selected.finance.resultado)}</strong>
        </div>
        <div className="bc-table-wrap">
          <table className="bc-table">
            <thead><tr><th scope="col">Obra / período</th><th scope="col">Composição cliente</th><th scope="col" className="num">Bruto</th><th scope="col" className="num">Desconto</th><th scope="col" className="num">Líquido</th><th scope="col">Composição repasse</th><th scope="col" className="num">Repasse</th><th scope="col" className="num">Resultado</th><th scope="col" className="num">Margem</th><th scope="col"><span className="bc-sr-only">Ação</span></th></tr></thead>
            <tbody>{selected.rentals.map(rental => <tr key={rental.id} data-negative={rental.resultado < 0}>
              <td><strong>{rental.obraRotulo}</strong><span className="bc-note bc-mono">{formatDate(rental.inicio)} → {formatDate(rental.fim)} · {rental.quantidade} un · {rental.dias} dia(s)</span></td>
              <td>{rental.semTarifa ? <span className="bc-analysis__reason"><AlertTriangle size={12} aria-hidden="true" />Sem tarifa</span> : formatComposition(rental.composicao)}</td>
              <td className="num bc-mono">{formatMoney(rental.bruto)}</td>
              <td className="num bc-mono">{formatMoney(rental.descontos)}</td>
              <td className="num bc-mono">{formatMoney(rental.receita)}</td>
              <td>{rental.custoDono > 0 ? formatComposition(rental.composicaoCusto) : "—"}</td>
              <td className="num bc-mono">{formatMoney(rental.custoDono)}</td>
              <td className="num bc-mono" data-negative={rental.resultado < 0}>{signedMoney(rental.resultado)}</td>
              <td className="num bc-mono" data-negative={rental.margem != null && rental.margem < 0}>{pct(rental.margem)}</td>
              <td>{onEditRental && <Button variant="ghost" size="sm" onClick={() => onEditRental(rental.locacaoId)}>Editar <ChevronRight size={13} aria-hidden="true" /></Button>}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>}
    </aside>
  </div>;
}
