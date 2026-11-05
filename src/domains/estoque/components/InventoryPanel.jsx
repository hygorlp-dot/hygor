import { useMemo, useState } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Input } from "../../../design-system/primitives/Input";
import { fmt, fmtDate, today } from "../../../legacy/format.js";
import { calcSaldos, saldoDe } from "../calculations";
import { INVENTORY_STATUS, inventarioPendenteDaObra, linhasDoInventario, precisaAprovacao, resumoDoInventario } from "../inventory";
import { limiteAprovacaoEngenheiro } from "../../compras/purchase-approval";

const STATUS = {
  [INVENTORY_STATUS.APLICADO]: { label: "Aplicado", tone: "success" },
  [INVENTORY_STATUS.AGUARDANDO]: { label: "Aguardando o Administrador", tone: "warning" },
  [INVENTORY_STATUS.REJEITADO]: { label: "Recusado", tone: "danger" },
};
const qtd = valor => Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

// E1.2: contagem física da obra. O servidor recalcula o saldo e decide se a
// diferença aplica direto ou espera o Administrador (mesma alçada das compras).
export function InventoryPanel({ data, obraId, nomeObra, materiais, currentUser, onSubmit, onDecide, busy }) {
  const [contagens, setContagens] = useState({});
  const [motivo, setMotivo] = useState("");
  const [quando, setQuando] = useState(today());
  const saldos = useMemo(() => calcSaldos(data.movEstoque), [data.movEstoque]);
  const movimentou = useMemo(() => new Set((data.movEstoque || []).filter(m => m.obraId === obraId).map(m => m.materialId)), [data.movEstoque, obraId]);
  const itens = useMemo(() => materiais.filter(m => movimentou.has(m.id) || saldoDe(saldos, obraId, m.id) !== 0)
    .sort((a, b) => String(a.descricao).localeCompare(String(b.descricao), "pt-BR")), [materiais, movimentou, saldos, obraId]);
  const preenchidas = Object.entries(contagens).filter(([, valor]) => String(valor).trim() !== "")
    .map(([materialId, valor]) => ({ materialId, contado: Number(String(valor).replace(",", ".")) }));
  const linhas = linhasDoInventario(data, obraId, preenchidas);
  const resumo = resumoDoInventario(linhas);
  const vaiParaAdmin = resumo.itensComDiferenca > 0 && precisaAprovacao(data, resumo, currentUser?.role);
  const pendente = inventarioPendenteDaObra(data, obraId);
  const historico = (data.inventarios || []).filter(i => i.obraId === obraId).sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
  const nomeMaterial = id => materiais.find(m => m.id === id)?.descricao || "Material";
  const unidade = id => materiais.find(m => m.id === id)?.unidade || "";

  const registrar = async () => {
    const ok = await onSubmit({ obraId, data: quando, motivo, contagens: preenchidas });
    if (ok) { setContagens({}); setMotivo(""); }
  };

  return <div className="stock-inventory">
    {pendente && <section className="stock-inventory__pending" aria-label="Contagem aguardando decisão">
      <h3>Contagem de {fmtDate(pendente.data)} aguardando o Administrador</h3>
      <p>{pendente.itensComDiferenca === 1 ? "1 material" : `${pendente.itensComDiferenca} materiais`} com diferença · faltas {fmt(pendente.valorFaltas)} · sobras {fmt(pendente.valorSobras)} · por {pendente.criadoPor || "—"}. Motivo: {pendente.motivo}</p>
      <ul>{pendente.linhas.filter(l => Math.abs(l.diferenca) > 1e-6).map(l => <li key={l.materialId}>
        <b>{nomeMaterial(l.materialId)}</b> · sistema {qtd(l.saldoSistema)} · contado {qtd(l.contado)} · <span data-tone={l.diferenca < 0 ? "danger" : "success"}>{l.diferenca > 0 ? "+" : ""}{qtd(l.diferenca)} {unidade(l.materialId)}</span>
      </li>)}</ul>
      {currentUser?.role === "admin" && <div className="stock-inventory__actions">
        <Button variant="secondary" disabled={busy} onClick={() => { const m = window.prompt("Motivo da recusa:"); if (String(m || "").trim()) onDecide(pendente.id, false, m.trim()); }}>Recusar</Button>
        <Button disabled={busy} onClick={() => onDecide(pendente.id, true, "")}>Aprovar e ajustar o estoque</Button>
      </div>}
    </section>}

    {!pendente && <section className="stock-inventory__count" aria-label={`Contagem de ${nomeObra}`}>
      <header><h3>Contar o estoque de {nomeObra}</h3>
        <p>Preencha só o que contou. O sistema compara com o saldo e ajusta. Diferenças acima de {fmt(limiteAprovacaoEngenheiro(data))} vão para o Administrador.</p></header>
      {itens.length ? <div className="stock-inventory__scroll" tabIndex={0} role="region" aria-label="Materiais para contar">
        <table className="stock-inventory__table">
          <thead><tr><th scope="col">Material</th><th scope="col" className="num">No sistema</th><th scope="col">Contado</th><th scope="col" className="num">Diferença</th></tr></thead>
          <tbody>{itens.map(m => {
            const linha = linhas.find(l => l.materialId === m.id);
            return <tr key={m.id}>
              <th scope="row">{m.descricao}<small>{m.unidade}</small></th>
              <td className="num">{qtd(saldoDe(saldos, obraId, m.id))}</td>
              <td><Input type="number" min="0" inputMode="decimal" aria-label={`Quantidade contada de ${m.descricao}`} value={contagens[m.id] ?? ""}
                onChange={e => setContagens(c => ({ ...c, [m.id]: e.target.value }))}/></td>
              <td className="num" data-tone={linha && linha.diferenca < 0 ? "danger" : linha && linha.diferenca > 0 ? "success" : undefined}>
                {linha ? `${linha.diferenca > 0 ? "+" : ""}${qtd(linha.diferenca)}` : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <p className="stock-inventory__empty">Nenhum material passou por esta obra ainda.</p>}
      <div className="stock-inventory__form">
        <Input type="date" label="Data da contagem" value={quando} onChange={e => setQuando(e.target.value)}/>
        <Input label={resumo.itensComDiferenca ? "Motivo das diferenças *" : "Observação"} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: contagem mensal do almoxarifado"/>
      </div>
      <p className="stock-inventory__summary" role="status" data-tone={vaiParaAdmin ? "warning" : undefined}>
        {!preenchidas.length ? "Nenhuma quantidade informada." : resumo.itensComDiferenca
          ? `${resumo.itensComDiferenca === 1 ? "1 material" : `${resumo.itensComDiferenca} materiais`} com diferença · faltas ${fmt(resumo.valorFaltas)} · sobras ${fmt(resumo.valorSobras)}${vaiParaAdmin ? " · vai para aprovação do Administrador" : " · ajusta o estoque ao registrar"}`
          : "Contagem bate com o sistema."}
      </p>
      <Button disabled={busy || !preenchidas.length} onClick={registrar}>Registrar contagem</Button>
    </section>}

    {historico.length > 0 && <section className="stock-inventory__history" aria-label="Contagens anteriores">
      <h3>Contagens anteriores</h3>
      <ul>{historico.slice(0, 12).map(i => <li key={i.id}>
        <div><b>{fmtDate(i.data)} · {i.itensComDiferenca ? `${i.itensComDiferenca} com diferença` : "sem diferença"}</b>
          <small>faltas {fmt(i.valorFaltas)} · sobras {fmt(i.valorSobras)} · {i.criadoPor || "—"}{i.motivoDecisao ? ` · recusa: ${i.motivoDecisao}` : ""}</small></div>
        <span className="stock-inventory__chip" data-tone={STATUS[i.status]?.tone}>{STATUS[i.status]?.label || i.status}</span>
      </li>)}</ul>
    </section>}
  </div>;
}
