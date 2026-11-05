import { timingSafeEqual } from "node:crypto";
import { ErroFiscal, exigir } from "./campos.js";
import { capturarSnapshotFiscal } from "./snapshot.js";
import { consultarDocumentosFiscais } from "./endpoint.js";

export function autorizarAutomacao(headers, segredo) {
  if (typeof segredo !== "string" || segredo.length < 32) return false;
  const recebido = Buffer.from(String(headers.authorization || ""));
  const esperado = Buffer.from("Bearer " + segredo);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function comprovantesIndividuais({ companyId, body, servicos }) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(body.prova || "") || !["listar", "baixar"].includes(body.operacao)
    || (body.operacao === "baixar" && (typeof body.eventId !== "string" || body.eventId.length > 100))) {
    return { status: 403, json: { error: "Acesso individual inválido ou expirado. Solicite um novo acesso ao RH." } };
  }
  try {
    if (!servicos?.recibos) throw new ErroFiscal("COFRE_INDISPONIVEL");
    const result = await servicos.recibos("consultar", { companyId, prova: body.prova,
      ...(body.operacao === "listar" && body.antes ? { antes: body.antes } : {}),
      ...(body.operacao === "baixar" ? { eventId: body.eventId } : {}) });
    return { status: 200, json: result };
  } catch {
    return { status: 403, json: { error: "Acesso indisponível, inválido ou expirado. Solicite orientação ao RH." } };
  }
}

// Credencial independente, só para ler a ARP e emitir recibos. Não recebe
// empresa, papel, empregado, período ou dados fiscais do chamador.
export async function executarAutomacaoFiscal({ db, companyId, body, config, agora, dadosPonto, servicos }) {
  if (body.operacao === "prontidao") {
    const result = await consultarDocumentosFiscais({ db, companyId, usuario: { role: "admin" },
      body: { estabelecimentoId: body.estabelecimentoId }, tipo: "prontidao", config, agora,
      dadosPonto, servicosAssinatura: servicos });
    // Disponibilidade real do cofre: configurar uma URL não prova conexão.
    if (result.status !== 200) return result;
    let workerConectado = false;
    try {
      if ((body.verificarConexao === true || (result.json.prontidao?.podePrepararEmissao === true
        && result.json.prontidao.requisitos?.length > 0
        && result.json.prontidao.requisitos.every(r => r.status === "evidencia_informada"))) && servicos?.recibos) {
        const status = await servicos.recibos("situacao", { companyId });
        workerConectado = !!status && !status.error && typeof status.emissao === "object" && typeof status.envios === "object";
      }
    } catch { /* Uma queda do computador/túnel nunca libera a automação. */ }
    return { status: 200, json: { prontidao: result.json.prontidao, workerConectado } };
  }
  if (body.operacao === "emitir" && typeof body.eventId === "string") {
    return consultarDocumentosFiscais({ db, companyId, usuario: { role: "admin" },
      body: { estabelecimentoId: body.estabelecimentoId, eventId: body.eventId, assinado: true, de: "2000-01-01", ate: "2099-12-31" },
      tipo: "comprovante", config, agora, dadosPonto, servicosAssinatura: servicos });
  }
  if (body.operacao !== "listar" || !Number.isSafeInteger(body.aposNsr) || body.aposNsr < 0) {
    return { status: 400, json: { error: "Operação fiscal inválida." } };
  }
  const snapshot = await capturarSnapshotFiscal({ db, companyId, estabelecimentoId: body.estabelecimentoId, config });
  const eventos = new Map(snapshot.eventos.map(e => [e.event_id, e]));
  const registros = snapshot.registros.filter(r => Number(r.nsr) > body.aposNsr).sort((a,b) => a.nsr-b.nsr).slice(0,50);
  exigir(snapshot.completo && registros.every(r => eventos.has(r.event_id)), "EXTRACAO_CONCORRENTE_OU_INCOMPLETA");
  return { status: 200, json: { eventos: registros.filter(r => eventos.get(r.event_id)?.tipo_registro === "ponto")
    .map(r => { const e = eventos.get(r.event_id); return {
      eventId: r.event_id, nsr: Number(r.nsr), employeeId: e.employee_id, marcadoEm: e.marcado_em,
      tipoEvento: e.payload?.versaoJornada === 1 ? e.payload.tipoEvento : null,
    }; }),
    proximoNsr: registros.length ? Number(registros.at(-1).nsr) : body.aposNsr } };
}
