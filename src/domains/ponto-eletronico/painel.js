// Leitura das marcações do app "Ponto de Obra" para a aba do ARCD. Puro.
//
// A marcação do REP é só um instante: o app não pergunta "entrada" ou
// "saída". A leitura em pares (1ª entrada, 2ª saída...) é uma interpretação
// para a tela - a classificação oficial da jornada é tratamento posterior
// (fase 3, AEJ), nunca uma alteração da marcação.

export const FUSO_OBRA = "America/Recife";

export const horaLocal = iso => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO_OBRA, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
export const dataLocal = iso => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: FUSO_OBRA }) : "");

// Intervalo UTC [de, ate] que cobre o dia civil `dia` (AAAA-MM-DD) no fuso da obra.
export function intervaloDoDia(dia) {
  const [a, m, d] = String(dia).split("-").map(Number);
  const inicioLocalComoUtc = Date.UTC(a, m - 1, d, 0, 0, 0);
  // Diferença do fuso no meio do dia (sem horário de verão em PE hoje, mas
  // calculado em vez de fixo em -3).
  const meioDia = new Date(Date.UTC(a, m - 1, d, 12));
  const horaNoFuso = Number(meioDia.toLocaleString("en-US", { timeZone: FUSO_OBRA, hour: "2-digit", hourCycle: "h23" }));
  const deslocamentoMs = (12 - horaNoFuso) * 3_600_000;
  const de = new Date(inicioLocalComoUtc + deslocamentoMs);
  const ate = new Date(de.getTime() + 86_400_000 - 1);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

// funcionarios: equipe LOTADA na obra (exibição). todos: cadastro da empresa,
// para nomear quem é lotado em outra obra e bateu aqui - funcionário é global
// e pode bater em qualquer aparelho (a obra da batida é a de CAPTURA).
export function resumoDoDia(marcacoes, funcionarios, todos = []) {
  const porFuncionario = new Map();
  for (const m of marcacoes || []) {
    if (m.tipoRegistro !== "ponto" || !m.employeeId) continue;
    if (!porFuncionario.has(m.employeeId)) porFuncionario.set(m.employeeId, []);
    porFuncionario.get(m.employeeId).push(m);
  }
  const linhas = (funcionarios || []).map(f => {
    const batidas = (porFuncionario.get(String(f.id)) || []).sort((a, b) => String(a.marcadoEm).localeCompare(String(b.marcadoEm)));
    porFuncionario.delete(String(f.id));
    return linha(f, batidas);
  });
  // Marcação de alguém que já não está ativo na obra (transferido/desligado
  // depois de bater) continua aparecendo - registro legal não some da tela.
  for (const [employeeId, batidas] of porFuncionario) {
    const cadastro = (todos || []).find(f => String(f.id) === String(employeeId));
    linhas.push(linha({ id: employeeId, nome: cadastro?.nome || cadastro?.name || "(funcionário não encontrado no cadastro)", funcao: cadastro?.funcao || cadastro?.role || "", foraDaObra: true }, batidas.sort((a, b) => String(a.marcadoEm).localeCompare(String(b.marcadoEm)))));
  }
  return linhas.sort((a, b) => ordemSituacao[a.situacao] - ordemSituacao[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR"));
}

const ordemSituacao = { em_jornada: 0, fechada: 1, sem_batida: 2 };
function linha(f, batidas) {
  const situacao = !batidas.length ? "sem_batida" : batidas.length % 2 === 1 ? "em_jornada" : "fechada";
  return {
    employeeId: String(f.id), nome: String(f.nome || f.name || ""), funcao: f.funcao || f.role || "", foraDaObra: !!f.foraDaObra,
    batidas, situacao,
    alertas: batidas.filter(b => !b.horaConfiavel || b.relogioAlterado || b.metodo === "encarregado").length,
  };
}

export const ROTULO_SITUACAO = { em_jornada: "Em jornada", fechada: "Jornada fechada", sem_batida: "Sem batida" };

// Aparelho "parado": sem contato há mais de 15 minutos é sinal de sem
// internet ou desligado - as marcações seguem guardadas nele.
export function situacaoAparelho(d, agoraMs = Date.now()) {
  if (d.status !== "ativo") return { rotulo: "Desativado", tom: "neutro" };
  if (!d.ultimoContatoEm) return { rotulo: "Nunca conectou", tom: "atencao" };
  const min = Math.round((agoraMs - Date.parse(d.ultimoContatoEm)) / 60000);
  if (min <= 15) return { rotulo: "Online", tom: "ok" };
  if (min < 60) return { rotulo: `Sem contato há ${min} min`, tom: "atencao" };
  const h = Math.round(min / 60);
  return { rotulo: h < 48 ? `Sem contato há ${h} h` : `Sem contato há ${Math.round(h / 24)} dias`, tom: "critico" };
}
