// Registro da batida no aparelho - JavaScript puro, testável no Node.
// O app injeta: armazem (SQLite criptografado), relogio (hora confiável),
// sha256 (expo-crypto) e gerarId (UUID). As regras do formato e do
// encadeamento são as MESMAS do servidor (src/domains/ponto-eletronico).
//
// A batida é um EVENTO LOCAL (formato 2, evento.js): ganha uma sequência
// local do aparelho (1, 2, 3...) e entra na cadeia de hash do aparelho.
// NÃO tem NSR: o NSR fiscal é atribuído pela ARP no servidor, por
// estabelecimento, quando o evento chega - e fica guardado AO LADO do evento.
import { FORMATO_EVENTO, calcularHashLocal, validarEvento } from "../../../../src/domains/ponto-eletronico/evento.js";
import { gpsParaMarcacao } from "../../../../src/domains/ponto-eletronico/marcacao.js";

// A batida NUNCA é recusada por falta de internet, hora não sincronizada ou
// reconhecimento incerto (a Portaria veda restringir a marcação): nesses
// casos ela sai sinalizada (horaConfiavel=false ou metodo="encarregado").
// GPS inválido vira "sem GPS" em vez de recusar a batida. caminhoFoto é
// gravado na MESMA transação da batida: se o app fechar logo depois, a foto
// continua ligada à batida e entra na fila de envio.
// estabelecimentoId: o que o aparelho já sabe (pode ser null - a ARP resolve).
export async function registrarBatida({ armazem, relogio, sha256, gerarId, dispositivoId, estabelecimentoId = null, pessoa, identificacao, gps, fotoSha256, caminhoFoto }) {
  const hora = relogio.agora();
  return armazem.transacao(async tx => {
    const ultimo = await tx.ultimoEvento();
    const evento = {
      formatVersion: FORMATO_EVENTO,
      eventId: gerarId(),
      deviceId: dispositivoId,
      estabelecimentoId: estabelecimentoId || "",
      localSequence: Number(ultimo.localSequence || 0) + 1,
      tipoRegistro: pessoa.tipo === "terceiro" ? "acesso_terceiro" : "ponto",
      employeeId: pessoa.tipo === "terceiro" ? "" : String(pessoa.id),
      terceiroId: pessoa.tipo === "terceiro" ? String(pessoa.id) : "",
      cpf: pessoa.tipo === "terceiro" ? "" : String(pessoa.cpf || ""),
      marcadoEm: new Date(hora.marcadoEmMs).toISOString(),
      relogioAparelho: new Date(hora.relogioParedeMs).toISOString(),
      horaConfiavel: !!hora.horaConfiavel,
      relogioAlterado: !!hora.relogioAlterado,
      divergenciaMs: Number.isFinite(hora.divergenciaMs) ? Math.round(hora.divergenciaMs) : null,
      fonteHora: hora.fonteHora || "",
      idadeReferenciaMs: Number.isFinite(hora.idadeReferenciaMs) ? Math.round(hora.idadeReferenciaMs) : null,
      metodo: identificacao.metodo,
      confianca: identificacao.confianca ?? null,
      encarregadoId: identificacao.encarregadoId || "",
      gps: gpsParaMarcacao(gps),
      fotoSha256: fotoSha256 || "",
      localPreviousHash: ultimo.localHash,
    };
    evento.localHash = await calcularHashLocal(evento, sha256);
    const v = validarEvento(evento);
    if (!v.ok) throw new Error(`Batida inválida: ${v.erros.join("; ")}`);
    await tx.inserirEvento(evento, { caminhoFoto: fotoSha256 ? caminhoFoto || null : null });
    return evento;
  });
}
