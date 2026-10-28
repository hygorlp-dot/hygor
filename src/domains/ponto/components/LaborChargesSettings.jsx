// Encargos e provisões que o DRE soma ao custo de mão de obra
// (financeiro/labor-charges.js). Gravado em config.laborCharges pelo comando
// de configuração da empresa, que só o administrador executa.
import { useEffect, useState } from "react";
import { Btn, Ic, Inp, Sel, uid } from "../../../LegacyApp";
import { OPERATIONAL_COMMAND } from "../../sync/operational-commands";
import { cltChargeFactor, laborChargesConfig } from "../../financeiro/labor-charges";

const pctLabel = value => `${(value * 100).toFixed(1).replace(".", ",")}%`;

export function LaborChargesSettings({ data, currentUser, dispatchCommand, showToast }) {
  const [draft, setDraft] = useState(() => laborChargesConfig(data.config));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(laborChargesConfig(data.config)), [data.config?.laborCharges]);
  const canSave = currentUser?.role === "admin";
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const preview = cltChargeFactor({ laborCharges:draft });

  const save = async () => {
    setSaving(true);
    try {
      const result = await dispatchCommand(atual => ({
        type:OPERATIONAL_COMMAND.COMPANY_CONFIG_SAVED,
        idempotencyKey:`configuracao-encargos-${uid()}`,
        expectedVersion:Number(atual.config?.version || 0),
        payload:{ config:{ ...atual.config, laborCharges:{ ...laborChargesConfig({ laborCharges:draft }), updatedAt:new Date().toISOString(), updatedBy:currentUser?.nome || currentUser?.email || "" } } },
      }));
      if (!result?.ok) throw new Error(result?.reason || "O servidor não confirmou a configuração de encargos.");
      showToast("Encargos salvos. O DRE passa a usar estes percentuais.");
    } catch (error) { showToast(error?.message || "Não foi possível salvar os encargos.", "error"); }
    finally { setSaving(false); }
  };

  const num = (label, key, extra = {}) => <Inp label={label} type="number" value={String(draft[key])} disabled={!canSave}
    onChange={v => set(key, Number(v))} {...extra}/>;

  return <section className="payroll-union" aria-labelledby="labor-charges-title">
    <header className="payroll-union__header">
      <div>
        <h3 id="labor-charges-title">Encargos e provisões no custo da obra</h3>
        <p>O DRE soma estes percentuais ao custo do dia trabalhado e do feriado. Funcionário CLT: encargos patronais, FGTS e provisões de 13º e férias. Diarista: só o percentual próprio, zero por padrão.</p>
      </div>
    </header>
    <div className="payroll-union__notice" role="note"><Ic n="alert"/><span>Padrão: Simples Nacional, Anexo IV (construção): CPP 20% + RAT × FAP, sem terceiros. Confira RAT e FAP na guia da empresa.</span></div>
    <div className="payroll-union__fields">
      {num("INSS patronal / CPP (%)", "inssPatronalPercent")}
      {num("RAT (%)", "ratPercent")}
      {num("FAP", "fap", { step:"0.01" })}
      {num("Terceiros (%)", "terceirosPercent")}
      {num("FGTS (%)", "fgtsPercent")}
      <Sel label="Reserva da multa do FGTS" value={String(draft.multaFgtsPercent)} onChange={v => set("multaFgtsPercent", Number(v))}
        options={[{ v:"40", l:"40% · dispensa sem justa causa" }, { v:"20", l:"20% · acordo" }, { v:"0", l:"Sem reserva" }]}/>
      <Sel label="Provisionar 13º e férias" value={draft.provisionar13Ferias ? "sim" : "nao"} onChange={v => set("provisionar13Ferias", v === "sim")}
        options={[{ v:"sim", l:"Sim" }, { v:"nao", l:"Não" }]}/>
      {num("Diarista / autônomo (%)", "diaristaPercent")}
    </div>
    <footer className="payroll-union__footer">
      <div><span>Custo CLT por R$ 100 de remuneração</span><strong>R$ {(100 * (1 + preview)).toFixed(2).replace(".", ",")}</strong><small>Encargos e provisões: {pctLabel(preview)}</small></div>
      {canSave
        ? <Btn v="primary" disabled={saving} onClick={save}><Ic n="check"/>{saving ? " Salvando…" : " Salvar encargos"}</Btn>
        : <small>Somente o administrador altera os encargos.</small>}
    </footer>
  </section>;
}
