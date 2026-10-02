import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Paleta validada (scripts/validate_palette.js da skill de dataviz: lightness,
// chroma, CVD, visão normal e contraste - todas PASS) com tokens do DESIGN.md:
// ouro escuro (--arcd-gold-500), laranja técnico (--arcd-orange-500) e azul
// técnico (--arcd-blue-500). Um único eixo: as três séries são reais (R$).
export const TREND_SERIES = [
  { key: "receitaLiquida", label: "Receita líquida", color: "var(--arcd-gold-500)" },
  { key: "custo", label: "Custo", color: "var(--arcd-orange-500)" },
  { key: "resultado", label: "Resultado", color: "var(--arcd-blue-500)" },
];

const compact = value => Number(value || 0).toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function TrendTooltip({ active, payload, label, formatMoney }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bc-tooltip">
      <strong>{label}</strong>
      {payload.map(item => <span key={item.dataKey}><i style={{ background: item.color }} aria-hidden="true" />{item.name}: {formatMoney(item.value)}</span>)}
    </div>
  );
}

export default function BillingTrendChart({ points, formatMoney }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid stroke="var(--arcd-border-default)" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="short" axisLine={false} tickLine={false} tick={{ fill: "var(--arcd-text-secondary)", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} width={48} tick={{ fill: "var(--arcd-text-secondary)", fontSize: 11 }} tickFormatter={compact} />
        <Tooltip cursor={{ fill: "var(--arcd-surface-muted)" }} content={<TrendTooltip formatMoney={formatMoney} />} />
        <Bar dataKey="receitaLiquida" name="Receita líquida" fill={TREND_SERIES[0].color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="custo" name="Custo" fill={TREND_SERIES[1].color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Line dataKey="resultado" name="Resultado" stroke={TREND_SERIES[2].color} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
