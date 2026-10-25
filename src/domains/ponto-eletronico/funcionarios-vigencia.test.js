import { afterEach, describe, expect, it, vi } from "vitest";
import { funcionariosAtivos, funcionariosDaObra } from "./funcionarios.js";

const funcionarios = () => [
  { id: "piloto-k110-fulano", name: "Fulano — SIMULAÇÃO", role: "Pedreiro", obra: "piloto-k110", active: true, status: "desligamento_agendado", endDate: "2026-11-30" },
  { id: "piloto-k110-siclano", name: "Siclano — SIMULAÇÃO", role: "Ajudante", obra: "obra-teste-b", active: true, endDate: "2026-11-30" },
];
const ids = lista => lista.map(f => f.id);
const esperados = ["piloto-k110-fulano", "piloto-k110-siclano"];

afterEach(() => vi.useRealTimers());

describe("vigência do desligamento no catálogo de ponto", () => {
  it.each(["2026-10-25", "2026-11-29", "2026-11-30"])("mantém os dois funcionários até o último dia trabalhado, inclusive %s", dia => {
    expect(ids(funcionariosAtivos(funcionarios(), dia))).toEqual(esperados);
  });

  it("retira os dois no dia seguinte sem precisar de nova edição no RH", () => {
    expect(funcionariosAtivos(funcionarios(), "2026-12-01")).toEqual([]);
  });

  it("preserva as exclusões explícitas e datas de término inválidas do legado", () => {
    const [fulano] = funcionarios();
    const cadastro = [
      { ...fulano, id: "inativo", active: false },
      { ...fulano, id: "desligado", status: "DESLIGADO" },
      { ...fulano, id: "data-invalida", endDate: "2026-11-31" },
      { ...fulano, id: "sem-termino", endDate: "", status: "ativo" },
    ];
    expect(ids(funcionariosAtivos(cadastro, "2026-11-29"))).toEqual(["sem-termino"]);
  });

  it("a lotação continua sendo filtro de exibição, sem restringir o catálogo global", () => {
    expect(ids(funcionariosAtivos(funcionarios(), "2026-11-30"))).toEqual(esperados);
    expect(ids(funcionariosDaObra(funcionarios(), "piloto-k110", "2026-11-30"))).toEqual(["piloto-k110-fulano"]);
    expect(ids(funcionariosDaObra(funcionarios(), "obra-teste-b", "2026-11-30"))).toEqual(["piloto-k110-siclano"]);
    expect(funcionariosDaObra(funcionarios(), "piloto-k110", "2026-12-01")).toEqual([]);
  });

  it("o padrão usa o dia civil de Recife, incluindo a última hora após a virada UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T02:59:59.999Z"));
    expect(ids(funcionariosAtivos(funcionarios()))).toEqual(esperados);
    vi.setSystemTime(new Date("2026-12-01T03:00:00.000Z"));
    expect(funcionariosAtivos(funcionarios())).toEqual([]);
  });
});
