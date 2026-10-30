import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chamarPontoEletronico } from "../../../api";
import { usePontoEletronico } from "../usePontoEletronico.js";
import PontoEletronicoView from "./PontoEletronicoView.jsx";

vi.mock("../../../api", () => ({ chamarPontoEletronico: vi.fn() }));
vi.mock("../usePontoEletronico.js", () => ({ usePontoEletronico: vi.fn() }));
vi.mock("./BancoHorasView.jsx", () => ({ default: ({ obraId }) => <p>Consulta do banco de horas: {obraId}</p> }));
vi.mock("../../../LegacyApp", () => ({
  C: { green: "#2e6652", orange: "#855a24", red: "#a63b3b", muted: "#536171", blue: "#355874" },
  Ic: () => <svg aria-hidden="true" />,
  Badge: ({ children }) => <span>{children}</span>,
  Btn: ({ children, onClick, disabled, loading, ariaLabel, type = "button" }) => <button type={type} aria-label={ariaLabel} disabled={disabled || Boolean(loading)} onClick={onClick}>{loading || children}</button>,
  Inp: ({ label, value, onChange, type = "text", disabled, placeholder }) => <label><span>{label}</span><input type={type} value={value || ""} onChange={event => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} /></label>,
  Sel: ({ label, value, onChange, options, disabled }) => <label><span>{label}</span><select value={value || ""} onChange={event => onChange(event.target.value)} disabled={disabled}>{options.map(option => <option key={option.v} value={option.v}>{option.l}</option>)}</select></label>,
  Modal: ({ title, children, onClose }) => <div role="dialog" aria-label={title}><button type="button" onClick={onClose}>Fechar</button>{children}</div>,
}));

const DATA = {
  obras: [{ id: "obra-a", name: "Obra Norte" }, { id: "obra-b", name: "Obra Sul" }],
  employees: [
    { id: "ana", name: "Ana da Silva", role: "Pedreira", obra: "obra-a", active: true },
    { id: "bruno", name: "Bruno Almeida", role: "Servente", obra: "obra-a", active: true },
    { id: "caio", name: "Caio Santos", role: "Carpinteiro", obra: "obra-a", active: true },
    { id: "dora", name: "Dora Souza", role: "Pedreira", obra: "obra-b", active: true },
  ],
  usuarios: [{ id: "resp-1", nome: "Responsável Norte", role: "engenheiro", active: true }],
  terceirizados: [{ id: "terc-1", name: "Equipe de instalações" }],
};
const MARCACOES = [
  { id: "m-ana", employeeId: "ana", dispositivoId: "disp-a", tipoRegistro: "ponto", marcadoEm: "2026-10-28T10:00:00Z", recebidoEm: "2026-10-28T10:01:00Z", horaConfiavel: true, metodo: "facial", temFoto: true, nsr: 1, localSequence: 1 },
  { id: "m-bruno-1", employeeId: "bruno", dispositivoId: "disp-a", tipoRegistro: "ponto", marcadoEm: "2026-10-28T10:10:00Z", horaConfiavel: false, metodo: "encarregado", temFoto: true, nsr: 2, localSequence: 2 },
  { id: "m-bruno-2", employeeId: "bruno", dispositivoId: "disp-a", tipoRegistro: "ponto", marcadoEm: "2026-10-28T20:00:00Z", horaConfiavel: true, metodo: "facial", temFoto: false, nsr: 3, localSequence: 3 },
];
const recurso = (data, overrides = {}) => ({ data, success: true, loading: false, refreshing: false, error: "", lastUpdated: "2026-10-28T20:01:00Z", refresh: vi.fn().mockResolvedValue(undefined), ...overrides });
const dadosDoHook = (overrides = {}) => ({
  recursos: {
    dispositivos: recurso([{ id: "disp-a", nome: "Portaria Norte", status: "ativo", ultimoContatoEm: "2026-10-28T20:00:00Z", ultimaSequenciaLocal: 3 }]),
    marcacoes: recurso(MARCACOES),
    biometrias: recurso([{ employeeId: "ana", cadastradaEm: "2026-10-20T12:00:00Z", cadastradoPor: "resp-1" }]),
    responsaveis: recurso([{ userId: "resp-1", nome: "Responsável Norte", obras: [] }]),
    estabelecimentos: recurso({ estabelecimentos: [{ id: "est-a", nome: "Estabelecimento Norte", obras: ["obra-a"], ultimoNsr: 3, pendencias: [] }, { id: "est-b", nome: "Estabelecimento Sul", obras: [], ultimoNsr: 0 }], repP: { rotulo: "REP-P em testes", pendencias: ["Documentação formal pendente"] } }),
    ...overrides,
  },
  refresh: vi.fn().mockResolvedValue(undefined),
  refreshGlobais: vi.fn().mockResolvedValue(undefined),
  refreshRecurso: vi.fn().mockResolvedValue(undefined),
  carregando: false,
  ultimaAtualizacao: "2026-10-28T20:01:00Z",
});
const diferida = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
let root;
let container;
let snapshot;
const toast = vi.fn();
const renderizar = (role = "admin") => act(() => root.render(<PontoEletronicoView data={DATA} currentUser={{ id: "operador", role }} showToast={toast} />));
const botao = texto => [...container.querySelectorAll("button")].find(el => (el.getAttribute("aria-label") || el.textContent).trim() === texto);
const controle = rotulo => [...container.querySelectorAll("label")].find(el => el.querySelector("span")?.textContent === rotulo)?.querySelector("input, select");
const clicar = async elemento => { expect(elemento).toBeTruthy(); await act(async () => elemento.click()); };
const preencher = (elemento, valor) => act(() => {
  const prototype = elemento.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(elemento, valor);
  elemento.dispatchEvent(new Event(elemento.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});

beforeEach(() => {
  vi.clearAllMocks();
  snapshot = dadosDoHook();
  vi.mocked(usePontoEletronico).mockImplementation(() => snapshot);
  vi.mocked(chamarPontoEletronico).mockResolvedValue({ ok: true });
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

describe("consulta de batidas", () => {
  it("não transforma carga inicial nem falha de consulta em zero ou ausência de batida", async () => {
    snapshot = dadosDoHook({ marcacoes: recurso(null, { success: false, loading: true, lastUpdated: null }) });
    renderizar();
    expect(container.textContent).toContain("Carregando as batidas deste dia");
    expect(container.querySelector(".pe-day-totals")).toBeNull();
    expect(container.querySelector(".punch-conference__table table")).toBeNull();
    expect(container.textContent).not.toContain("Nenhum funcionário ativo lotado");
    const refresh = vi.fn();
    snapshot = dadosDoHook({ marcacoes: recurso(null, { success: false, lastUpdated: null, error: "Servidor indisponível.", refresh }) });
    renderizar();
    expect(container.textContent).toContain("Não foi possível carregar as batidas deste dia");
    expect(container.querySelector(".pe-day-totals")).toBeNull();
    await clicar(botao("Tentar novamente"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("preserva o snapshot da mesma consulta e informa a atualização que falhou", () => {
    snapshot = dadosDoHook({ marcacoes: recurso(MARCACOES, { error: "Sem conexão." }) });
    renderizar();
    expect(container.textContent).toContain("Não foi possível atualizar as batidas deste dia");
    expect(container.textContent).toContain("Exibindo a consulta de 28/10");
    expect(container.querySelector(".punch-conference__table table").textContent).toContain("Ana da Silva");
    expect(container.querySelector(".pe-day-totals").textContent).toContain("Batidas recebidas: 3");
  });

  it("filtra por pessoa e situação sem alterar as batidas; expõe nomes e legenda úteis", async () => {
    renderizar();
    expect(container.querySelector("h1").textContent).toBe("Ponto eletrônico");
    expect(container.querySelector(".punch-conference__table table caption").textContent).toContain("Obra Norte");
    expect(container.querySelectorAll('.punch-conference__table table th[scope="col"]')).toHaveLength(3);
    expect(container.querySelectorAll('.punch-conference__table table th[scope="row"]')).toHaveLength(3);
    expect(container.textContent).not.toContain("Jornada fechada");
    expect(botao("Ver batida de Ana da Silva às 07:00 em " + controle("Dia").value.split("-").reverse().join("/"))).toBeTruthy();
    preencher(controle("Situação da conferência"), "conferir");
    expect(container.querySelector(".punch-conference__table table").textContent).toContain("Bruno Almeida");
    expect(container.querySelector(".punch-conference__table table").textContent).toContain("Ana da Silva");
    expect(container.querySelector(".punch-conference__table table").textContent).not.toContain("Caio Santos");
    preencher(controle("Situação da conferência"), "sem_batida");
    expect(container.querySelector(".punch-conference__table table").textContent).toContain("Caio Santos");
    preencher(controle("Situação da conferência"), "");
    preencher(controle("Buscar funcionário"), "ANA");
    expect(container.querySelectorAll(".punch-conference__table table tbody tr")).toHaveLength(1);
    expect(container.querySelector(".punch-conference__table table").textContent).toContain("Ana da Silva");
    preencher(controle("Buscar funcionário"), "nome inexistente");
    expect(container.textContent).toContain("Nenhum funcionário encontrado para os filtros selecionados.");
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
  });

  it("navega entre abas por teclado e conserva contexto da obra", () => {
    renderizar();
    const batidas = container.querySelector("#pe-tab-batidas");
    act(() => batidas.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(container.querySelector("#pe-tab-banco").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(container.querySelector("#pe-tab-banco"));
    expect(container.querySelector("#pe-panel-banco").hidden).toBe(false);
    expect(container.querySelector("#pe-panel-batidas").hidden).toBe(true);
    expect(container.textContent).toContain("Consulta do banco de horas: obra-a");
    expect(controle("Dia")).toBeUndefined();
    act(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(container.querySelector("#pe-tab-batidas").getAttribute("aria-selected")).toBe("true");
    expect(controle("Dia")).toBeTruthy();
  });

  it("ignora a foto de um registro anterior quando outro detalhe foi aberto", async () => {
    const primeira = diferida();
    const segunda = diferida();
    vi.mocked(chamarPontoEletronico).mockImplementation((_acao, payload) => payload.marcacaoId === "m-ana" ? primeira.promise : segunda.promise);
    renderizar();
    const horarios = [...container.querySelectorAll(".punch-conference__events button")];
    await clicar(horarios.find(el => el.getAttribute("aria-label").includes("Ana da Silva")));
    await clicar(horarios.find(el => el.getAttribute("aria-label").includes("Bruno Almeida") && el.textContent.includes("07:10")));
    await act(async () => { primeira.resolve({ ok: true, url: "https://example.test/foto-ana.jpg" }); });
    expect(container.querySelector("[role=dialog]").getAttribute("aria-label")).toBe("Batida de Bruno Almeida");
    expect(container.querySelector(".pe-photo")).toBeNull();
    await act(async () => { segunda.resolve({ ok: true, url: "https://example.test/foto-bruno.jpg" }); });
    expect(container.querySelector(".pe-photo").getAttribute("src")).toBe("https://example.test/foto-bruno.jpg");
    expect(container.querySelector(".pe-photo").alt).toContain("Bruno Almeida");
  });

  it("mantém a foto mais recente quando o mesmo registro é reaberto e a consulta antiga falha depois", async () => {
    const primeira = diferida();
    const segunda = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValueOnce(primeira.promise).mockReturnValueOnce(segunda.promise);
    renderizar();
    const batida = [...container.querySelectorAll(".punch-conference__events button")].find(el => el.getAttribute("aria-label").includes("Ana da Silva"));
    await clicar(batida);
    await clicar(botao("Fechar"));
    await clicar(batida);
    await act(async () => { segunda.resolve({ ok: true, url: "https://example.test/foto-ana-atual.jpg" }); });
    expect(container.querySelector(".pe-photo").getAttribute("src")).toBe("https://example.test/foto-ana-atual.jpg");
    await act(async () => { primeira.resolve({ ok: false, error: "A consulta anterior da foto falhou." }); });
    expect(container.querySelector(".pe-photo")?.getAttribute("src")).toBe("https://example.test/foto-ana-atual.jpg");
    expect(container.querySelector("[role=dialog]").textContent).not.toContain("A consulta anterior da foto falhou.");
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
  });

  it("mantém os acessos de terceiros e os detalhes de captura acessíveis", async () => {
    snapshot = dadosDoHook({ marcacoes: recurso([...MARCACOES, { id: "acesso-1", terceiroId: "terc-1", tipoRegistro: "acesso_terceiro", marcadoEm: "2026-10-28T11:00:00Z", dispositivoId: "disp-a", localSequence: 4 }]) });
    renderizar();
    await clicar(botao("Ver acesso de Equipe de instalações às 08:00"));
    expect(container.querySelector("[role=dialog]").getAttribute("aria-label")).toBe("Acesso de Equipe de instalações");
    expect(container.querySelector("[role=dialog]").textContent).toContain("Não se aplica ao controle de acesso");
  });
});

describe("configurações com confirmação explícita", () => {
  it("só salva o estabelecimento ao confirmar e bloqueia submissões concorrentes", async () => {
    const resposta = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValue(resposta.promise);
    renderizar();
    preencher(controle("Estabelecimento desta obra"), "est-b");
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    const salvar = botao("Salvar vínculo");
    await act(async () => { salvar.click(); salvar.click(); });
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-estabelecimento-vincular-obra", { obraId: "obra-a", estabelecimentoId: "est-b" });
    expect(botao("Salvando…").disabled).toBe(true);
    await act(async () => { resposta.resolve({ ok: true }); });
    expect(snapshot.refreshGlobais).toHaveBeenCalledOnce();
  });

  it("preserva a escolha fiscal ainda não salva quando a consulta é atualizada", () => {
    renderizar();
    preencher(controle("Estabelecimento desta obra"), "est-b");
    snapshot = dadosDoHook();
    renderizar();
    expect(controle("Estabelecimento desta obra").value).toBe("est-b");
    expect(botao("Salvar vínculo").disabled).toBe(false);
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
  });

  it("não converte seleção vazia de obras em acesso global e salva Todas somente quando escolhida", async () => {
    const resposta = diferida();
    vi.mocked(chamarPontoEletronico).mockReturnValue(resposta.promise);
    renderizar();
    await clicar(botao("Definir PIN de um responsável"));
    preencher(controle("Responsável"), "resp-1");
    preencher(container.querySelector("#pe-pin"), "4567");
    const pin = container.querySelector("#pe-pin");
    expect(pin.getAttribute("inputmode")).toBe("numeric");
    expect(pin.getAttribute("autocomplete")).toBe("new-password");
    await clicar(container.querySelector('.pe-work-options input[type="checkbox"]'));
    expect(botao("Salvar PIN").disabled).toBe(true);
    expect(container.textContent).toContain("Selecione pelo menos uma obra");
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    await clicar(container.querySelector('input[name="pe-pin-scope"][value="todas"]'));
    const form = container.querySelector("[role=dialog] form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-responsavel-pin", { userId: "resp-1", pin: "4567", obras: [] });
    expect(botao("Salvando PIN…").disabled).toBe(true);
    await act(async () => { resposta.resolve({ ok: true }); });
    expect(container.querySelector("[role=dialog]")).toBeNull();
    expect(snapshot.refreshGlobais).toHaveBeenCalledOnce();
  });

  it("preserva PIN e escopo quando o servidor recusa o salvamento", async () => {
    vi.mocked(chamarPontoEletronico).mockResolvedValue({ ok: false, error: "Não foi possível conectar ao servidor." });
    renderizar();
    await clicar(botao("Trocar PIN de Responsável Norte"));
    expect(container.querySelector('input[value="todas"]').checked).toBe(true);
    preencher(container.querySelector("#pe-pin"), "4567");
    await clicar(botao("Salvar PIN"));
    expect(container.querySelector("#pe-pin").value).toBe("4567");
    expect(container.querySelector('input[value="todas"]').checked).toBe(true);
    expect(container.querySelector("[role=dialog] [role=alert]").textContent).toContain("Não foi possível conectar");
    expect(botao("Salvar PIN").disabled).toBe(false);
  });

  it("preserva confirmação de desativação e exclusão com nomes explícitos", async () => {
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderizar();
    await clicar(botao("Desativar aparelho Portaria Norte"));
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining("Portaria Norte"));
    await clicar(container.querySelector('#pe-biometria input[type="checkbox"]'));
    expect(botao("Excluir biometria de Ana da Silva")).toBeTruthy();
    await clicar(botao("Excluir biometria de Ana da Silva"));
    expect(chamarPontoEletronico).not.toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    await clicar(botao("Excluir biometria de Ana da Silva"));
    expect(chamarPontoEletronico).toHaveBeenCalledExactlyOnceWith("ponto-biometria-excluir", { employeeId: "ana" });
  });

  it("respeita papéis de gestão e fiscal sem esconder os registros de consulta", () => {
    renderizar("engenheiro");
    expect(botao("Parear aparelho")).toBeTruthy();
    expect(controle("Estabelecimento desta obra")).toBeUndefined();
    expect(botao("Novo estabelecimento")).toBeUndefined();
    renderizar("financeiro");
    expect(botao("Parear aparelho")).toBeUndefined();
    expect(botao("Definir PIN de um responsável")).toBeUndefined();
    expect(botao("Excluir biometria de Ana da Silva")).toBeUndefined();
    expect(container.querySelector(".punch-conference__table table").textContent).toContain("Ana da Silva");
  });

  it("informa expiração do pareamento e permite gerar outro código", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T20:00:00Z"));
    vi.mocked(chamarPontoEletronico).mockResolvedValue({ ok: true, codigo: "12345678", expiraEm: "2026-10-28T20:00:01Z", nome: "Portaria" });
    renderizar();
    await clicar(botao("Parear aparelho"));
    preencher(controle("Nome do aparelho"), "Portaria");
    await clicar(botao("Gerar código"));
    expect(container.querySelector("[role=dialog]").textContent).toContain("1234 5678");
    act(() => vi.advanceTimersByTime(1100));
    expect(container.querySelector("[role=dialog]").textContent).toContain("Código expirado");
    await clicar(botao("Gerar outro código"));
    expect(chamarPontoEletronico).toHaveBeenCalledTimes(2);
    expect(chamarPontoEletronico).toHaveBeenLastCalledWith("ponto-codigo-pareamento", { obraId: "obra-a", nome: "Portaria" });
  });
});
