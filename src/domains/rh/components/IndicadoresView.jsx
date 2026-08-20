// ===================================================================
// IndicadoresView — painel de indicadores do RH (achado "RH analytics"
// de docs/AUDITORIA_RH.md: o módulo não tinha nenhuma visão consolidada).
// Só leitura - nenhum dispatchCommand, nenhuma escrita. Agrega dados que já
// existem em data.employees/data.advances através dos mesmos cálculos puros
// já usados em Equipe/Rescisão (employeeLifecycleStatus, isAdvanceActive,
// employeeComplianceStatus), sem reimplementar nenhuma regra aqui.
// ===================================================================

import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { Badge, C, MiniKpi, PageHero, TYPO, fmt, fmtDateFull, today } from "../../../LegacyApp";
import {
  rhComplianceSummary,
  rhHeadcountSummary,
  rhOpenAdvancesSummary,
  rhTurnoverForMonth,
} from "../analytics";
import { employeeComplianceStatus } from "../compliance";
import { employeeLifecycleStatus } from "../employee-commands";

function Indicadores({ data }) {
  const { cols } = useBreakpoint();
  const asOf = today();
  const monthStr = asOf.slice(0, 7);
  const employees = data.employees || [];

  const headcount = rhHeadcountSummary(employees, asOf);
  const turnover = rhTurnoverForMonth(employees, monthStr);
  const advances = rhOpenAdvancesSummary(data.advances || []);
  const compliance = rhComplianceSummary(employees, asOf);

  const pendentes = employees
    .filter(e => employeeLifecycleStatus(e, asOf) === "ativo")
    .map(e => ({ employee: e, expired: employeeComplianceStatus(e, asOf).expired }))
    .filter(item => item.expired.length > 0)
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name));

  return (
    <div className="anim" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1280, margin: "0 auto" }}>
      <PageHero
        eyebrow="Recursos Humanos"
        title="Indicadores"
        description="Visão consolidada de quadro, movimentação, adiantamentos e documentação da equipe."
      />

      <div style={{ display: "grid", gridTemplateColumns: cols(2, 3, 3), gap: 8 }}>
        <MiniKpi label="Funcionários ativos" value={headcount.ativo} cor={C.blue} sub={`${headcount.total} no total`} />
        <MiniKpi label="Desligamento agendado" value={headcount.desligamento_agendado} cor={headcount.desligamento_agendado ? C.orange : C.muted} />
        <MiniKpi label="Admissões no mês" value={turnover.admissions} cor={turnover.admissions ? C.green : C.muted} />
        <MiniKpi label="Desligamentos no mês" value={turnover.terminations} cor={turnover.terminations ? C.orange : C.muted} />
        <MiniKpi label="Adiantamentos em aberto" value={fmt(advances.total)} cor={advances.total ? C.red : C.muted} sub={`${advances.count} lançamento(s)`} />
        <MiniKpi label="Documentação vencida" value={compliance.withExpiredCount} cor={compliance.withExpiredCount ? C.red : C.green} sub={`de ${compliance.activeCount} ativos`} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
        <p style={TYPO.eyebrow}>Documentos e certificações vencidos</p>
        {pendentes.length === 0 && <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Nenhum funcionário ativo com ASO ou treinamento (NR) vencido.</p>}
        {pendentes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {pendentes.map(({ employee, expired }) => (
              <div key={employee.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{employee.name}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {expired.map(label => <Badge key={label} color={C.red}>{label}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 10.5, color: C.muted }}>Indicadores calculados em {fmtDateFull(asOf)}. Custo de folha por obra ainda não entra neste painel - depende do motor de custo de mão de obra por competência (src/domains/financeiro/labor-cost-engine.js), que exige seleção de obra e período; fica para uma próxima rodada.</p>
    </div>
  );
}

export default Indicadores;
