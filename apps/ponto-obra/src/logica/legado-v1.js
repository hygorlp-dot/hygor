// COMPATIBILIDADE - eventos do FORMATO 1 (versões do app anteriores à
// separação sequência local / NSR fiscal, ver docs/REP-P-MIGRACAO-NSR.md).
//
// Um aparelho atualizado pode ainda ter batidas antigas não enviadas,
// gravadas com "nsr" por aparelho e o hash do formato 1. Elas NÃO são
// convertidas nem renumeradas (o conteúdo assinado não muda): vão pelo
// caminho legado do servidor (ponto_marcacoes, sem NSR fiscal).
//
// O antigo "realinhamento" (renumerar pendentes quando o servidor tinha outra
// cadeia) foi REMOVIDO: se o topo do servidor não conferir, as batidas
// legadas ficam guardadas e pendentes, e o diagnóstico mostra o problema para
// resolução manual. Nenhuma regra nova depende deste arquivo.

export async function enviarLegado({ armazem, api, eventos }) {
  if (!eventos.length) return { enviadas: 0, erro: null };
  const r = await api("ponto-enviar-marcacoes", { marcacoes: eventos.map(({ formatVersion, legacyDeviceSequence, ...m }) => m) });
  if (!r.ok) return { enviadas: 0, erro: r.error || `HTTP ${r.status}`, semRede: r.status === 0, status: r.status, codigo: r.code || null };
  // "ultimoNsr" da resposta legada = topo da sequência DO APARELHO no formato 1
  // (legacyDeviceSequence). Não é NSR fiscal.
  const topo = Number(r.ultimoNsr || 0);
  if ((await armazem.hashDaSequencia(topo)) !== String(r.ultimoHash || "").toLowerCase()) {
    return { enviadas: 0, erro: "batidas antigas (formato 1) com sequência diferente da do servidor - ficam guardadas para resolução manual", legadoDivergente: true };
  }
  const enviadas = await armazem.confirmarLegadoAte(topo);
  if (r.erro) return { enviadas, erro: r.erro };
  return { enviadas, erro: enviadas ? null : "o servidor não confirmou nenhuma batida antiga do lote" };
}
