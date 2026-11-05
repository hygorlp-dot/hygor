import { calcularHashLocal } from "../../../src/domains/ponto-eletronico/evento.js";
import { calcularHashFiscal } from "../../../src/domains/ponto-eletronico/registro-fiscal.js";
import { sha256 } from "./campos.js";
export const EMPRESA = "empresa-sintetica-local", ESTAB = "11111111-1111-4111-8111-111111111111", DEVICE = "22222222-2222-4222-8222-222222222222";
export const CPF = "52998224725";
export const empregador = { tipo: "cnpj", numero: "11222333000181", nome: "EMPRESA SINTÉTICA - SOMENTE TESTE LOCAL", timezone: "America/Recife", cno: null, caepf: null };
export const rep = { inpi: "5120269999999", desenvolvedor: { tipo: "cnpj", numero: "11222333000181" } };
export const opts = { de: "2026-11-04", ate: "2026-11-04", geradoEm: "2026-11-05T10:00:00.000Z" };
export async function snapshotFixture({ offline = true, withMode = true } = {}) {
  const eventos = [], registros = [];
  let localHash = "0".repeat(64), fiscalHash = localHash;
  const times = ["10:00", "15:00", "16:00", "20:00"], types = ["entrada", "intervalo", "retorno", "saida"];
  for (let i = 0; i < times.length; i++) {
    const eventId = "33333333-3333-4333-8333-" + String(i + 1).padStart(12, "0"), marcadoEm = "2026-11-04T" + times[i] + ":17.123Z", gravadoEm = "2026-11-04T20:10:00.000Z";
    const payload = { formatVersion: 2, eventId, deviceId: DEVICE, estabelecimentoId: ESTAB, localSequence: i + 1, localPreviousHash: localHash,
      tipoRegistro: "ponto", employeeId: "sintetico-1", cpf: CPF, marcadoEm, relogioAparelho: marcadoEm, horaConfiavel: true, relogioAlterado: false,
      fonteHora: "teste", metodo: "facial", confianca: 0.9, versaoJornada: 1, tipoEvento: types[i], ...(withMode ? { versaoCaptura: 1, offline } : {}) };
    localHash = payload.localHash = await calcularHashLocal(payload, sha256);
    const r = { estabelecimentoId: ESTAB, nsr: i + 1, eventId, tipoRegistro: "ponto", cpf: CPF, employeeId: "sintetico-1", marcadoEm, gravadoEm, deviceId: DEVICE, localSequence: i + 1, localHash, fiscalPreviousHash: fiscalHash };
    fiscalHash = await calcularHashFiscal(r, sha256);
    eventos.push({ company_id: EMPRESA, event_id: eventId, dispositivo_id: DEVICE, estabelecimento_id: ESTAB, obra_id: "obra-sintetica",
      local_sequence: i + 1, local_previous_hash: payload.localPreviousHash, local_hash: localHash, tipo_registro: "ponto", employee_id: payload.employeeId,
      cpf: CPF, marcado_em: marcadoEm, marcado_em_texto: marcadoEm, relogio_aparelho: marcadoEm, hora_confiavel: true, relogio_alterado: false,
      fonte_hora: "teste", metodo: "facial", confianca: 0.9, payload });
    registros.push({ company_id: EMPRESA, estabelecimento_id: ESTAB, event_id: eventId, dispositivo_id: DEVICE, nsr: i + 1, local_sequence: i + 1,
      gravado_em: gravadoEm, gravado_em_texto: gravadoEm, fiscal_previous_hash: r.fiscalPreviousHash, fiscal_hash: fiscalHash });
  }
  const tratamento = {
    ptrp: { nome: "PTRP SINTÉTICO", versao: "0.1.0", desenvolvedor: { tipo: "cnpj", numero: empregador.numero, nome: "DESENVOLVEDOR DE TESTE", email: "teste@example.invalid" } },
    reps: [{ id: 1, tipo: 3, inpi: rep.inpi }],
    vinculos: [{ id: 1, employeeId: "sintetico-1", cpf: CPF, nome: "PESSOA SINTÉTICA PARA TESTE LOCAL" }],
    horarios: [{ codigo: "H1", duracaoMinutos: 540, pares: [{ entrada: "0700", saida: "1200" }, { entrada: "1300", saida: "1700" }] }],
    marcacoes: eventos.map((e, i) => ({ eventId: e.event_id, vinculoId: 1, repId: 1, marcadoEm: e.marcado_em_texto, tipo: i % 2 ? "S" : "E", fonte: "O", par: i < 2 ? 1 : 2, horarioCodigo: i === 0 ? "H1" : "" })),
  };
  return { versao: 1, companyId: EMPRESA, completo: true, estabelecimento: { id: ESTAB, nome: empregador.nome, tipo_inscricao: "cnpj", numero_inscricao: empregador.numero, timezone: empregador.timezone },
    contador: { ultimo_nsr: 4, ultimo_hash_fiscal: fiscalHash }, dispositivos: [{ id: DEVICE, company_id: EMPRESA, estabelecimento_id: ESTAB, ultima_sequencia_local: 4, ultimo_hash_local: localHash }],
    eventos, registros, legados: [], employees: [{ id: "sintetico-1", name: "PESSOA SINTÉTICA PARA TESTE LOCAL" }],
    config: { rep, historicoAdministrativoCompleto: true, localPrestacao: "LOCAL SINTÉTICO - SEM VÍNCULO COM OBRA REAL", tratamento } };
}
