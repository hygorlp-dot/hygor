import { useMemo, useState } from "react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { Input } from "../../../design-system/primitives/Input.jsx";
import { PageHeader } from "../../../design-system/patterns/PageHeader.jsx";
import { FormSection } from "../../../design-system/patterns/FormSection.jsx";
import { SummaryCard } from "../../../design-system/patterns/SummaryCard.jsx";
import { FlowTabs } from "../../../features/workflow/WorkflowNavigation.jsx";
import {
  DEFAULT_MONTHLY_COST_PREMISES, calculateMonthlyCrewCost, normalizeMonthlyCostPremises,
} from "../monthly-cost-calculations";
import "./simulador-custo-mensal.css";

// Simulador da planilha "Custo mensal por trabalhador — Profissional e Servente".
// As premissas editadas ficam somente neste navegador, como na planilha original.
const STORAGE_KEY = "arcd-rh-custo-mensal-premissas-v1";

// [chave, rótulo, unidade, fonte/observação, premissa-chave a confirmar]
const GROUPS = [
  ["1. SALÁRIOS E JORNADA", [
    ["salP","Salário profissional (piso qualificado)","R$","CCT cl. 3ª, item 1.2 — vigência 01/05/2026 a 30/04/2027 (R$ 10,94/h)"],
    ["salS","Salário servente / ajudante (piso não qualificado)","R$","CCT cl. 3ª, item 1.1 — vigência 01/05/2026 a 30/04/2027 (R$ 8,23/h)"],
    ["horas","Horas mensais contratuais","h","44 h semanais (CCT cl. 39ª) — divisor 220"],
    ["dias","Dias trabalhados no mês (base para alimentação e VT)","dias","Jornada seg–sex compensando o sábado. Se trabalhar sábado, ajuste para 26",true]]],
  ["2. ENCARGOS SOBRE A FOLHA — SIMPLES NACIONAL ANEXO IV", [
    ["cpp","CPP — INSS patronal","%","Construção de edifícios é tributada no Anexo IV: a CPP NÃO está no DAS e é recolhida à parte via DCTFWeb (LC 123/06, art. 18, §5º-C e art. 13, VI)"],
    ["rat","RAT/GILRAT do CNAE 4120-4/00","%","Grau de risco 3 (Anexo V do Decreto 3.048/99)"],
    ["fap","FAP (fator multiplicador)","×","Empresa nova: FAP neutro 1,0000 até ter histórico próprio"],
    ["terc","Terceiros (Sistema S, salário-educação, INCRA)","%","Optante do Simples é dispensado, inclusive no Anexo IV (LC 123/06, art. 13, §3º)"],
    ["fgts","FGTS","%","Lei 8.036/90"],
    ["multa","Multa rescisória do FGTS","%","Dispensa sem justa causa (art. 18, §1º, Lei 8.036/90)"]]],
  ["3. ROTATIVIDADE (provisões rescisórias)", [
    ["perm","Permanência média do empregado (meses)","meses","Ciclo típico de obra. Quanto menor, maior o custo de admissão/demissão rateado por mês",true],
    ["semJusta","% de desligamentos sem justa causa (gera multa 40%)","%","Encerramento de obra/frente costuma gerar dispensa sem justa causa",true],
    ["avisoInd","% de desligamentos com aviso prévio INDENIZADO","%","O restante cumpre aviso trabalhado (custo já está no salário)",true],
    ["diasAviso","Dias de aviso prévio","dias","30 dias + 3 por ano completo (Lei 12.506/11); permanência ~1 ano = 30"]]],
  ["4. BENEFÍCIOS OBRIGATÓRIOS DA CCT", [
    ["cafe","Café da manhã — valor por dia","R$","CCT cl. 16ª, item 3 (mínimo do ticket). Se fornecer no canteiro, use seu custo real"],
    ["almoco","Almoço — valor por dia","R$","CCT cl. 17ª — R$ 14,04 é o mínimo do ticket em obra pública (item 5); usado como referência. Troque pelo preço real da quentinha + suco",true],
    ["cesta","Cesta alimentação — mensal","R$","CCT cl. 18ª — salário-base ≤ R$ 4.500; só após experiência e ≥15 dias trabalhados. Passa a R$ 90,00 em 01/05/2027"],
    ["tarifa","Tarifa de ônibus em Caruaru","R$","Tarifa única de R$ 5,00 desde 01/06/2026 (decreto municipal de 29/05/2026)"],
    ["passagens","Passagens por dia","un.","Ida e volta com uma condução. Ajuste se o empregado usar integração/duas conduções",true],
    ["descVT","Desconto máximo do VT do empregado","%","Lei 7.418/85 e CCT cl. 19ª — 6% do salário-base"],
    ["ferr","Ajuda de custo de ferramenta própria — mensal","R$","CCT cl. 23ª, item 2 — só se o profissional usar ferramenta própria por acordo"],
    ["usaFerr","Profissional usa ferramenta própria? (1 = sim, 0 = não)","0/1","Se 0, a empresa fornece as ferramentas (custo de ativo da obra, fora desta conta)",true]]],
  ["5. SAÚDE E SEGURANÇA DO TRABALHO (NR-7, NR-6, NR-18, NR-35)", [
    ["asoAdm","ASO admissional + complementares (por admissão)","R$","Clínico + audiometria, acuidade visual, ECG, glicemia, hemograma e avaliação psicossocial p/ altura. Cotar com a clínica de Caruaru",true],
    ["asoPer","ASO periódico + complementares (anual)","R$","PCMSO — periodicidade anual para construção. Estimativa",true],
    ["asoDem","ASO demissional","R$","NR-7. Dispensado se o último ASO tiver menos de 135 dias (grau de risco 3)"],
    ["trein","Treinamentos por admissão (integração NR-18 + NR-35)","R$","NR-18 admissional 4h e NR-35 8h (reciclagem bienal). Estimativa"],
    ["unif","Conjunto de uniforme (camisa de brim + calça/bermuda)","R$","CCT cl. 58ª — 2 conjuntos a cada 8 meses"],
    ["epi","EPI — custo médio mensal por trabalhador","R$","Botina, capacete, luvas, óculos, protetor auricular, filtro solar (CCT cl. 55ª e 58ª). Estimativa",true],
    ["seguro","Seguro de vida em grupo — mensal por vida","R$","Afasta a obrigação de pagar os auxílios da CCT cl. 21ª (até 8 salários por evento). Cotar",true],
    ["sst","PGR + PCMSO + eSocial SST — rateio mensal por empregado","R$","Honorário de SST rateado. Estimativa"]]],
  ["6. HORAS PRODUTIVAS", [
    ["diasAno","Dias úteis no ano (seg–sex)","dias","52 semanas × 5 dias"],
    ["diasFer","Dias úteis de férias","dias","30 dias corridos ≈ 22 dias úteis"],
    ["feriados","Feriados em dia útil no ano","dias","Nacionais + estaduais PE + municipais Caruaru. Estimativa"],
    ["folgas","Folgas remuneradas da CCT","dias","Seg. e ter. de carnaval (cl. 51ª), Dia do Trab. da Construção (cl. 50ª), véspera de Ano Novo (cl. 46ª)"],
    ["faltas","Faltas abonadas / atestados (dias/ano)","dias","Cl. 48ª e 59ª. Estimativa"],
    ["hDia","Horas por dia útil","h","44 h ÷ 5 dias"]]],
  ["7. TABELAS 2026 (visão do trabalhador)", [
    ["inss1","INSS empregado — teto 1ª faixa (7,5%)","R$","Salário mínimo 2026"],
    ["inss2","INSS empregado — teto 2ª faixa (9%)","R$","Portaria interministerial 2026"],
    ["inss3","INSS empregado — teto 3ª faixa (12%)","R$","Portaria interministerial 2026"],
    ["inss4","INSS empregado — teto (14%)","R$","Teto 2026 (também citado na CCT cl. 4ª)"],
    ["taxaAssist","Taxa assistencial (desconto do empregado)","%","CCT cl. 72ª — 2%, limitado a 2% do maior piso; empregado pode se opor"]]],
];

const NOTAS = [
  ["O QUE ESTÁ NA CONTA", [
    "Salário, encargos de folha (CPP, RAT×FAP, FGTS), provisões de 13º, férias + 1/3 e seus encargos, aviso prévio indenizado, reflexos e multa de 40% do FGTS.",
    "Todos os benefícios obrigatórios da CCT Caruaru 2026/2028: café da manhã, almoço, cesta alimentação, vale-transporte, ajuda de ferramenta (opcional).",
    "Saúde e segurança: exames admissional/periódico/demissional, treinamentos NR-18 e NR-35, uniformes, EPIs, seguro de vida, PGR/PCMSO."]],
  ["O QUE FICOU DE FORA (adicione se aplicável)", [
    "DAS do Simples sobre o faturamento — é tributo sobre receita, não sobre a folha.",
    "Horas extras (70% nas duas primeiras de seg–sáb; 100% a partir da 3ª, domingos e feriados — cl. 39ª), adicional noturno, insalubridade/periculosidade.",
    "Alojamento (cl. 54ª), transporte próprio em obra sem linha regular (cl. 19ª §3º), retorno quinzenal de quem mora em outra cidade (cl. 19ª §1º).",
    "Ferramentas e equipamentos fornecidos pela empresa, contabilidade/DP, sistema de ponto, contribuição sindical patronal.",
    "Estabilidades (gestante, CIPA, acidentado) e passivos trabalhistas eventuais."]],
  ["PONTOS PARA CONFIRMAR COM O CONTADOR", [
    "Enquadramento no Anexo IV: construção de edifícios e obras de engenharia (inclusive administração de obra) recolhe a CPP fora do DAS. É o que torna a folha pesada mesmo no Simples.",
    "Sem Terceiros: o Simples dispensa Sistema S, salário-educação e INCRA mesmo no Anexo IV — confirme na DCTFWeb que o FPAS/código de terceiros está zerado.",
    "Desoneração (CPRB) está em reoneração gradual até 2027; verifique se há alguma vantagem aplicável ao Anexo IV antes de optar.",
    "FAP: empresa nova usa 1,0000; a partir do histórico próprio, pode subir ou cair (0,5 a 2,0).",
    "Cesta: não é devida no contrato de experiência; no servente o experimento máximo é 60 dias (cl. 24ª). Nos primeiros meses o custo real fica um pouco menor."]],
  ["DATAS DA CCT QUE MUDAM A CONTA", [
    "01/05/2027: cesta passa a R$ 90,00; pisos, café, almoço e ferramenta serão renegociados (cl. 83ª).",
    "Fevereiro/2027: taxa negocial de 3% (desconto do empregado, com oposição de 08 a 17/01/2027).",
    "Outubro (3ª segunda-feira): Dia do Trabalhador da Construção Civil — paralisação remunerada obrigatória."]],
];

const TABS = ["Custo Mensal", "Premissas", "Caixa Mensal", "Visão do Trabalhador", "Notas"];

const brl = n => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
const pct = n => (Number.isFinite(n) ? n * 100 : 0).toLocaleString("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 }) + "%";
const mult = n => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 }) + "×";

const loadPremises = () => {
  try { return normalizeMonthlyCostPremises(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
  catch { return { ...DEFAULT_MONTHLY_COST_PREMISES }; }
};
const savePremises = premises => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(premises)); } catch { /* armazenamento indisponível */ } };

// Tabela por tipo de linha: seção, item, subtotal, reserva e total.
function CostTable({ caption, headers, rows, valueColumns }) {
  return (
    <div className="rh-custo__table-wrap">
      <table className="rh-custo__table">
        <caption className="rh-custo__sr-only">{caption}</caption>
        <thead>
          <tr>{headers.map((h, i) => <th key={h} scope="col" data-numeric={i > 0 && i <= valueColumns ? "true" : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => r.kind === "sec" ? (
            <tr key={idx} data-kind="sec"><th scope="colgroup" colSpan={headers.length}>{r.label}</th></tr>
          ) : (
            <tr key={idx} data-kind={r.kind}>
              <th scope="row">{r.label}</th>
              {r.values.map((v, i) => <td key={i} data-numeric="true">{v}</td>)}
              <td className="rh-custo__note">{r.note || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SimuladorCustoMensal() {
  const [tab, setTab] = useState(TABS[0]);
  const [premises, setPremises] = useState(loadPremises);
  const [draft, setDraft] = useState({});
  const result = useMemo(() => calculateMonthlyCrewCost(premises), [premises]);
  const { professional:a, helper:b, crew:d, indicators:ind, premises:P } = result;

  const setPremise = (key, unit, text) => {
    const value = parseFloat(String(text).replace(",", "."));
    setDraft(current => ({ ...current, [key]:text }));
    if (!Number.isFinite(value)) return;
    setPremises(current => {
      const next = { ...current, [key]:unit === "%" ? value / 100 : value };
      savePremises(next);
      return next;
    });
  };
  const reset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* armazenamento indisponível */ }
    setPremises({ ...DEFAULT_MONTHLY_COST_PREMISES });
    setDraft({});
  };

  const row = (kind, label, key, note) => ({ kind, label, note, values:key ? [brl(a[key]), brl(b[key]), brl(d[key])] : [] });
  const sec = label => ({ kind:"sec", label });
  const indRow = (label, values, format, note, kind = "item") => ({ kind, label, note, values:[format(values.professional), format(values.helper), format(values.crew)] });

  const custoRows = [
    sec("A. REMUNERAÇÃO"), row("item", "Salário base", "s", "Piso CCT cl. 3ª (inclui DSR)"),
    sec("B. ENCARGOS MENSAIS SOBRE A FOLHA"),
    row("item", `INSS patronal — CPP ${pct(P.cpp)}`, "cpp", "Fora do DAS no Anexo IV — DCTFWeb, vencimento dia 20"),
    row("item", "RAT × FAP", "rat", `${pct(P.rat)} × ${P.fap.toLocaleString("pt-BR", { minimumFractionDigits:4 })}`),
    row("item", "Terceiros", "terc", "Zero no Simples"),
    row("item", `FGTS ${pct(P.fgts)}`, "fgts", "Guia FGTS Digital, vencimento dia 20"),
    row("sub", "Subtotal B", "B"),
    sec("C. PROVISÕES (13º, FÉRIAS E RESCISÃO)"),
    row("item", "13º salário (1/12)", "d13", "Pago em 2 parcelas (nov/dez) e na rescisão"),
    row("item", "Férias + 1/3 (1/12 × 4/3)", "fer", "Inclui o terço constitucional"),
    row("item", "Encargos sobre 13º e férias (CPP + RAT + FGTS)", "encProv", "INSS patronal incide no 1/3 de férias gozadas (STF Tema 985)"),
    row("item", "Aviso prévio indenizado", "aviso", "Salário × prob. de aviso indenizado ÷ permanência"),
    row("item", "FGTS sobre aviso indenizado", "fgtsAviso", "Sem INSS patronal (natureza indenizatória — STJ Tema 478)"),
    row("item", "13º e férias sobre a projeção do aviso", "proj", "Aviso indenizado projeta mais 1/12 de 13º e férias"),
    row("item", "Multa 40% do FGTS", "multa", "40% sobre todo o FGTS depositado × % sem justa causa"),
    row("sub", "Subtotal C", "C"),
    sec("D. BENEFÍCIOS DA CCT"),
    row("item", "Café da manhã", "cafe", "Cl. 16ª — sem natureza salarial"),
    row("item", "Almoço (quentinha/self-service + suco)", "almoco", "Cl. 17ª — sem natureza salarial"),
    row("item", "Cesta alimentação", "cesta", "Cl. 18ª — sem natureza salarial (art. 457, §2º CLT)"),
    row("item", "Vale-transporte (custo líquido do empregador)", "vt", "Custo das passagens − desconto de 6% do empregado"),
    row("item", "Ajuda de custo — ferramenta própria", "ferr", "Cl. 23ª — só profissional com ferramenta própria"),
    row("sub", "Subtotal D", "D"),
    sec("E. SAÚDE E SEGURANÇA DO TRABALHO"),
    row("item", "Exames ocupacionais (ASO adm. + dem. rateados + periódico)", "aso", "NR-7 / PCMSO"),
    row("item", "Treinamentos NR-18 e NR-35 (rateados)", "trein", "Por admissão, rateado pela permanência"),
    row("item", "Uniformes", "unif", "Cl. 58ª — 2 conjuntos a cada 8 meses"),
    row("item", "EPIs", "epi", "NR-6 e cl. 55ª"),
    row("item", "Seguro de vida em grupo", "seguro", "Substitui o auxílio da cl. 21ª"),
    row("item", "PGR / PCMSO / eSocial SST (rateio)", "sst", "NR-1 e NR-7"),
    row("sub", "Subtotal E", "E"),
    row("tot", "CUSTO TOTAL MENSAL", "total", "A + B + C + D + E"),
    { kind:"sub", label:"Custo total anual (× 12)", values:[brl(a.total * 12), brl(b.total * 12), brl(d.total * 12)] },
    sec("INDICADORES"),
    indRow("Multiplicador sobre o salário", ind.multiplier, mult, "Custo total ÷ salário base"),
    indRow("Encargos + provisões (B + C) sobre o salário", ind.chargesOnSalary, pct, "Equivale ao 'percentual de encargos sociais' de orçamento"),
    indRow(`Custo por hora paga (÷ ${P.horas} h)`, ind.costPerPaidHour, brl),
    indRow("Horas efetivamente trabalhadas por mês", ind.productiveHours, brl, "Desconta férias, feriados, folgas da CCT e faltas abonadas"),
    indRow("Custo por hora PRODUTIVA", ind.costPerProductiveHour, brl, "Use este valor para compor preço unitário de serviço (Dupla = custo da equipe por hora)", "tot"),
  ];
  const caixaRows = [
    row("item", "Salário líquido + descontos repassados (folha bruta)", "s", "5º dia útil; adiantamento quinzenal"),
    row("item", "INSS patronal + RAT (DCTFWeb)", "inssRat", "Dia 20 do mês seguinte"),
    row("item", "FGTS mensal", "fgts", "Dia 20 do mês seguinte"),
    row("item", "Benefícios CCT (café, almoço, cesta, VT, ferramenta)", "D", "Conforme fornecedor"),
    row("item", "SST (EPI, uniformes, exames, seguro, PGR)", "E", "Conforme fornecedor"),
    row("sub", "Desembolso mensal típico", "des"),
    row("res", "Reservar por mês (provisões — subtotal C)", "C", "Sugestão: transferir para conta separada no dia do pagamento"),
    row("tot", "Custo econômico total (confere com Custo Mensal)", "eco"),
  ];
  const worker = (kind, label, key, note) => ({ kind, label, note, values:[brl(a[key]), brl(b[key])] });
  const trabRows = [
    worker("item", "Salário bruto", "s"),
    worker("item", "(−) INSS do empregado (tabela progressiva 2026)", "inssEmp", "7,5% / 9% / 12% / 14% por faixa"),
    worker("item", `(−) Vale-transporte (${pct(P.descVT)})`, "vtEmp", "Limitado ao valor das passagens"),
    worker("item", `(−) Taxa assistencial (${pct(P.taxaAssist)})`, "taxa", "CCT cl. 72ª — sujeita a oposição do empregado"),
    worker("item", "(−) IRRF", "irrf", "Isento: renda até R$ 5.000/mês desde 2026"),
    worker("tot", "Salário líquido", "liq", "Mais café, almoço e cesta in natura"),
  ];

  return (
    <div className="rh-custo">
      <PageHeader
        title="Custo mensal por trabalhador — Profissional e Servente"
        description="Marcell Engenharia Ltda · CCT Caruaru 2026/2028 · Simples Nacional Anexo IV"
        secondaryActions={<Button variant="secondary" onClick={reset}>Restaurar premissas</Button>}
      />
      <div className="rh-custo__kpis">
        <SummaryCard label="Custo total da dupla / mês" value={`R$ ${brl(d.total)}`} />
        <SummaryCard label="Multiplicador" value={mult(ind.multiplier.crew)} />
        <SummaryCard label="Dupla / hora produtiva" value={`R$ ${brl(ind.costPerProductiveHour.crew)}`} tone="primary" />
      </div>

      <FlowTabs label="Seções do simulador" steps={TABS.map(label => ({ id:label, label }))} active={tab} onChange={setTab} />

      {tab === "Custo Mensal" && (
        <section aria-label="Custo Mensal" className="rh-custo__section">
          <p className="rh-custo__intro">Valores por mês, com provisões rateadas. Edite as premissas na aba Premissas.</p>
          <CostTable caption="Custo mensal por trabalhador" headers={["Item", "Profissional", "Servente", "Dupla", "Base de cálculo / fundamento"]} rows={custoRows} valueColumns={3} />
        </section>
      )}

      {tab === "Premissas" && (
        <section aria-label="Premissas" className="rh-custo__section">
          <p className="rh-custo__intro">CCT 2026/2028 Sinduscon-PE × Sintracon Caruaru (PE000665/2026) · Simples Nacional desde 03/11/2026 · CNAE 41.20-4-00. Alterações recalculam todas as abas e ficam salvas neste navegador. Campos marcados com “Confirmar” devem ser conferidos com seus números reais.</p>
          {GROUPS.map(([title, items]) => (
            <FormSection key={title} title={title}>
              <div className="rh-custo__premises">
                {items.map(([key, label, unit, note, isKey]) => {
                  const raw = draft[key] ?? String(+(unit === "%" ? P[key] * 100 : P[key]).toFixed(6));
                  return (
                    <Input key={key} type="number" step="any" inputMode="decimal" value={raw}
                      label={`${label} (${unit})`} description={isKey ? `Confirmar com números reais. ${note}` : note}
                      fieldClassName={isKey ? "rh-custo__premise rh-custo__premise--key" : "rh-custo__premise"}
                      onChange={event => setPremise(key, unit, event.target.value)} />
                  );
                })}
              </div>
            </FormSection>
          ))}
        </section>
      )}

      {tab === "Caixa Mensal" && (
        <section aria-label="Caixa Mensal" className="rh-custo__section">
          <h2 className="rh-custo__title">O que sai do caixa num mês normal (sem provisões)</h2>
          <p className="rh-custo__intro">Provisões não saem todo mês: viram 13º em nov/dez, férias e rescisões. Esta aba mostra o desembolso típico e quanto reservar.</p>
          <CostTable caption="Caixa mensal" headers={["Item", "Profissional", "Servente", "Dupla", "Vencimento"]} rows={caixaRows} valueColumns={3} />
        </section>
      )}

      {tab === "Visão do Trabalhador" && (
        <section aria-label="Visão do Trabalhador" className="rh-custo__section">
          <h2 className="rh-custo__title">Contracheque estimado (o que o trabalhador recebe)</h2>
          <p className="rh-custo__intro">Não é custo da empresa — serve para conferir a folha e explicar o líquido ao empregado.</p>
          <CostTable caption="Contracheque estimado" headers={["Item", "Profissional", "Servente", "Observação"]} rows={trabRows} valueColumns={2} />
          <p className="rh-custo__intro">Em fevereiro de 2027 há ainda a taxa negocial de 3% (CCT cl. 73ª), também sujeita a oposição.</p>
        </section>
      )}

      {tab === "Notas" && (
        <section aria-label="Notas" className="rh-custo__notes">
          {NOTAS.map(([title, items]) => (
            <FormSection key={title} title={title}>
              <ul className="rh-custo__list">{items.map(item => <li key={item}>{item}</li>)}</ul>
            </FormSection>
          ))}
        </section>
      )}
    </div>
  );
}
