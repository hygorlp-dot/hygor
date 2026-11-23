import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GestaoAVistaObras from "./GestaoAVistaObras.jsx";

let root, container;
const onAbrirObra = vi.fn();
const linha = over => ({ id: "o1", nome: "P1-08", motivo: "Custo 8 pontos à frente do avanço", situacao: "critico",
  orcado: 100000, custo: 58000, gastoPct: 58, avanco: 50, avancoFonte: "medicao", desvio: 8,
  etapas: [{ id: "t1", nome: "Fundação", estado: "feita", peso: 25 }, { id: "t2", nome: "Estrutura", estado: "atual", peso: 75 }],
  etapaAtual: "Estrutura", entrega: "2026-11-15", diasEntrega: 16, equipeHoje: 4, pendenciasPonto: 0, ...over });
const resumo = {
  linhas: [linha(), linha({ id: "o2", nome: "CA1-06", situacao: "ok", motivo: "Sem pendências", orcado: null, gastoPct: null,
    desvio: null, etapas: [], etapaAtual: null, entrega: null, diasEntrega: null, equipeHoje: 0 })],
  contagem: { critico: 1, atencao: 0, ok: 1 }, equipeHoje: 4, custoAte: "2026-09",
};
const nomes = () => [...container.querySelectorAll(".gav-obra__nome")].map(b => b.textContent);
const placar = rotulo => [...container.querySelectorAll(".gav-placar__item")].find(b => b.textContent.includes(rotulo));

beforeEach(async () => {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<GestaoAVistaObras resumo={resumo} hoje="2026-10-30" onAbrirObra={onAbrirObra} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); onAbrirObra.mockClear(); });

it("mostra situação com texto, custo × avanço e entrega de cada obra", () => {
  expect(nomes()).toEqual(["P1-08", "CA1-06"]);
  expect(container.querySelector(".gav__sub").textContent).toBe("30/10/2026 · 4 pessoas em campo · custo até 09/2026");
  const primeira = container.querySelectorAll(".gav-linha:not(.gav-linha--cabecalho)")[0];
  expect(primeira.querySelector(".gav-chip").textContent).toBe("Crítico");
  expect(primeira.querySelector(".gav-custo__barra").getAttribute("aria-label")).toBe("Gasto 58% do orçado, executado 50%");
  expect(primeira.querySelector(".gav-custo__gasto").className).toContain("is-alerta");
  expect(primeira.textContent).toContain("em 16 dias");
  const segunda = container.querySelectorAll(".gav-linha:not(.gav-linha--cabecalho)")[1];
  expect(segunda.textContent).toContain("Sem orçamento aprovado");
  expect(segunda.textContent).toContain("Sem data de entrega");
  expect(segunda.textContent).toContain("Sem cronograma");
});

it("o placar filtra e um segundo clique volta a mostrar todas", async () => {
  await act(async () => placar("Crítico").click());
  expect(placar("Crítico").getAttribute("aria-pressed")).toBe("true");
  expect(nomes()).toEqual(["P1-08"]);
  await act(async () => placar("Atenção").click());
  expect(nomes()).toEqual([]);
  expect(container.textContent).toContain("Nenhuma obra em “Atenção”.");
  await act(async () => placar("Atenção").click());
  expect(nomes()).toEqual(["P1-08", "CA1-06"]);
});

it('busca por nome sem acento e mantém o filtro de situação', async () => {
  const comAcento={...resumo,linhas:[resumo.linhas[0],{...resumo.linhas[1],nome:'Edifício São José'}]};
  await act(async () => root.render(<GestaoAVistaObras resumo={comAcento} hoje="2026-10-30" onAbrirObra={onAbrirObra}/>));
  const busca=container.querySelector('input[type="search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(busca,' SAO JOSE ');
    busca.dispatchEvent(new Event('input',{bubbles:true}));
  });
  expect(nomes()).toEqual(['Edifício São José']);
  await act(async () => placar('Crítico').click());
  expect(nomes()).toEqual([]);
  expect(container.textContent).toContain('Nenhuma obra encontrada com os filtros atuais.');
});

it("abre a obra pelo nome", async () => {
  await act(async () => container.querySelector(".gav-obra__nome").click());
  expect(onAbrirObra).toHaveBeenCalledWith("o1");
});

it('expande apenas a obra acionada e controla os três indicadores técnicos', async () => {
  const controles = [...container.querySelectorAll('.gav-details-toggle button')];
  expect(controles.every(button=>button.getAttribute('aria-expanded')==='false')).toBe(true);
  await act(async () => controles[0].click());
  expect(controles.map(button=>button.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
  for (const id of controles[0].getAttribute('aria-controls').split(' ')) {
    expect(document.getElementById(id).closest('.gav-linha').dataset.detailsOpen).toBe('true');
  }
  await act(async () => controles[0].click());
  expect(controles[0].getAttribute('aria-expanded')).toBe('false');
});

it("sem acesso à DRE não desenha barra de custo e avisa que a situação ignora o custo", async () => {
  await act(async () => root.render(<GestaoAVistaObras resumo={resumo} hoje="2026-10-30" custoStatus="sem-acesso" />));
  expect(container.querySelector(".gav-custo__barra")).toBeNull();
  expect(container.textContent).toContain("Custo visível só para quem acessa a DRE");
  expect(container.querySelector(".gav__sub").textContent).not.toContain("custo até");
  expect(container.querySelector(".gav__legenda").textContent).toContain("Sem o custo, a situação considera só prazo e ponto.");
});

it("obra sem custo calculado nunca aparece como gasto 0%", async () => {
  const semCusto = { ...resumo, linhas: [linha({ custo: null, gastoPct: null, desvio: null, situacao: "ok" })] };
  await act(async () => root.render(<GestaoAVistaObras resumo={semCusto} hoje="2026-10-30" />));
  expect(container.querySelector(".gav-custo__barra")).toBeNull();
  // O avanço físico escrito na etapa ("Estrutura · 50%") é outra informação: só esse elemento sai da conferência,
  // e todo o resto da tela continua proibido de mostrar "0%" (custo zerado).
  const semEtapa=container.cloneNode(true);
  semEtapa.querySelectorAll(".gav-etapas__nome").forEach(el=>el.remove());
  expect(semEtapa.textContent).not.toContain("0%");
  expect(container.textContent).toContain("Custo não calculado (obra sem data de início)");
});

it("troca o ponto e o diário por obra sem mudar o progresso do desafio", async () => {
  const data = {
    employees: [{ id:'a', obra:'o1' }, { id:'b', obra:'o2' }],
    attendance: { a:{ '2026-10-30':'P', '2026-10-29':'F' }, b:{ '2026-10-30':'F' } },
    rdos: [{ obraId:'o1', data:'2026-10-30', status:'concluido' },{ id:'rascunho-o2',obraId:'o2',data:'2026-10-30',status:'preparacao' }],
  };
  const abrirDiario=vi.fn();
  await act(async () => root.render(<GestaoAVistaObras resumo={resumo} hoje="2026-10-30" data={data}
    onAbrirDiario={abrirDiario} diaryWorks={[{ id:'o1' }, { id:'o2' }]} showAttendance showDiaries />));
  const first = container.querySelectorAll('.gav-linha')[1];
  expect(first.querySelector('.gav-ponto').textContent).toBe('1 presença0 faltas');
  expect(first.querySelector('.gav-diario').textContent).toContain('Concluído');
  expect(first.querySelector('.gav-diario button')).toBeNull();
  await act(async ()=>container.querySelectorAll('.gav-linha')[2].querySelector('.gav-diario button').click());
  expect(abrirDiario).toHaveBeenLastCalledWith('o2','2026-10-30','rascunho-o2');
  await act(async () => [...container.querySelectorAll('.gav-periodo button')].find(el => el.textContent==='Ontem').click());
  expect(first.querySelector('.gav-ponto').textContent).toBe('0 presenças1 falta');
  expect(first.querySelector('.gav-diario').textContent).toContain('Sem diário');
  expect(first.querySelector('.gav-diario').textContent).toContain('1/5 · Faltam 2 dias para o marco de 3');
  await act(async ()=>first.querySelector('.gav-diario button').click());
  expect(abrirDiario).toHaveBeenLastCalledWith('o1','2026-10-29',undefined);
});
