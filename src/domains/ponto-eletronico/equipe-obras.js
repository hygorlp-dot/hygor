import { FUSO_OBRA } from "./painel.js";
import { TIPOS_EVENTO_JORNADA } from "./evento.js";

export const SITUACOES_EQUIPE = Object.freeze({
  atividade: "Em atividade", intervalo: "Em intervalo", falta: "Falta confirmada",
  sem_registro: "Sem registro hoje", aguardando: "Aguardando início da jornada",
  encerrada: "Jornada encerrada", conferir: "Conferir jornada",
  sem_obra: "Obra não identificada / conferir registro",
});
export const diaNoFuso = (agora, fuso = FUSO_OBRA) => new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(agora));
const texto = v => String(v ?? "");
const normalizar = v => texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Projeção somente leitura. Não infere a natureza da batida pela paridade.
// Entrada explícita inicia nova jornada; intervalo/retorno exigem sequência válida.
export function montarEquipeObras({ employees = [], obras = [], marcacoes = [], attendance = {}, agora = Date.now(), fuso = FUSO_OBRA }) {
  const dia = diaNoFuso(agora, fuso);
  const obraIds = new Set(obras.map(o => texto(o.id)));
  const porPessoa = new Map();
  const vistos = new Set();
  for (const m of [...marcacoes].sort((a, b) => Date.parse(a.marcadoEm) - Date.parse(b.marcadoEm) || texto(a.eventId).localeCompare(texto(b.eventId)))) {
    if (m.tipoRegistro !== "ponto" || !m.employeeId || m.cancelado || m.valido === false) continue;
    const id = texto(m.eventId || m.id);
    if (id && vistos.has(id)) continue;
    if (id) vistos.add(id);
    const key = texto(m.employeeId);
    if (!porPessoa.has(key)) porPessoa.set(key, []);
    porPessoa.get(key).push(m);
  }
  const pessoas = new Map();
  for (const e of employees) {
    const id = texto(e.id);
    if (!id || pessoas.has(id)) continue;
    const eventos = porPessoa.get(id) || [];
    const hoje = eventos.filter(m => Number.isFinite(Date.parse(m.marcadoEm)) && diaNoFuso(m.marcadoEm, fuso) === dia);
    if ((e.active === false || e.status === "desligado" || (e.endDate && e.endDate < dia) || (e.startDate && e.startDate > dia)) && !hoje.length) continue;
    let situacao = "sem_registro", obraId = "", inicio = null, jornada = [], pendencias = [];
    let ultimo = null;
    for (const m of eventos) {
      const ms = Date.parse(m.marcadoEm);
      if (!Number.isFinite(ms) || ms > agora) { pendencias.push("Registro com horário inválido ou futuro."); situacao = "conferir"; continue; }
      const atualHoje = diaNoFuso(m.marcadoEm, fuso) === dia;
      if (!m.tipoEvento || !Object.hasOwn(TIPOS_EVENTO_JORNADA, m.tipoEvento)) {
        if (atualHoje || inicio !== null) { jornada.push(m); situacao = "conferir"; pendencias.push("Batida antiga sem tipo de evento. Não é possível distinguir intervalo de saída final."); }
        ultimo = m;
        continue;
      }
      if (m.tipoEvento === "entrada") {
        // Uma nova entrada é uma transferência explícita de obra, sem duplicar a pessoa.
        jornada = [m]; inicio = ms; pendencias = []; situacao = "atividade"; obraId = texto(m.obraId);
      } else if (inicio !== null) {
        jornada.push(m);
        if (m.tipoEvento === "intervalo" && situacao === "atividade") situacao = "intervalo";
        else if (m.tipoEvento === "retorno" && situacao === "intervalo") { situacao = "atividade"; obraId = texto(m.obraId); }
        else if (m.tipoEvento === "saida" && ["atividade", "intervalo"].includes(situacao)) situacao = "encerrada";
        else { situacao = "conferir"; pendencias.push("Sequência de eventos incompatível. Confira a jornada."); }
      } else if (atualHoje) { jornada.push(m); situacao = "conferir"; pendencias.push("Evento sem entrada identificada na janela consultada."); }
      if (ultimo && ultimo.marcadoEm === m.marcadoEm && ultimo.eventId !== m.eventId) { situacao = "conferir"; pendencias.push("Mais de um evento no mesmo instante."); }
      ultimo = m;
    }
    const ultimoDaJornada = jornada.at(-1);
    if (situacao === "encerrada" && ultimoDaJornada && diaNoFuso(ultimoDaJornada.marcadoEm, fuso) !== dia) { situacao = "sem_registro"; jornada = []; inicio = null; obraId = ""; }
    // 24h é um limite de conferência do painel, não encerramento ou regra de folha.
    if (["atividade", "intervalo"].includes(situacao) && agora - inicio > 24 * 3600000) { situacao = "conferir"; pendencias.push("Jornada aberta há mais de 24 horas; conferir, sem encerramento automático."); }
    if (jornada.some(m => m.horaConfiavel === false || m.relogioAlterado)) pendencias.push("Há registros com horário não confiável.");
    if (pendencias.includes("Há registros com horário não confiável.")) situacao = "conferir";
    if (["atividade", "intervalo"].includes(situacao) && !obraIds.has(obraId)) { situacao = "sem_obra"; pendencias.push("A obra da batida não foi identificada no cadastro acessível."); }
    const registro = attendance?.[id]?.[dia];
    const status = typeof registro === "string" ? registro : registro?.status;
    if (status === "F") {
      if (!hoje.length && !["atividade", "intervalo"].includes(situacao)) situacao = "falta";
      else pendencias.push("Existe falta confirmada no ponto e também batida de jornada. Confira a divergência.");
    }
    if (situacao === "sem_registro" && /^\d{2}:\d{2}$/.test(e.workStart || "")) {
      const hora = new Date(agora).toLocaleTimeString("en-GB", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      if (hora < e.workStart) situacao = "aguardando";
    }
    pessoas.set(id, { id, nome: e.name || e.nome || "Funcionário sem nome", funcao: e.role || e.funcao || "", fotoUrl: e.fotoUrl || "", obraPrevistaId: texto(e.obra), obraId: ["atividade", "intervalo"].includes(situacao) ? obraId : "", obraRegistradaId: obraId, situacao, eventos: jornada.length ? jornada : hoje, horario: (jornada.at(-1) || hoje.at(-1))?.marcadoEm || null, pendencias: [...new Set(pendencias)] });
  }
  return [...pessoas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function filtrarEquipeObras(pessoas, obras, { busca = "", obraId = "", situacao = "" } = {}) {
  const termo = normalizar(busca.trim());
  const nomes = new Map(obras.map(o => [texto(o.id), normalizar(o.name)]));
  const filtradas = pessoas.filter(p => (!situacao || p.situacao === situacao)
    && (!obraId || (p.obraId || p.obraPrevistaId) === obraId)
    && (!termo || normalizar(p.nome).includes(termo) || nomes.get(p.obraId || p.obraPrevistaId)?.includes(termo)));
  return { pessoas: filtradas, obras: obras.filter(o => (!obraId || texto(o.id) === obraId) && (!termo || normalizar(o.name).includes(termo) || filtradas.some(p => p.obraId === texto(o.id)))) };
}
