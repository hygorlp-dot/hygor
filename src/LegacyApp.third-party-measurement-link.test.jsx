import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

// Mesmos mocks de LegacyApp.test.jsx: os componentes shadcn não importam aqui.
vi.mock("./components/ui/button", () => ({ Button: () => null }));
vi.mock("./components/ui/input", () => ({ Input: () => null }));
vi.mock("./components/ui/label", () => ({ Label: () => null }));
vi.mock("./components/ui/card", () => ({
  Card: () => null, CardHeader: () => null, CardTitle: () => null,
  CardDescription: () => null, CardContent: () => null, CardFooter: () => null,
}));
vi.mock("./components/ui/tabs", () => ({
  Tabs: () => null, TabsList: () => null, TabsTrigger: () => null, TabsContent: () => null,
}));
vi.mock("./components/ui/alert", () => ({ Alert: () => null, AlertDescription: () => null }));

const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
let root, container;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

const data = {
  obras: [{ id: "ca106", name: "CA1-06" }],
  terceirizados: [{ id: "jh", name: "JOSÉ HENRIQUE", specialty: "eletricista", obraId: "ca106", tipoContrato: "medicao", contractValue: 6600, version: 3,
    etapas: [{ id: "inf", nome: "INFRAESTRUTURA", valor: 2900, ordem: 0 }, { id: "cab", nome: "CABEAMENTO", valor: 2900, ordem: 1 }, { id: "qdc", nome: "QDC", valor: 800, ordem: 2 }] }],
  medicoesTerc: [
    { id: "m1", tercId: "jh", data: "2026-09-01", status: "aprovada", total: 2900, itens: [{ etapaId: "inf", pctAcum: 100 }] },
    { id: "m2", tercId: "jh", data: "2026-09-20", status: "rascunho", total: 1450, itens: [{ etapaId: "cab", pctAcum: 50 }] },
  ],
};

test("a aba Medição da obra mostra os terceirizados, vincula etapa a serviço e abre a medição do contrato", async () => {
  const { TerceirosNaMedicao } = await import("./LegacyApp");
  const commands = [], abertos = [];
  const dispatchCommand = async build => { commands.push(build(data)); return { ok: true }; };
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<TerceirosNaMedicao data={data} obraId="ca106" tarefas={[{ id: "t-elet", nome: "INSTALAÇÕES ELÉTRICAS" }]}
    currentUser={{ id: "u", nome: "Eng", role: "engenheiro" }} dispatchCommand={dispatchCommand} showToast={() => {}}
    onAbrirTerceiro={(id, nova) => abertos.push([id, nova])} />));

  const text = container.textContent;
  expect(text).toContain("JOSÉ HENRIQUE");
  expect(text).toContain("43.9%");
  expect(text).toContain("1 aguardando aprovação");
  expect(text).toContain("50% enviado");

  const select = container.querySelector('select[aria-label="Serviço do planejamento para a etapa CABEAMENTO"]');
  await act(async () => { select.value = "t-elet"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(commands[0]).toMatchObject({ type: "ETAPAS_CONTRATO_TERCEIRO_SALVAS", expectedVersion: 3, payload: { contractId: "jh" } });
  expect(commands[0].payload.stages.map(s => s.tarefaId || "")).toEqual(["", "t-elet", ""]);

  await act(async () => [...container.querySelectorAll("button")].find(b => b.textContent.includes("Nova medição")).click());
  expect(abertos).toEqual([["jh", true]]);
}, 60000);

test("sem planejamento, a seção explica como ligar as etapas ao avanço físico", async () => {
  const { TerceirosNaMedicao } = await import("./LegacyApp");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<TerceirosNaMedicao data={data} obraId="ca106" tarefas={[]} currentUser={{ role: "engenheiro" }} dispatchCommand={null} />));
  expect(container.textContent).toContain("Cadastre os serviços no Planejamento");
  expect(container.querySelector("select")).toBeNull();
}, 60000);

test("fiação: boletim usa a proposta do terceirizado e a obra navega até o contrato", () => {
  const medicao = source.slice(source.indexOf("function MedicaoEvolucao("), source.indexOf("//  OBSOLETOS"));
  expect(medicao).toContain("String(propostaBoletim(t))");
  expect(medicao).toContain("pctTerceiros: avancoTerceiros.get(t.id).pct");
  expect(medicao).toContain("<TerceirosNaMedicao");
  expect(source).toContain('abrirModuloDaObra("terc")');
  expect(source).toContain("contratoInicial={terceiroAlvo}");
});
