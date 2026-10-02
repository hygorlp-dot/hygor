import { useCallback, useRef } from "react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { Drawer } from "../../../design-system/primitives/Drawer.jsx";
import { PACOTES_TARIFA, tarifasDaLocacao } from "../calculations.js";
import { isReadOnlyFor, rentalCycleNote, rentalRowActions, rentalTimeline } from "../rental-actions.js";
import { billingNote, formatMoney, rentalValueCell, RENTAL_SITUATION_LABEL, vencimentoText } from "../rental-operations.js";
import { formatDate, formatDateFull } from "../rental-period.js";
import { BillingPill, SituationPill } from "./RentalPills.jsx";

const ITEM_STATUS = { open: "Aberta", measured: "Medida", billed: "Faturada" };
const INVOICE_STATUS = { issued: "Emitida", partially_paid: "Recebida em parte", paid: "Quitada" };
const GROUPS = [
  { id: "ciclo", title: "Próximo passo do ciclo" },
  { id: "cobranca", title: "Cobrança" },
  { id: "contrato", title: "Contrato" },
];

const Field = ({ label, children, mono = false }) => (
  <div className="ro-detail__field">
    <dt>{label}</dt>
    <dd className={mono ? "ro-mono" : undefined}>{children}</dd>
  </div>
);

// Detalhe da locação, na ordem de leitura: equipamento, obra, período,
// situação, tarifa e valores, cobranças, faturas, histórico e ações. Seções
// separadas por divisores e tipografia - não por cartões. Fechar o painel
// antes de abrir um modal de ação evita dois diálogos empilhados, e o foco
// volta ao nome do equipamento na tabela.
export function RentalDetailDrawer({ row, data, user, periodoLabel, busy, returnFocusRef, onClose, onAction }) {
  // O Drawer reinicia foco e rolagem do corpo quando `onOpenChange` muda de
  // identidade; mantê-la estável evita que um novo render da tela roube o foco.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const handleOpenChange = useCallback(open => { if (!open) closeRef.current(); }, []);
  if (!row) return null;
  const equipment = (data.equipamentos || []).find(item => String(item.id) === row.equipamentoId);
  const tariffs = tarifasDaLocacao(row.rental, equipment) || {};
  const tariffText = PACOTES_TARIFA.filter(pack => Number(tariffs[pack.id] || 0) > 0).map(pack => `${formatMoney(tariffs[pack.id])}/${pack.label}`).join(" · ");
  const actions = rentalRowActions(row, user);
  const readOnly = isReadOnlyFor(row, user);
  const cycleNote = rentalCycleNote(row, user);
  const timeline = rentalTimeline(row);
  const value = rentalValueCell(row);
  const run = action => { onClose(); onAction(action, row); };
  const discount = [Number(row.rental.descontoPct || 0) > 0 ? `${row.rental.descontoPct}%` : "", Number(row.rental.descontoValor || 0) > 0 ? formatMoney(row.rental.descontoValor) : ""].filter(Boolean).join(" + ");
  const periodValue = value.kind === "valor" ? formatMoney(value.amount) : value.kind === "sem_tarifa" ? "Sem tarifa" : value.kind === "fora" ? value.note : "—";

  return (
    <Drawer open onOpenChange={handleOpenChange} triggerRef={returnFocusRef} closeLabel="Fechar detalhes"
      title={`${row.equipamentoNome}${row.quantidade > 1 ? ` · ${row.quantidade} un.` : ""}`}>
      <div className="ro-detail">
        <section aria-labelledby="ro-detail-equip">
          <h3 id="ro-detail-equip">Equipamento</h3>
          <dl>
            <Field label="Nome">{row.equipamentoNome}</Field>
            <Field label="Código" mono>{row.equipamentoCodigo || "—"}</Field>
            <Field label="Categoria">{row.categoria || "Sem categoria"}</Field>
            <Field label="Proprietário">{row.proprietarioNome}</Field>
            <Field label="Quantidade" mono>{row.quantidade} un.</Field>
            {row.unidades.length > 0 && <Field label="Unidades" mono>{row.unidades.join(", ")}</Field>}
          </dl>
        </section>

        <section aria-labelledby="ro-detail-obra">
          <h3 id="ro-detail-obra">Obra</h3>
          <dl>
            <Field label="Nome">{row.obraNome || row.obraRotulo}</Field>
            <Field label="Código" mono>{row.obraCodigo || "—"}</Field>
          </dl>
        </section>

        <section aria-labelledby="ro-detail-periodo">
          <h3 id="ro-detail-periodo">Período</h3>
          <dl>
            <Field label="Início" mono>{formatDateFull(row.inicio)}</Field>
            <Field label="Fim" mono>{row.fim ? formatDateFull(row.fim) : row.cancelada ? "Excluída" : "Em andamento"}</Field>
            {row.plannedEnd && <Field label="Término planejado" mono>{formatDateFull(row.plannedEnd)}</Field>}
            <Field label="Duração" mono>{row.diasContrato} dia(s){row.fim ? "" : " até hoje"}</Field>
          </dl>
        </section>

        <section aria-labelledby="ro-detail-situacao">
          <h3 id="ro-detail-situacao">Situação</h3>
          <dl>
            <Field label="Locação"><SituationPill row={row} /></Field>
            <Field label="Ciclo">{row.lifecycleLabel || "Sem ciclo de vida registrado"}</Field>
            <Field label="Cobrança"><BillingPill cobranca={row.cobranca} />{billingNote(row) && <span className="ro-sub ro-mono">{billingNote(row)}</span>}</Field>
            {row.vencimento && <Field label="Prazo">{vencimentoText(row.vencimento)}</Field>}
            {cycleNote && <Field label="Observação">{cycleNote}</Field>}
          </dl>
        </section>

        <section aria-labelledby="ro-detail-tarifa">
          <h3 id="ro-detail-tarifa">Tarifa e valores</h3>
          <dl>
            <Field label="Tarifa" mono>{tariffText || "Sem tarifa cadastrada"}</Field>
            {discount && <Field label="Desconto" mono>{discount}</Field>}
            <Field label={`Contratual em ${periodoLabel}`} mono>{periodValue}</Field>
            <Field label="Contratual acumulado" mono>{row.cancelada ? "—" : row.semTarifaContrato ? "Sem tarifa" : formatMoney(row.valorAcumulado)}</Field>
          </dl>
        </section>

        <section aria-labelledby="ro-detail-cobrancas">
          <h3 id="ro-detail-cobrancas">Cobranças</h3>
          {row.chargeItems.length === 0
            ? <p className="ro-detail__empty">Nenhuma linha de cobrança ou medição registrada para esta locação.</p>
            : <table className="ro-detail__table">
              <caption className="ro-sr-only">Linhas de cobrança</caption>
              <thead><tr><th scope="col">Competência</th><th scope="col">Descrição</th><th scope="col">Situação</th><th scope="col" className="ro-num">Líquido</th></tr></thead>
              <tbody>{row.chargeItems.map(item => (
                <tr key={item.id}><td className="ro-mono">{item.competence}</td><td>{item.description || "Locação"}</td><td>{ITEM_STATUS[item.status] || item.status}</td><td className="ro-num ro-mono">{formatMoney(Number(item.netAmountCents || 0) / 100)}</td></tr>
              ))}</tbody>
            </table>}
        </section>

        <section aria-labelledby="ro-detail-faturas">
          <h3 id="ro-detail-faturas">Faturas</h3>
          {row.invoices.length === 0
            ? <p className="ro-detail__empty">Nenhuma fatura emitida para esta locação.</p>
            : <table className="ro-detail__table">
              <caption className="ro-sr-only">Faturas</caption>
              <thead><tr><th scope="col">Fatura</th><th scope="col">Vencimento</th><th scope="col">Situação</th><th scope="col" className="ro-num">Saldo</th></tr></thead>
              <tbody>{row.invoices.map(invoice => (
                <tr key={invoice.id}><td className="ro-mono">{invoice.number}</td><td className="ro-mono">{formatDate(invoice.dueDate)}</td><td>{INVOICE_STATUS[invoice.status] || invoice.status}</td><td className="ro-num ro-mono">{formatMoney(Number(invoice.openAmountCents || 0) / 100)}</td></tr>
              ))}</tbody>
            </table>}
        </section>

        <section aria-labelledby="ro-detail-historico">
          <h3 id="ro-detail-historico">Histórico</h3>
          {timeline.length === 0 ? <p className="ro-detail__empty">Sem eventos registrados.</p>
            : <ol className="ro-timeline">{timeline.map((event, index) => (
              <li key={`${event.at}-${index}`}><span className="ro-mono">{formatDate(event.at)}</span><strong>{event.label}</strong>{event.detail && <small>{event.detail}</small>}</li>
            ))}</ol>}
        </section>

        <section aria-labelledby="ro-detail-acoes" className="ro-detail__actions">
          <h3 id="ro-detail-acoes">Ações</h3>
          {readOnly && <p className="ro-detail__empty">Seu perfil consulta as locações, mas não pode alterá-las.</p>}
          {!readOnly && actions.length === 0 && <p className="ro-detail__empty">Nenhuma ação disponível para a situação atual ({RENTAL_SITUATION_LABEL[row.situacao]}).</p>}
          {cycleNote && <p className="ro-detail__empty">{cycleNote}</p>}
          {GROUPS.map(group => {
            const items = actions.filter(action => action.group === group.id);
            return items.length ? <div key={group.id} role="group" aria-label={group.title}>
              <p className="ro-detail__group">{group.title}</p>
              <div className="ro-detail__buttons">{items.map(action => (
                <Button key={action.id} size="sm" variant="secondary" disabled={busy} onClick={() => run(action)}>{action.label}</Button>
              ))}</div>
            </div> : null;
          })}
          {actions.filter(action => action.danger).map(action => (
            <div key={action.id} className="ro-detail__danger">
              <p>Remove a locação da ocupação e da cobrança dos relatórios. O cancelamento fica no histórico de auditoria.</p>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => run(action)}>{action.label}…</Button>
            </div>
          ))}
        </section>
      </div>
    </Drawer>
  );
}
