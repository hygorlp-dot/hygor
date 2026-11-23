import { contar } from "../../../design-system/copy.js";
import "./desktop-tv.css";

const STATUS = ["Operação regular", "Monitoramento", "Ação necessária", "Atenção crítica"];

export function DesktopTVWork({ item, photo }) {
  const progress = Math.max(0, Math.min(100, item.progresso));
  const indicators = [
    ["Diário de obra", item.diarioHoje ? "Concluído" : "Pendente", !item.diarioHoje && item.equipe > 0],
    ["Atrasos", item.atrasadas, item.atrasadas > 0],
    ["Qualidade", item.qualidade, item.qualidade > 0],
    ["Compras", item.compras, item.compras > 0],
  ];

  return (
    <article className="desktop-tv-work">
      <header>
        <div>
          <p className="desktop-tv-work__status" data-tone={item.severidade === 3 ? "critical" : item.severidade === 2 ? "warning" : undefined}>
            {STATUS[item.severidade]}
          </p>
          <h2>{item.obra.name}</h2>
          <p>{contar(item.equipe, "pessoa", "pessoas")} em campo{item.obra.engineer && ` · Eng. ${item.obra.engineer}`}</p>
        </div>
        {photo && <img key={photo.url} src={photo.url} alt={photo.legenda} onError={event => { event.currentTarget.hidden = true; }} />}
      </header>
      <div className="desktop-tv-work__progress">
        <div>
          <strong>{item.progresso}% <span>executado</span></strong>
          <span data-tone={item.desvioFisico < 0 ? "warning" : undefined}>
            {item.temPlanejamento ? `${item.planejado}% planejado` : "Sem cronograma"}
          </span>
        </div>
        <progress max={100} value={progress} aria-label={`Avanço de ${item.obra.name}`} />
      </div>
      <dl className="desktop-tv-work__stats" role="region" aria-label={`Indicadores de ${item.obra.name}`}>
        {indicators.map(([label, value, warning]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd data-tone={warning ? "warning" : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      <footer>
        <span>{item.necessidades[0] || "Sem pendências operacionais"}{item.necessidades.length > 1 && ` · +${item.necessidades.length - 1}`}</span>
        {item.prazo !== null && <span data-tone={item.prazo < 0 ? "critical" : undefined}>
          {item.prazo < 0
            ? `Prazo vencido há ${contar(-item.prazo, "dia", "dias")}`
            : item.prazo === 0 ? "Prazo vence hoje" : `${contar(item.prazo, "dia", "dias")} até o prazo`}
        </span>}
      </footer>
    </article>
  );
}
