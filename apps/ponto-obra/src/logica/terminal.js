// Registro da batida no aparelho - JavaScript puro, testável no Node.
// O app injeta: armazem (SQLite criptografado), relogio (hora confiável),
// sha256 (expo-crypto) e gerarId (UUID). As regras do formato e do
// encadeamento são as MESMAS do servidor (src/domains/ponto-eletronico).
import { calcularHashMarcacao, validarMarcacao } from "../../../../src/domains/ponto-eletronico/marcacao.js";

// A batida NUNCA é recusada por falta de internet, hora não sincronizada ou
// reconhecimento incerto (a Portaria veda restringir a marcação): nesses
// casos ela sai sinalizada (horaConfiavel=false ou metodo="encarregado").
export async function registrarBatida({ armazem, relogio, sha256, gerarId, dispositivoId, pessoa, identificacao, gps, fotoSha256 }) {
  const hora = relogio.agora();
  return armazem.transacao(async tx => {
    const ultimo = await tx.ultimaMarcacao();
    const marcacao = {
      id: gerarId(),
      dispositivoId,
      nsr: Number(ultimo.nsr || 0) + 1,
      tipoRegistro: pessoa.tipo === "terceiro" ? "acesso_terceiro" : "ponto",
      employeeId: pessoa.tipo === "terceiro" ? "" : String(pessoa.id),
      terceiroId: pessoa.tipo === "terceiro" ? String(pessoa.id) : "",
      cpf: pessoa.tipo === "terceiro" ? "" : String(pessoa.cpf || ""),
      marcadoEm: new Date(hora.marcadoEmMs).toISOString(),
      relogioAparelho: new Date(hora.relogioParedeMs).toISOString(),
      horaConfiavel: !!hora.horaConfiavel,
      relogioAlterado: !!hora.relogioAlterado,
      divergenciaMs: hora.divergenciaMs ?? null,
      metodo: identificacao.metodo,
      confianca: identificacao.confianca ?? null,
      encarregadoId: identificacao.encarregadoId || "",
      gps: gps || null,
      fotoSha256: fotoSha256 || "",
      hashAnterior: ultimo.hash,
    };
    marcacao.hash = await calcularHashMarcacao(marcacao, sha256);
    const v = validarMarcacao(marcacao);
    if (!v.ok) throw new Error(`Batida inválida: ${v.erros.join("; ")}`);
    await tx.inserirMarcacao(marcacao);
    return marcacao;
  });
}
