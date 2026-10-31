import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  command: vi.fn(), candidates: vi.fn(), point: vi.fn(), index: vi.fn(),
}));
vi.mock("../../api", () => ({ executarComandoConciliacao: mocks.command }));
vi.mock("../../hooks/useBreakpoint", () => ({ useBreakpoint: () => ({ formGrid: () => "1fr 1fr" }) }));
vi.mock("../../domains/conciliacao/index.js", async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, criarIndicesFinanceiros: mocks.index, gerarCandidatosConciliacao: mocks.candidates,
    analisarMovimentoConciliacao: (tr, data, { indices }) => ({
      classificacaoOperacional: "revisar", elegivelLote: false,
      melhorCandidata: mocks.candidates(tr, data, indices)[0] || null,
      alternativas: mocks.candidates(tr, data, indices).slice(1),
    }),
  };
});
vi.mock("../../LegacyApp", async () => {
  const React = await import("react");
  const calculations = await import("../../domains/conciliacao/calculations.js");
  return {
    Badge: ({ children }) => <span>{children}</span>,
    Btn: ({ children, onClick, disabled, loading }) => <button type="button" onClick={onClick} disabled={disabled || loading}>{children}</button>,
    C: new Proxy({}, { get: () => "#336699" }), Ic: () => null,
    Inp: ({ label, value, onChange, type = "text", disabled, placeholder }) => <label>{label}<input type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={event => onChange?.(event.target.value)}/></label>,
    Sel: ({ label, value, onChange, options }) => <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.v} value={option.v}>{option.l}</option>)}</select></label>,
    Modal: ({ title, children }) => <section role="dialog" aria-label={title}><h2>{title}</h2>{children}</section>,
    PageHero: ({ title }) => <h1>{title}</h1>,
    TabRow: ({ tabs, onChange }) => <nav>{tabs.map(([id, label]) => <button key={id} onClick={() => onChange(id)}>{label}</button>)}</nav>,
    XLSX: {}, carregarXLSX: vi.fn(), fmt: value => `R$ ${Number(value).toFixed(2)}`, fmtDate: value => value,
    today: () => "2026-10-28", uid: () => "new-id", semAcentoConc: calculations.semAcento,
    parseBRConc: Number, chaveTransacao: vi.fn(), somaRateios: rows => rows.reduce((sum, row) => sum + row.valor, 0),
    sugerirRateio: () => null, diasEntre: () => 0, sugerirMedicoes: () => [],
    sugerirPagamentoMaoObra: mocks.point, periodoPontoDaTransacao: () => ({ days: ["2026-10-15"], periodoPonto: "2026-10-1" }),
  };
});

import Conciliacao from "./ConciliacaoView.jsx";

let root, container, update, toast;
const base = () => ({ obras: [{ id: "obra", name: "Obra Oásis" }], transacoes: [], employees: [],
  titulosFolha: [], pagamentosFolha: [], notasFiscais: [], pedidos: [], medicoes: [], medicoesTerc: [],
  terceirizados: [], attendance: {}, fornecedores: [], pagamentos: [], payments: [], extratos: [],
  contasBancarias: [], categoriasDesp: [{ v: "concreto_especial", l: "Concreto estrutural especial" }],
});
const transaction = (overrides = {}) => ({ id: "bank", valor: -300, data: "2026-10-15", descricao: "MOVIMENTO TESTE", status: "pendente", ...overrides });
const candidate = (overrides = {}) => ({ tipo: "outrasDesp", entidadeId: "expense", titulo: "Conta já cadastrada", contraparte: "Fornecedor", categoria: "energia", score: 80, motivos: [], bloqueios: [], alertas: [], saldoCentavos: 30000, podeVincular: true, ...overrides });
const mount = (data, role = "admin") => {
  if (!root) { container = document.createElement("div"); document.body.append(container); root = createRoot(container); }
  act(() => root.render(<Conciliacao data={data} update={update} showToast={toast} currentUser={{ id: "operator", role }}/>));
};
const button = (text, scope = container) => [...scope.querySelectorAll("button")].find(item => item.textContent.trim() === text);
const field = (text, scope = container) => {
  const label = [...scope.querySelectorAll("label")].find(item => item.textContent.trim().startsWith(text));
  return label?.htmlFor ? document.getElementById(label.htmlFor) : label?.querySelector("input, select");
};
const change = (element, value) => act(() => {
  const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const chooseCategory = (input, query, optionText) => {
  act(() => input.focus()); change(input, query);
  const option = [...container.querySelectorAll('[role="option"]')].find(item => item.querySelector("strong").textContent === optionText);
  expect(option).toBeTruthy(); act(() => option.click());
};
beforeEach(() => {
  mocks.command.mockReset().mockResolvedValue({ ok: true, data: {} });
  mocks.point.mockReset().mockReturnValue([]);
  mocks.index.mockReset().mockImplementation(data => ({ titles: data.titulosFolha }));
  mocks.candidates.mockReset().mockImplementation(tr => tr.candidates || []);
  update = vi.fn().mockResolvedValue({ ok: true }); toast = vi.fn();
});
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); root = null; });

it("mantém a fila ao trocar a comparação, limpa a seleção anterior e fecha ao filtrar o movimento",()=>{
  mount({...base(),transacoes:[transaction({id:"first",descricao:"Primeiro PIX"}),transaction({id:"second",descricao:"Segundo PIX"})]});
  const queue=container.querySelector(".reconciliation-queue");
  const rows=[...queue.querySelectorAll("tbody tr")];
  act(()=>button("Comparar e buscar",rows[0]).click());
  let panel=container.querySelector('[aria-label="Comparar e resolver movimento"]');
  expect(panel).toBeTruthy();expect(panel.getAttribute("role")).not.toBe("dialog");
  expect(panel.textContent).toContain("Primeiro PIX");
  change(panel.querySelector('input[aria-label="Buscar lançamentos existentes"]'),"busca anterior");
  queue.scrollTop=35;
  act(()=>button("Comparar e buscar",rows[1]).click());
  panel=container.querySelector('[aria-label="Comparar e resolver movimento"]');
  expect(panel.textContent).toContain("Segundo PIX");
  expect(panel.textContent).not.toContain("Primeiro PIX");
  expect(panel.querySelector('input[aria-label="Buscar lançamentos existentes"]').value).toBe("");
  expect(container.querySelector(".reconciliation-queue")).toBe(queue);expect(queue.scrollTop).toBe(35);
  change(container.querySelector('.reconciliation-search input'),"Primeiro PIX");
  expect(container.querySelector('[aria-label="Comparar e resolver movimento"]')).toBeNull();
  expect(mocks.command).not.toHaveBeenCalled();
});

it.each(["conciliado","parcial","falha"])("só avança para a próxima revisão após confirmação integral: %s",async status=>{
  const original={...base(),transacoes:[transaction({id:"first",descricao:"Primeiro para conferir",valor:100}),transaction({id:"second",descricao:"Segundo para conferir",valor:100})],caixaObra:[{id:"cash",tipo:"aporte",valor:100,data:"2026-10-15"}]};
  mocks.command.mockResolvedValue(status==="falha"?{ok:false,error:"Não confirmado"}:{ok:true,sections:{transacoes:original.transacoes.map(t=>t.id==="first"?{...t,status,saldoNaoVinculado:status==="parcial"?40:0}:t)}});
  update.mockImplementation(async patch=>{if(patch.__adotarServidorPatch)mount({...original,...patch.sections});return {ok:true};});
  mount(original);
  const first=[...container.querySelectorAll("tbody tr")].find(row=>row.textContent.includes("Primeiro para conferir"));
  act(()=>button("Comparar e buscar",first).click());
  const panel=container.querySelector('[aria-label="Comparar e resolver movimento"]');
  act(()=>panel.querySelector('input[type="checkbox"]').click());
  await act(async()=>button("Confirmar vínculos selecionados",panel).click());
  const current=container.querySelector('[aria-label="Comparar e resolver movimento"]');
  expect(current.textContent).toContain(status==="conciliado"?"Segundo para conferir":"Primeiro para conferir");
  expect(mocks.command).toHaveBeenCalledTimes(1);
});

it("classifica receita com busca de entrada e envia competência independente da data do extrato", async () => {
  mount({ ...base(), transacoes: [transaction({ valor: 300 })] });
  act(() => button("Validar entrada").click());
  act(() => button("Classificar por categoria / ratear entrada").click());
  const dialog = container.querySelector('[role="dialog"]');
  change(field("Vai para", dialog), "empresa");
  const input = field("Categoria de entrada", dialog);
  act(() => input.focus());
  expect(dialog.querySelector('[role="listbox"]').textContent).not.toContain("Salários administrativos");
  chooseCategory(input, "servicos", "Receita de serviços");
  expect(dialog.textContent).toContain("Nova receita no DRE por competência");
  change(field("Competência do novo", dialog), "2026-09");
  await act(async () => button("Confirmar conciliação").click());
  expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({
    type: "CONFIRM_ALLOCATION", payload: expect.objectContaining({ competence: "2026-09", allocations: [{ destination: "empresa", obraId: "", category: "receita_servicos", value: 300 }] }),
  }));
});

it("busca categoria personalizada da obra e limpa a seleção ao mudar para a empresa", () => {
  mount({ ...base(), transacoes: [transaction()] });
  act(() => button("Classificar saída").click());
  const dialog = container.querySelector('[role="dialog"]');
  change(field("Vai para", dialog), "obra"); change(field("Obra", dialog), "obra");
  chooseCategory(field("Categoria de saída", dialog), "ESTRUTURAL", "Concreto estrutural especial");
  expect(dialog.textContent).toContain("Custos da obra no DRE");
  change(field("Vai para", dialog), "empresa");
  expect(field("Categoria de saída", dialog).value).toBe("");
  expect(button("Confirmar conciliação").disabled).toBe(true);
  act(() => field("Categoria de saída", dialog).click());
  expect(dialog.querySelector('[role="listbox"]').textContent).not.toContain("Concreto estrutural especial");
});

it("prioriza o pagamento da folha existente em vez de abrir apropriação para PIX de funcionário", async () => {
  const employee = { id: "emp", name: "José Silva", pixKey: "jose@pix.example", obra: "obra" };
  const payroll = candidate({ tipo: "tituloFolha", entidadeId: "title", pagamentoId: "paid", categoria: "mao_obra", titulo: "Folha de José Silva", score: 80 });
  mocks.point.mockReturnValue([{ emp: employee, esperado: 300, divergencia: 0, diasTrabalhados: 3, motivos: ["Nome identificado"] }]);
  mount({ ...base(), employees: [employee], titulosFolha: [{ id: "title", employeeId: "emp", status: "pago" }], transacoes: [transaction({ descricao: "PIX JOSE SILVA jose@pix.example", candidates: [payroll] })] });
  expect(button("Confirmar PIX")).toBeUndefined();
  act(() => button("Vincular existente").click());
  expect(container.querySelector('[role="dialog"]').getAttribute("aria-label")).toBe("Revisar sugestão de conciliação");
  await act(async () => button("Confirmar vínculo").click());
  expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ type: "LINK_EXISTING_PAYMENT", payload: { transactionId: "bank", targetType: "tituloFolha", targetId: "title", paymentId: "paid" } }));
  expect(mocks.command.mock.calls.some(([command]) => command.type === "CONFIRM_ALLOCATION")).toBe(false);
});

it("filtra a fila por categoria sugerida e pesquisa nome da categoria sem acentos", () => {
  mount({ ...base(), transacoes: [
    transaction({ id: "salary", descricao: "PIX DA EQUIPE", candidates: [candidate({ categoria: "pessoal_admin", titulo: "Folha administrativa" })] }),
    transaction({ id: "energy", descricao: "DEBITO DA CONTA", candidates: [candidate({ categoria: "energia" })] }),
  ] });
  chooseCategory(field("Filtrar categoria"), "salarios", "Salários administrativos");
  expect(container.querySelectorAll("tr.reconciliation-row")).toHaveLength(1);
  expect(container.querySelector("tr.reconciliation-row").textContent).toContain("PIX DA EQUIPE");
  act(() => container.querySelector('button[aria-label="Limpar filtrar categoria"]').click());
  change(container.querySelector(".reconciliation-search input"), "eletrica");
  expect(container.querySelectorAll("tr.reconciliation-row")).toHaveLength(1);
  expect(container.querySelector("tr.reconciliation-row").textContent).toContain("DEBITO DA CONTA");
});

it("atualiza sugestões quando os títulos de folha mudam sem alterar o extrato", () => {
  const data = { ...base(), transacoes: [transaction()] };
  mocks.candidates.mockImplementation((tr, value, indices) => indices.titles?.length ? [candidate({ titulo: "Folha recém-fechada" })] : []);
  mount(data);
  expect(container.textContent).not.toContain("Folha recém-fechada");
  mount({ ...data, titulosFolha: [{ id: "new-title" }] });
  expect(container.textContent).toContain("Folha recém-fechada");
});

it("filtra conciliadas pela categoria do vínculo confirmado e ignora novas candidatas", () => {
  mount({ ...base(), despesasEmpresa: [{ id: "software-expense", categoria: "software", descricao: "Licença de projeto", valor: 300, pago: true }],
    transacoes: [transaction({ status: "conciliado", vinculo: { tipo: "despesasEmpresa", id: "software-expense", pagamentoId: "software-expense" }, candidates: [candidate({ categoria: "energia" })] })],
  });
  act(() => [...container.querySelectorAll("nav button")].find(item => item.textContent.startsWith("Conciliados")).click());
  chooseCategory(field("Filtrar categoria"), "softwares", "Softwares e assinaturas");
  expect(container.querySelectorAll("tr.reconciliation-row")).toHaveLength(1);
  act(() => container.querySelector('button[aria-label="Limpar filtrar categoria"]').click());
  chooseCategory(field("Filtrar categoria"), "energia", "Energia elétrica");
  expect(container.querySelectorAll("tr.reconciliation-row")).toHaveLength(0);
  expect(container.textContent).toContain("Nenhuma transação neste filtro");
});

it("o RH vincula pagamento legado do funcionário sem abrir o cartão de nova apropriação", async () => {
  const employee = { id: "emp", name: "José Silva", pixKey: "jose@pix.example", obra: "obra" };
  mocks.point.mockReturnValue([{ emp: employee, esperado: 300, divergencia: 0, diasTrabalhados: 3, motivos: [] }]);
  mount({ ...base(), employees: [employee], transacoes: [transaction({ descricao: "PIX JOSE SILVA jose@pix.example", candidates: [candidate({ tipo: "funcionario", entidadeId: "emp", pagamentoId: "legacy-paid", categoria: "mao_obra" })] })] }, "rh");
  act(() => button("Vincular existente").click());
  await act(async () => button("Confirmar vínculo").click());
  expect(mocks.command).toHaveBeenCalledWith(expect.objectContaining({ type: "LINK_EXISTING_PAYMENT", payload: expect.objectContaining({ targetType: "funcionario", paymentId: "legacy-paid" }) }));
});
