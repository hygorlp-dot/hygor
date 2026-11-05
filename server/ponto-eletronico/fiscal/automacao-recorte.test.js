import { describe, expect, it, vi } from "vitest";
vi.mock("./snapshot.js", () => ({ capturarSnapshotFiscal: vi.fn() }));
vi.mock("./endpoint.js", () => ({ consultarDocumentosFiscais: vi.fn() }));
import { capturarSnapshotFiscal } from "./snapshot.js";
import { consultarDocumentosFiscais } from "./endpoint.js";
import { executarAutomacaoFiscal } from "./acesso.js";

describe("origem do recorte de comprovantes", () => {
  it("prontidão confirma conexão real sem expor auditoria ou confundir URL com serviço disponível", async () => {
    const prontidao = { podePrepararEmissao: false, requisitos: [{ codigo: "INPI", status: "pendente" }] };
    consultarDocumentosFiscais.mockResolvedValue({ status: 200, json: { prontidao, auditoria: { origemPrivada: "não exportar" } } });
    const args = { companyId: "fixa", body: { operacao: "prontidao", estabelecimentoId: "estab", companyId: "outra" },
      servicos: { recibos: vi.fn().mockResolvedValue({ emissao: {}, envios: {} }) } };
    const response = await executarAutomacaoFiscal(args);
    expect(response.json).toEqual({ prontidao, workerConectado: false });
    expect(args.servicos.recibos).not.toHaveBeenCalled();
    args.body.verificarConexao = true;
    expect((await executarAutomacaoFiscal(args)).json).toEqual({ prontidao, workerConectado: true });
    expect(prontidao.podePrepararEmissao).toBe(false);
    args.body.verificarConexao = false;
    prontidao.podePrepararEmissao = true;
    prontidao.requisitos[0].status = "evidencia_informada";
    expect((await executarAutomacaoFiscal(args)).json).toEqual({ prontidao, workerConectado: true });
    expect(args.servicos.recibos).toHaveBeenCalledWith("situacao", { companyId: "fixa" });
    args.servicos.recibos.mockRejectedValue(Error("segredo interno"));
    expect((await executarAutomacaoFiscal(args)).json).toEqual({ prontidao, workerConectado: false });
  });
  it("fornece tipo explícito e horário original sem inferir saída do legado", async () => {
    capturarSnapshotFiscal.mockResolvedValue({ completo: true, registros: [
      { event_id: "a", nsr: 1 }, { event_id: "b", nsr: 2 }, { event_id: "c", nsr: 3 },
    ], eventos: [
      { event_id: "a", tipo_registro: "ponto", employee_id: "emp", marcado_em: "2026-11-05T21:00:00Z", payload: { versaoJornada: 1, tipoEvento: "saida" } },
      { event_id: "b", tipo_registro: "ponto", employee_id: "emp", marcado_em: "2026-11-05T12:00:00Z", payload: { tipoEvento: "saida" } },
      { event_id: "c", tipo_registro: "outro" },
    ] });
    const response = await executarAutomacaoFiscal({ companyId: "teste", body: { operacao: "listar", aposNsr: 0 } });
    expect(response.json.eventos).toEqual([
      { eventId: "a", nsr: 1, employeeId: "emp", marcadoEm: "2026-11-05T21:00:00Z", tipoEvento: "saida" },
      { eventId: "b", nsr: 2, employeeId: "emp", marcadoEm: "2026-11-05T12:00:00Z", tipoEvento: null },
    ]);
    expect(response.json.proximoNsr).toBe(3);
  });
});
