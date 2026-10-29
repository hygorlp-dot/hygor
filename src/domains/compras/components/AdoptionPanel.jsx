import { useEffect, useRef } from "react";
import { ETAPAS_ADOCAO } from "../adoption.js";
import "./adoption-panel.css";

const moeda = valor => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
const dataCurta = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const SINGULAR = { solicitacoes: "solicitação", cotacoes: "cotação", pedidos: "pedido", recebimentos: "recebimento", notas: "nota" };
const contagem = (n, etapa, label) => `${n} ${n === 1 ? SINGULAR[etapa] : label.toLowerCase()}`;
const resumoEtapas = (contagens, { comZeros = false } = {}) => ETAPAS_ADOCAO
  .filter(([etapa]) => comZeros || contagens[etapa]).map(([etapa, label]) => contagem(contagens[etapa], etapa, label)).join(" · ");
const amostra = (tempo, vazio, uma, varias) => (!tempo.amostra ? vazio : `média de ${tempo.amostra} ${tempo.amostra === 1 ? uma : varias}`);
const dias = tempo => (tempo.mediaDias == null ? "—" : `${tempo.mediaDias.toLocaleString("pt-BR")} dia${tempo.mediaDias === 1 ? "" : "s"}`);

// A0.1: se a equipe usa o fluxo de Compras. O modelo vem de painelAdocaoCompras.
export function AdoptionPanel({ model, nomeObra = id => id }) {
  const { semanas, totais, totalPorEtapa, total, porObra, obrasSemUso, autores, tempos, foraDoFluxo } = model;
  const ultima = semanas.length - 1;
  // No celular a tabela rola de lado: abre mostrando a semana atual e o total.
  const rolagem = useRef(null);
  useEffect(() => { if (rolagem.current) rolagem.current.scrollLeft = rolagem.current.scrollWidth; }, [semanas]);
  return <div className="purchase-adoption">
    <section className="purchase-adoption__tiles" aria-label="Resumo do uso nas últimas semanas">
      <div><span>Lançamentos em {semanas.length} semanas</span><b>{total}</b>
        <small>{resumoEtapas(totalPorEtapa, { comZeros: true })}</small></div>
      <div><span>Solicitação até o pedido</span><b>{dias(tempos.solicitacaoAtePedido)}</b>
        <small>{amostra(tempos.solicitacaoAtePedido, "Nenhum pedido feito a partir de solicitação", "pedido", "pedidos")}</small></div>
      <div><span>Pedido até a entrega</span><b>{dias(tempos.pedidoAteEntrega)}</b>
        <small>{amostra(tempos.pedidoAteEntrega, "Nenhuma entrega registrada", "entrega", "entregas")}</small></div>
      <div data-tone={foraDoFluxo.quantidade ? "warning" : "ok"}><span>Compras fora do fluxo</span><b>{foraDoFluxo.quantidade}</b>
        <small>{foraDoFluxo.quantidade ? `${moeda(foraDoFluxo.valor)} sem pedido` : "Tudo passou por pedido"}</small></div>
    </section>

    <section className="purchase-adoption__card" aria-labelledby="adocao-semanas">
      <header><h4 id="adocao-semanas">Lançamentos por semana</h4>
        <p>Semanas de segunda a domingo; a última é a atual, até hoje.</p></header>
      <div ref={rolagem} className="purchase-table-scroll" tabIndex={0} role="region" aria-label="Lançamentos por semana: tabela">
        <table className="purchase-adoption__table">
          <thead><tr><th scope="col">Etapa</th>
            {semanas.map((s, i) => <th key={s.inicio} scope="col" className="purchase-num" aria-label={`Semana de ${dataCurta(s.inicio)}`}>{i === ultima ? "Atual" : dataCurta(s.inicio)}</th>)}
            <th scope="col" className="purchase-num">Total</th></tr></thead>
          <tbody>{ETAPAS_ADOCAO.map(([etapa, label]) => <tr key={etapa}>
            <th scope="row">{label}</th>
            {totais[etapa].map((n, i) => <td key={semanas[i].inicio} className="purchase-num" data-zero={n === 0 || undefined}>{n}</td>)}
            <td className="purchase-num"><b>{totalPorEtapa[etapa]}</b></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    <div className="purchase-adoption__grid">
      <section className="purchase-adoption__card" aria-labelledby="adocao-obras">
        <header><h4 id="adocao-obras">Por obra</h4>
          <p>{obrasSemUso.length ? `${obrasSemUso.length} obra(s) sem nenhum lançamento no período.` : "Todas as obras lançaram algo no período."}</p></header>
        <ul className="purchase-adoption__list">{porObra.map(obra => <li key={obra.obraId} data-empty={!obra.total || undefined}>
          <div><b>{obra.nome}</b><small>{obra.total
            ? resumoEtapas(obra.etapas)
            : "Nenhum lançamento"}</small></div>
          <span>{obra.total ? `último em ${dataCurta(obra.ultima)}` : "sem uso"}</span>
        </li>)}</ul>
      </section>

      <section className="purchase-adoption__card" aria-labelledby="adocao-autores">
        <header><h4 id="adocao-autores">Quem lançou</h4>
          <p>Pessoas que registraram solicitação, cotação, pedido, recebimento ou nota.</p></header>
        {autores.length ? <ul className="purchase-adoption__list">{autores.map(autor => <li key={autor.nome}>
          <div><b>{autor.nome}</b><small>{resumoEtapas(autor)}</small></div>
          <span>{autor.total}</span>
        </li>)}</ul> : <p className="purchase-adoption__empty">Ninguém lançou nada no período.</p>}
      </section>
    </div>

    {foraDoFluxo.quantidade > 0 && <section className="purchase-adoption__card" aria-labelledby="adocao-fora">
      <header><h4 id="adocao-fora">Compras fora do fluxo</h4>
        <p>Nota de material sem pedido e despesa de material no caixa da obra sem pedido nem nota. Cada uma é uma compra que não passou por solicitação, cotação e aprovação.</p></header>
      <ul className="purchase-adoption__list">{foraDoFluxo.itens.map(item => <li key={`${item.tipo}-${item.id}`}>
        <div><b>{item.descricao}</b><small>{item.tipo === "nota" ? "Nota sem pedido" : "Caixa da obra"} · {nomeObra(item.obraId)} · {dataCurta(item.data)} · {item.autor}</small></div>
        <span>{moeda(item.valor)}</span>
      </li>)}</ul>
    </section>}
  </div>;
}
