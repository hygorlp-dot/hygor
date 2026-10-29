import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chamarPontoEletronico } from "../../../api.js";
import BancoHorasView from "./BancoHorasView.jsx";

// Modelo e hook reais: só a fronteira da API e a apresentação compartilhada
// são substituídas. Os funcionários e horários abaixo são inteiramente sintéticos.
vi.mock("../../../api.js", () => ({ chamarPontoEletronico: vi.fn() }));
vi.mock("../../../LegacyApp", () => ({
  C: { blue: "#355874", muted: "#536171", line: "#d3dce3" },
  Ic: () => <svg aria-hidden="true" />,
  Btn: ({ children, onClick, disabled, loading, type = "button" }) => <button type={type} onClick={onClick} disabled={disabled || Boolean(loading)}>{loading || children}</button>,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  // Expõe os dados recebidos, sem recalculá-los. Os botões simulam somente
  // o evento documentado do gráfico, para verificar a abertura do detalhe.
  LineChart: ({ data, children, onClick }) => <div data-testid="grafico-saldo" data-series={JSON.stringify(data)}>
    {data.map(ponto => <button key={ponto.data} type="button" aria-label={`Selecionar ponto ${ponto.data}`}
      onClick={() => onClick({ activePayload: [{ payload: ponto }] })}>{ponto.data}</button>)}{children}
  </div>,
  Line: ({ connectNulls }) => <span data-testid="linha-saldo" data-connect-nulls={String(connectNulls)} />,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const HOJE = "2026-10-28";
const DIA = "2026-10-05";
const DATA = {
  obras: [{ id: "obra-a", name: "Obra Sintética A" }, { id: "obra-b", name: "Obra Sintética B" }],
  employees: [
    { id: "alfa", name: "Pessoa Alfa", role: "Operação sintética", obra: "obra-a", workdayHours: 8 },
    { id: "transferida", name: "Pessoa Transferida", role: "Função sintética", obra: "obra-b", workdayHours: 8 },
    { id: "pendente", name: "Pessoa Pendente", role: "Função sintética", obra: "obra-a", workdayHours: 8 },
    { id: "sem-registro", name: "Pessoa Sem Registro", role: "Função sintética", obra: "obra-a", workdayHours: 8 },
    { id: "debito", name: "Pessoa Débito", role: "Função sintética", obra: "obra-a", workdayHours: 8 },
    { id: "externa", name: "Pessoa Externa", role: "Função sintética", obra: "obra-b", workdayHours: 8 },
  ],
};
const batida = (employeeId, hora, { data = DIA, obraId = "obra-a", ...extras } = {}) => ({
  id: `${employeeId}-${data}-${hora}`, eventId: `${employeeId}-${data}-${hora}`, employeeId,
  tipoRegistro: "ponto", obraId, obraCapturaId: obraId, marcadoEm: `${data}T${hora}:00-03:00`,
  horaConfiavel: true, relogioAlterado: false, metodo: "facial", ...extras,
});
const MARCACOES = [
  ...["07:00", "11:00", "12:00", "17:30"].map(h => batida("alfa", h)),
  ...["07:00", "14:30"].map(h => batida("alfa", h, { data: "2026-10-06" })),
  batida("transferida", "07:00"), batida("transferida", "11:00"),
  batida("transferida", "12:00", { obraId: "obra-b" }), batida("transferida", "17:00", { obraId: "obra-b" }),
  ...["07:00", "11:00", "12:00"].map(h => batida("pendente", h)),
  ...["07:00", "14:00"].map(h => batida("debito", h)),
  ...["07:00", "16:00"].map(h => batida("externa", h, { obraId: "obra-b" })),
];
const resposta = extras => ({ ok: true, marcacoes: MARCACOES, apropriacoes: [], cobertura: { completa: true }, ...extras });
const diferida = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

let root, container;
const renderizar = (extras = {}) => act(async () => root.render(<BancoHorasView data={DATA} obraId="obra-a" currentUser={{ id: "operador-sintetico", role: "rh" }} dia={HOJE} {...extras} />));
const controle = rotulo => [...container.querySelectorAll("label")].find(label => label.querySelector("span")?.textContent === rotulo)?.querySelector("input, select");
const botao = nome => [...container.querySelectorAll("button")].find(button => (button.getAttribute("aria-label") || button.textContent).trim() === nome);
const clicar = async elemento => {
  expect(elemento).toBeTruthy();
  await act(async () => elemento.click());
};
const preencher = async (elemento, valor) => {
  expect(elemento).toBeTruthy();
  await act(async () => {
    const prototype = elemento.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(elemento, valor);
    elemento.dispatchEvent(new Event(elemento.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
};
const concluir = (consulta, valor) => act(async () => { consulta.resolve(valor); });
const consultar = () => act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
const editarPeriodo = async (de, ate) => {
  await preencher(controle("Início do período"), de);
  await preencher(controle("Fim do período"), ate);
};
const tabelaEquipe = () => container.querySelector('[aria-label="Tabela de saldo por funcionário"] table');
const tabelaDias = () => container.querySelector('[aria-label="Tabela de dias do banco de horas"] table');
const nomesEquipe = () => [...(tabelaEquipe()?.querySelectorAll("tbody th button") || [])].map(b => b.textContent);
const linhaEquipe = nome => [...(tabelaEquipe()?.querySelectorAll("tbody tr") || [])].find(tr => tr.querySelector("th button")?.textContent === nome);
const celulas = tr => [...tr.querySelectorAll("td")].map(td => td.textContent);
const totais = () => [...container.querySelectorAll(".bh-totais dd")].map(dd => dd.textContent);
const detalhe = () => container.querySelector(".bh-detalhe-dia");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${HOJE}T12:00:00Z`));
  vi.mocked(chamarPontoEletronico).mockReset();
  vi.mocked(chamarPontoEletronico).mockResolvedValue(resposta());
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BancoHorasView: consulta e cobertura", () => {
  it("distingue carga e erro de ausência de dados, e só mostra os resultados após sucesso", async () => {
    const primeira = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValueOnce(primeira.promise);
    await renderizar();
    expect(container.textContent).toContain("Consultando registros e intervalos do período");
    expect(container.querySelector('.bh-resultados[aria-busy="true"]')).toBeTruthy();
    expect(tabelaEquipe()).toBeNull();
    expect(totais()).toEqual([]);
    await concluir(primeira, { ok: false, error: "Falha sintética de conexão." });
    expect(container.querySelector('[role="alert"]').textContent).toContain("Não foi possível consultar o banco de horas.");
    expect(container.textContent).toContain("Falha sintética de conexão.");
    expect(tabelaEquipe()).toBeNull();
    expect(totais()).toEqual([]);
    vi.mocked(chamarPontoEletronico).mockResolvedValueOnce(resposta({ marcacoes: [] }));
    await clicar(botao("Tentar novamente"));
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(totais()).toEqual(["—", "—", "—", "0"]);
    expect(celulas(linhaEquipe("Pessoa Sem Registro"))).toEqual(["8h00", "—", "—", "0 dia(s) · sem registros"]);
    expect(container.textContent).toContain("sem registro, sem débito");
  });

  it("recusa resposta sem confirmação de cobertura e mantém saldo indisponível quando a cobertura é parcial", async () => {
    vi.mocked(chamarPontoEletronico).mockResolvedValueOnce({ ok: true, marcacoes: [], apropriacoes: [] });
    await renderizar();
    expect(container.querySelector('[role="alert"]').textContent).toContain("não confirmou a cobertura do período");
    expect(totais()).toEqual([]);
    vi.mocked(chamarPontoEletronico).mockResolvedValueOnce(resposta({ cobertura: { completa: false } }));
    await clicar(botao("Tentar novamente"));
    expect(container.textContent).toContain("A cobertura da consulta está incompleta");
    expect(totais().slice(0, 3)).toEqual(["—", "—", "—"]);
    expect(celulas(linhaEquipe("Pessoa Alfa"))[2]).toBe("—");
  });

  it("consulta todas as obras, inclui transferidos na equipe e desconta a jornada uma vez por pessoa/dia", async () => {
    await renderizar();
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-banco-horas", { de: "2026-10-01", ate: HOJE });
    expect(nomesEquipe()).toEqual(["Pessoa Alfa", "Pessoa Débito", "Pessoa Pendente", "Pessoa Sem Registro", "Pessoa Transferida"]);
    expect(celulas(linhaEquipe("Pessoa Transferida"))).toEqual(["8h00", "9h00", "+1h00", "1 dia(s)"]);
    expect(celulas(linhaEquipe("Pessoa Alfa"))).toEqual(["8h00", "17h00", "+1h00", "2 dia(s)"]);
    expect(totais()).toEqual(["+1h00", "2h30", "1h30", "1"]);
    await preencher(controle("Equipe"), "todos");
    expect(nomesEquipe()).toContain("Pessoa Externa");
    expect(totais()[0]).toBe("+2h00");
    expect(chamarPontoEletronico).toHaveBeenCalledOnce();
    await preencher(controle("Equipe"), "obra");
    await renderizar({ obraId: "obra-b" });
    expect(nomesEquipe()).toEqual(["Pessoa Externa", "Pessoa Transferida"]);
    expect(chamarPontoEletronico).toHaveBeenCalledOnce();
  });

  it("mantém o período publicado durante a edição e limpa o snapshot antigo ao consultar novas datas", async () => {
    await renderizar();
    const segunda = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValueOnce(segunda.promise);
    await editarPeriodo("2026-10-05", "2026-10-07");
    expect(chamarPontoEletronico).toHaveBeenCalledOnce();
    expect(container.querySelector(".bh-periodo-atual").textContent).toBe("01/10/2026 a 28/10/2026");
    expect(container.textContent).toContain("Período em edição. Os resultados abaixo continuam de 01/10/2026 a 28/10/2026 até consultar.");
    expect(totais()[0]).toBe("+1h00");
    await consultar();
    expect(chamarPontoEletronico).toHaveBeenLastCalledWith("ponto-banco-horas", { de: "2026-10-05", ate: "2026-10-07" });
    expect(container.querySelector(".bh-periodo-atual").textContent).toBe("05/10/2026 a 07/10/2026");
    expect(tabelaEquipe()).toBeNull();
    expect(totais()).toEqual([]);
    await concluir(segunda, resposta({ marcacoes: [batida("alfa", "07:00"), batida("alfa", "15:00")] }));
    expect(totais()[0]).toBe("0h00");
    expect(celulas(linhaEquipe("Pessoa Alfa"))).toEqual(["8h00", "8h00", "0h00", "1 dia(s)"]);
    expect(container.textContent).not.toContain("Período em edição");
  });

  it("impede período invertido ou acima de 62 dias sem abandonar o resultado já publicado", async () => {
    await renderizar();
    await editarPeriodo("2026-10-07", "2026-10-05");
    await consultar();
    expect(container.querySelector('#bh-erro-periodo[role="alert"]').textContent).toContain("anterior ou igual ao fim");
    expect(controle("Início do período").getAttribute("aria-invalid")).toBe("true");
    await editarPeriodo("2026-07-01", "2026-10-28");
    await consultar();
    expect(container.querySelector("#bh-erro-periodo").textContent).toContain("até 62 dias");
    expect(chamarPontoEletronico).toHaveBeenCalledOnce();
    expect(container.querySelector(".bh-periodo-atual").textContent).toBe("01/10/2026 a 28/10/2026");
    expect(totais()[0]).toBe("+1h00");
  });

  it("não reapresenta resposta de outro período que termina depois da consulta mais recente", async () => {
    await renderizar();
    const setembro = diferida(), agosto = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValueOnce(setembro.promise).mockReturnValueOnce(agosto.promise);
    await editarPeriodo("2026-09-01", "2026-09-30");
    await consultar();
    await editarPeriodo("2026-08-01", "2026-08-31");
    await consultar();
    expect(tabelaEquipe()).toBeNull();
    await concluir(agosto, resposta({ marcacoes: [batida("alfa", "07:00", { data: "2026-08-05" }), batida("alfa", "18:00", { data: "2026-08-05" })] }));
    expect(totais()[0]).toBe("+3h00");
    await concluir(setembro, resposta({ marcacoes: [batida("alfa", "07:00", { data: "2026-09-05" }), batida("alfa", "08:00", { data: "2026-09-05" })] }));
    expect(container.querySelector(".bh-periodo-atual").textContent).toBe("01/08/2026 a 31/08/2026");
    expect(totais()[0]).toBe("+3h00");
    expect(celulas(linhaEquipe("Pessoa Alfa"))[1]).toBe("11h00");
    expect(container.textContent).not.toContain("−7h00");
  });

  it("preserva apenas o último sucesso do mesmo período quando uma atualização falha", async () => {
    await renderizar();
    const atualizacao = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValueOnce(atualizacao.promise);
    await consultar();
    expect(totais()[0]).toBe("+1h00");
    expect(container.querySelector('.bh-resultados[aria-busy="true"]')).toBeTruthy();
    await concluir(atualizacao, { ok: false, error: "Falha sintética na atualização." });
    expect(container.querySelector('[role="alert"]').textContent).toContain("A atualização não foi concluída.");
    expect(container.textContent).toContain("Exibindo a última consulta concluída deste mesmo período.");
    expect(totais()[0]).toBe("+1h00");
    vi.mocked(chamarPontoEletronico).mockResolvedValueOnce(resposta({ marcacoes: [] }));
    await clicar(botao("Tentar novamente"));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(totais()[0]).toBe("—");
  });
});

describe("BancoHorasView: exploração do saldo", () => {
  it("filtra busca e situação sem refazer consultas, incluindo pendências sem saldo", async () => {
    await renderizar();
    await preencher(controle("Situação do saldo"), "credito");
    expect(nomesEquipe()).toEqual(["Pessoa Alfa", "Pessoa Transferida"]);
    expect(totais()[0]).toBe("+2h00");
    await preencher(controle("Situação do saldo"), "debito");
    expect(nomesEquipe()).toEqual(["Pessoa Débito"]);
    expect(totais()[0]).toBe("−1h00");
    await preencher(controle("Situação do saldo"), "pendentes");
    expect(nomesEquipe()).toEqual(["Pessoa Pendente"]);
    expect(totais()).toEqual(["—", "—", "—", "1"]);
    await preencher(controle("Situação do saldo"), "todos");
    await preencher(controle("Buscar funcionário"), "OPERACAO");
    expect(nomesEquipe()).toEqual(["Pessoa Alfa"]);
    await preencher(controle("Buscar funcionário"), "nao-existe-na-fixture");
    expect(nomesEquipe()).toEqual([]);
    expect(container.textContent).toContain("Nenhum funcionário corresponde aos filtros");
    expect(chamarPontoEletronico).toHaveBeenCalledOnce();
  });

  it("abre extrato, evolução com lacunas e conferência diária tanto pela tabela quanto pelo gráfico", async () => {
    await renderizar();
    await clicar(botao("Ver extrato de Pessoa Alfa"));
    expect(container.querySelector("#bh-extrato-titulo").textContent).toBe("Extrato de Pessoa Alfa");
    expect(document.activeElement).toBe(container.querySelector("#bh-extrato-titulo"));
    expect(container.textContent).toContain("Jornada diária: 8h00 · cadastro do funcionário.");
    expect(container.querySelector('[aria-label="Resumo do funcionário no período"]')).toBeTruthy();
    expect(totais()).toEqual(["+1h00", "1h30", "0h30", "0"]);
    expect(tabelaDias().querySelectorAll("tbody tr")).toHaveLength(2);
    expect(celulas(tabelaDias().querySelector("tbody tr"))).toEqual(["9h30", "8h00", "+1h30", "+1h30", "Pelas batidas"]);
    const serie = JSON.parse(container.querySelector('[data-testid="grafico-saldo"]').dataset.series);
    expect(serie.find(p => p.data === "2026-10-05")).toEqual({ data: "2026-10-05", saldo: 90, variacao: 90 });
    expect(serie.find(p => p.data === "2026-10-06")).toEqual({ data: "2026-10-06", saldo: 60, variacao: -30 });
    expect(serie.find(p => p.data === "2026-10-07")).toEqual({ data: "2026-10-07", saldo: null, variacao: null });
    expect(container.querySelector('[data-testid="linha-saldo"]').dataset.connectNulls).toBe("false");
    await clicar(botao("Conferir dia 05/10/2026 de Pessoa Alfa"));
    expect(detalhe().textContent).toContain("Conferência de 05/10/2026");
    expect(document.activeElement).toBe(detalhe().querySelector("h4"));
    expect(detalhe().textContent).toContain("07:00 → 11:00");
    expect(detalhe().textContent).toContain("12:00 → 17:30");
    expect(detalhe().textContent).toContain("Obra Sintética A");
    expect(detalhe().textContent).toContain("Apurado: 9h30 · Jornada considerada: 8h00 · Variação: +1h30");
    await clicar(botao("Selecionar ponto 2026-10-06"));
    expect(detalhe().textContent).toContain("Conferência de 06/10/2026");
    expect(document.activeElement).toBe(detalhe().querySelector("h4"));
    expect(detalhe().textContent).toContain("Variação: −0h30");
    expect(botao("Conferir dia 06/10/2026 de Pessoa Alfa").getAttribute("aria-pressed")).toBe("true");
    expect(botao("Conferir dia 05/10/2026 de Pessoa Alfa").getAttribute("aria-pressed")).toBe("false");
    await clicar(botao("Conferir dia 06/10/2026 de Pessoa Alfa"));
    expect(detalhe()).toBeNull();
    await clicar(container.querySelector(".bh-calculo summary"));
    expect(container.querySelector(".bh-calculo").open).toBe(true);
    expect(container.querySelector(".bh-calculo").textContent).toContain("A jornada é descontada uma vez por funcionário e dia");
    expect(container.querySelector(".bh-calculo").textContent).toContain("não inclui saldo anterior, compensações");
    await clicar(botao("Voltar para a equipe"));
    expect(tabelaEquipe()).toBeTruthy();
    expect(tabelaDias()).toBeNull();
  });

  it("mostra dia sem registro como ausência de cálculo, sem inventar débito ou gráfico zerado", async () => {
    await renderizar();
    await preencher(controle("Funcionário"), "sem-registro");
    expect(totais()).toEqual(["—", "—", "—", "0"]);
    expect(container.querySelector('[data-testid="grafico-saldo"]')).toBeNull();
    expect(container.textContent).toContain("A evolução aparece quando houver pelo menos um dia");
    expect(tabelaDias().querySelectorAll("tbody tr")).toHaveLength(0);
    await preencher(controle("Exibir dias"), "todos");
    expect(tabelaDias().querySelectorAll("tbody tr")).toHaveLength(28);
    expect(celulas(tabelaDias().querySelector("tbody tr"))).toEqual(["—", "—", "—", "—", "Sem registro · sem débito"]);
    await clicar(botao("Conferir dia 05/10/2026 de Pessoa Sem Registro"));
    expect(detalhe().textContent).toContain("Nenhum registro recebido nesta data.");
    expect(detalhe().textContent).not.toContain("Variação:");
    expect(container.textContent).not.toContain("−8h00");
  });

  it("filtra os dias pendentes e explica por que horas observadas ficaram fora do saldo", async () => {
    await renderizar();
    await preencher(controle("Situação do saldo"), "pendentes");
    await clicar(botao("Ver extrato de Pessoa Pendente"));
    await preencher(controle("Exibir dias"), "todos");
    expect(tabelaDias().querySelectorAll("tbody tr")).toHaveLength(28);
    await preencher(controle("Exibir dias"), "pendentes");
    expect(tabelaDias().querySelectorAll("tbody tr")).toHaveLength(1);
    expect(celulas(tabelaDias().querySelector("tbody tr"))).toEqual(["4h00", "8h00", "—", "—", "A conferir · fora do saldo"]);
    await clicar(botao("Conferir dia 05/10/2026 de Pessoa Pendente"));
    expect(detalhe().textContent).toContain("Há batida sem saída");
    expect(detalhe().textContent).toContain("Este dia está fora do saldo até a conferência dos horários.");
    expect(detalhe().textContent).not.toContain("Variação:");
    await preencher(controle("Funcionário"), "alfa");
    await preencher(controle("Exibir dias"), "pendentes");
    expect(tabelaDias().querySelectorAll("tbody tr")).toHaveLength(0);
    expect(container.textContent).toContain("Nenhum dia pendente neste período.");
    expect(detalhe()).toBeNull();
  });

  it("identifica intervalos tratados no extrato e mostra as obras corretas no detalhe", async () => {
    vi.mocked(chamarPontoEletronico).mockResolvedValueOnce(resposta({ apropriacoes: [
      { id: "tratado-a", employeeId: "transferida", data: DIA, inicio: `${DIA}T07:00:00-03:00`, fim: `${DIA}T11:00:00-03:00`, obraApropriadaId: "obra-a", status: "ativa", origem: "manual" },
      { id: "tratado-b", employeeId: "transferida", data: DIA, inicio: `${DIA}T12:00:00-03:00`, fim: `${DIA}T16:00:00-03:00`, obraApropriadaId: "obra-b", status: "ativa", origem: "manual" },
    ] }));
    await renderizar();
    await clicar(botao("Ver extrato de Pessoa Transferida"));
    expect(celulas(tabelaDias().querySelector("tbody tr"))).toEqual(["8h00", "8h00", "0h00", "0h00", "Intervalos tratados"]);
    await clicar(botao("Conferir dia 05/10/2026 de Pessoa Transferida"));
    expect(detalhe().textContent).toContain("Base: intervalos tratados.");
    expect([...detalhe().querySelectorAll(".bh-intervalos li")].map(li => li.textContent)).toEqual([
      "07:00 → 11:00Obra Sintética A4h00", "12:00 → 16:00Obra Sintética B4h00",
    ]);
    expect(detalhe().textContent).toContain("Batidas recebidas: 07:00 · 11:00 · 12:00 · 17:00.");
    expect(detalhe().textContent).toContain("Apurado: 8h00 · Jornada considerada: 8h00 · Variação: 0h00");
  });
});
