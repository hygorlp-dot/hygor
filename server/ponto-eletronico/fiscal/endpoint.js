import { capturarSnapshotFiscal } from "./snapshot.js";
import { auditarSnapshot } from "./auditoria.js";
import { exportarSnapshot, comprovanteHtml } from "./servico.js";
import { ErroFiscal, periodo, exigir } from "./campos.js";
import { avaliarProntidaoFiscal } from "./prontidao.js";
import { emitirDocumentoFiscal } from "./emissao.js";

// Somente leitura. Dados fiscais configurados no servidor, nunca no body.
export async function consultarDocumentosFiscais({ db, companyId, usuario, body, tipo, config, agora, dadosPonto = {}, servicosAssinatura }) {
  if (!usuario || !["admin", "rh"].includes(usuario.role)) return { status: 403, json: { error: "Acesso restrito ao RH e à administração." } };
  // AFD atravessa todas as obras do estabelecimento. Usuário restrito a uma
  // obra não recebe a cadeia global: não ampliar permissões para exportar.
  if (usuario.role !== "admin" && usuario.obraId) return { status: 403, json: { error: "A exportação fiscal exige acesso ao estabelecimento completo." } };
  try {
    exigir(["auditoria", "prontidao", "afd", "aej", "comprovante"].includes(tipo), "EXPORTACAO_INVALIDA");
    if (!["auditoria", "prontidao"].includes(tipo)) periodo(body.de, body.ate);
    const snapshot = await capturarSnapshotFiscal({ db, companyId, estabelecimentoId: body.estabelecimentoId, config });
    snapshot.employees = dadosPonto.employees || [];
    snapshot.dadosPonto = dadosPonto;
    if (tipo === "auditoria") return { status: 200, json: { auditoria: await auditarSnapshot(snapshot) } };
    if (tipo === "prontidao") {
      const auditoria = await auditarSnapshot(snapshot);
      return { status: 200, json: { prontidao: avaliarProntidaoFiscal(snapshot, auditoria, { assinadorDisponivel: typeof servicosAssinatura?.assinarEValidar === "function" }), auditoria } };
    }
    if (body.assinado === true) {
      if (tipo === "comprovante" && servicosAssinatura?.recibos) {
        const event = snapshot.eventos.find(e => e.event_id === body.eventId);
        exigir(event?.employee_id, "MARCACAO_INEXISTENTE");
        const cache = await servicosAssinatura.recibos("obter", { companyId, eventId: event.event_id });
        if (cache.arquivo) {
          exigir(cache.arquivo.manifesto?.companyId === companyId && cache.arquivo.manifesto?.employeeId === event.employee_id
            && cache.arquivo.manifesto?.eventId === event.event_id, "COMPROVANTE_DIVERGENTE");
          return { status: 200, json: { arquivo: cache.arquivo } };
        }
      }
      const output = await emitirDocumentoFiscal(snapshot, { tipo, de: body.de, ate: body.ate, eventId: body.eventId, geradoEm: agora }, servicosAssinatura);
      if (tipo === "comprovante" && servicosAssinatura?.recibos) {
        await servicosAssinatura.recibos("salvar", { companyId, base64: output.bytes.toString("base64"), manifesto: output.manifesto });
      }
      return { status: 200, json: { arquivo: { nome: output.nome, mime: tipo === "comprovante" ? "application/pdf" : "text/plain;charset=ISO-8859-1", base64: output.bytes.toString("base64"), manifesto: output.manifesto,
        ...(output.assinaturaDestacada ? { assinaturaDestacada: { nome: output.assinaturaDestacada.nome, base64: output.assinaturaDestacada.bytes.toString("base64") } } : {}) } } };
    }
    const output = await exportarSnapshot(snapshot, { tipo, de: body.de, ate: body.ate, eventId: body.eventId, geradoEm: agora });
    if (output.comprovante) return { status: 200, json: { auditoria: output.auditoria, status: "rascunho_nao_assinado", html: comprovanteHtml(output.comprovante) } };
    const { bytes, ...manifest } = output.arquivo;
    return { status: 200, json: { auditoria: output.auditoria, arquivo: { ...manifest, base64: bytes.toString("base64"), mime: "text/plain;charset=ISO-8859-1" } } };
  } catch (error) {
    if (error instanceof ErroFiscal) return { status: 422, json: { error: "Não foi possível gerar o documento: " + error.codigo, codigo: error.codigo } };
    throw error;
  }
}
