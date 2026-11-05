import { exigir, texto, numero, cpf, identificacao, data, periodo, dh, hora, validarDh, inpi, arquivoLinhas, ASSINATURA_EXTERNA, pacoteNaoAssinado } from "./campos.js";
export const VERSAO_AEJ = "002";
const field = (v, max, name, optional = false) => texto(v ?? "", max, name, optional);
const row = values => values.join("|");
const id = (v, name) => numero(v, 9, name, 1);
function unique(items, key, name) {
  const map = new Map();
  for (const item of items) { const k = String(item[key]); exigir(!map.has(k), "IDENTIFICADOR_DUPLICADO", name); map.set(k, item); }
  return map;
}
export function gerarAej({ empregador, ptrp, reps, vinculos, horarios, marcacoes, ausencias = [], de, ate, geradoEm, originais = [] }) {
  periodo(de, ate);
  exigir([reps, vinculos, horarios, marcacoes, ausencias, originais].every(Array.isArray), "COLECAO_AEJ_AUSENTE");
  const [type, employerId] = identificacao(empregador);
  const repMap = unique(reps, "id", "reps"), workerMap = unique(vinculos, "id", "vinculos"), scheduleMap = unique(horarios, "codigo", "horarios");
  const originalMap = unique(originais, "eventId", "originais"), used = new Set();
  const lines = [row(["01", type, employerId, empregador.caepf || "", empregador.cno || "", field(empregador.nome, 150, "empregador"), de, ate, dh(geradoEm, empregador.timezone), VERSAO_AEJ])];
  exigir(!empregador.caepf || /^\d{14}$/.test(empregador.caepf), "CAEPF_INVALIDO");
  exigir(!empregador.cno || /^\d{12}$/.test(empregador.cno), "CNO_INVALIDO");
  for (const r of reps) {
    exigir(r.tipo === 3, "ESCOPO_APENAS_REP_P");
    lines.push(row(["02", id(r.id, "rep"), "3", inpi(r.inpi)]));
  }
  const cpfCount = new Map();
  for (const w of vinculos) {
    cpf(w.cpf); cpfCount.set(w.cpf, (cpfCount.get(w.cpf) || 0) + 1);
    lines.push(row(["03", id(w.id, "vinculo"), w.cpf, field(w.nome, 150, "nome")]));
  }
  for (const h of horarios) {
    exigir(Array.isArray(h.pares) && h.pares.length >= 1, "HORARIO_SEM_PARES");
    lines.push(row(["04", field(h.codigo, 30, "horario"), numero(h.duracaoMinutos, 12, "duracao", 1),
      ...h.pares.flatMap(p => [hora(p.entrada), hora(p.saida)]), ...(h.pares.length === 1 ? ["", ""] : [])]));
  }
  const ordered = [...marcacoes].sort((a, b) => String(a.vinculoId).localeCompare(String(b.vinculoId)) || Date.parse(a.marcadoEm) - Date.parse(b.marcadoEm) || String(a.eventId || a.id).localeCompare(String(b.eventId || b.id)));
  const pairState = new Map(), openByWorker = new Map();
  for (const m of ordered) {
    const worker = workerMap.get(String(m.vinculoId));
    exigir(worker, "VINCULO_INEXISTENTE");
    exigir(["E", "S", "D"].includes(m.tipo), "TIPO_MARCACAO_INVALIDO");
    exigir(["O", "I", "P", "X", "T"].includes(m.fonte), "FONTE_MARCACAO_INVALIDA");
    const stamp = dh(m.marcadoEm, empregador.timezone), day = stamp.slice(0, 10);
    exigir(day >= de && day <= ate, "MARCACAO_FORA_DO_PERIODO");
    const sequence = numero(m.par, 3, "par", 1);
    const reason = field(m.motivo, 150, "motivo", !(m.tipo === "D" || m.fonte === "I"));
    if (m.tipo === "D" || m.fonte !== "O") exigir(m.responsavel && m.tratadoEm, "TRATAMENTO_SEM_RESPONSAVEL");
    if (m.tipo === "E" && Number(sequence) === 1) exigir(scheduleMap.has(m.horarioCodigo), "PRIMEIRA_ENTRADA_SEM_HORARIO");
    if (m.horarioCodigo) exigir(scheduleMap.has(m.horarioCodigo), "HORARIO_INEXISTENTE");
    if (m.fonte === "O") {
      exigir(repMap.has(String(m.repId)), "REP_INEXISTENTE");
      const original = originalMap.get(m.eventId);
      exigir(original && !used.has(m.eventId), "ORIGINAL_AUSENTE_OU_DUPLICADO");
      exigir(String(original.employeeId) === String(worker.employeeId) && Date.parse(original.marcadoEm) === Date.parse(m.marcadoEm), "ORIGINAL_ALTERADO");
      exigir(original.cpf === worker.cpf, "CPF_ORIGINAL_DIVERGE_DO_VINCULO");
      used.add(m.eventId);
    } else {
      exigir(!m.eventId && !m.repId, "TRATAMENTO_NAO_E_ORIGINAL");
    }
    if (m.tipo !== "D") {
      const key = String(m.vinculoId) + "|" + (m.dataJornada || day) + "|" + sequence;
      const state = pairState.get(key);
      exigir(m.tipo === "E" ? !state : state === "E", "PAR_ENTRADA_SAIDA_INCOMPATIVEL");
      exigir(m.tipo === "E" ? !openByWorker.has(String(m.vinculoId)) : openByWorker.get(String(m.vinculoId)) === key, "INTERVALOS_SOBREPOSTOS");
      if (m.tipo === "E") openByWorker.set(String(m.vinculoId), key);
      else openByWorker.delete(String(m.vinculoId));
      pairState.set(key, m.tipo);
    }
    lines.push(row(["05", String(m.vinculoId), stamp, m.repId ? String(m.repId) : "", m.tipo, sequence.padStart(3, "0"), m.fonte, m.horarioCodigo || "", reason]));
  }
  exigir(used.size === originalMap.size, "ORIGINAIS_OMITIDOS");
  exigir([...pairState.values()].every(s => s === "S"), "JORNADA_ABERTA");
  const matriculas = new Set();
  for (const w of vinculos) if (cpfCount.get(w.cpf) > 1) {
    const matricula = field(w.matriculaEsocial, 30, "matriculaEsocial");
    exigir(!matriculas.has(w.cpf + "|" + matricula), "MATRICULA_ESOCIAL_DUPLICADA");
    matriculas.add(w.cpf + "|" + matricula);
    lines.push(row(["06", String(w.id), matricula]));
  }
  for (const a of ausencias) {
    exigir(workerMap.has(String(a.vinculoId)), "VINCULO_INEXISTENTE");
    exigir([1, 2, 3, 4].includes(a.tipo), "TIPO_AUSENCIA_INVALIDO");
    data(a.data); exigir(a.data >= de && a.data <= ate, "AUSENCIA_FORA_DO_PERIODO");
    exigir(a.responsavel && a.tratadoEm, "AUSENCIA_SEM_CONFIRMACAO");
    if (a.tipo === 3) exigir([1, 2].includes(a.movimento), "MOVIMENTO_BANCO_INVALIDO");
    else exigir(a.minutos == null && a.movimento == null, "MOVIMENTO_INDEVIDO");
    lines.push(row(["07", String(a.vinculoId), String(a.tipo), a.data, a.tipo === 3 ? numero(a.minutos, 12, "minutos", 1) : "", a.tipo === 3 ? String(a.movimento) : ""]));
  }
  const [developerType, developerId] = identificacao(ptrp?.desenvolvedor, "desenvolvedorPTRP");
  lines.push(row(["08", field(ptrp.nome, 150, "nomePTRP"), field(ptrp.versao, 8, "versaoPTRP"), developerType, developerId,
    field(ptrp.desenvolvedor.nome, 150, "nomeDesenvolvedor"), field(ptrp.desenvolvedor.email, 50, "email")]));
  exigir(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ptrp.desenvolvedor.email), "EMAIL_INVALIDO");
  const counts = Array.from({ length: 8 }, (_, i) => lines.filter(l => l.startsWith(String(i + 1).padStart(2, "0") + "|")).length);
  lines.push(row(["99", ...counts.map(String)]), ASSINATURA_EXTERNA);
  return pacoteNaoAssinado("AEJ_" + de + "_" + ate + ".txt", arquivoLinhas(lines), { versaoLeiaute: VERSAO_AEJ, contagens: counts });
}
export function validarAej(bytes) {
  const lines = Buffer.from(bytes).toString("latin1").split("\r\n"), erros = [];
  if (lines.pop() !== "" || lines.some(l => !l || /[\r\n]/.test(l))) return { ok: false, erros: ["QUEBRA_LINHA_INVALIDA"] };
  const signature = lines.pop(), trailer = lines.pop()?.split("|");
  if (signature !== ASSINATURA_EXTERNA) erros.push("MARCADOR_ASSINATURA_INVALIDO");
  const sizes = { "01": 10, "02": 4, "03": 4, "05": 9, "06": 3, "07": 6, "08": 7 };
  const counts = Array(8).fill(0);
  const reps = new Set(), workers = new Set(), schedules = new Set();
  for (const l of lines) {
    const f = l.split("|"), t = f[0];
    if (!(t in sizes) && t !== "04") erros.push("TIPO_INVALIDO");
    else if (t === "04" ? f.length < 7 || f.length % 2 !== 1 : f.length !== sizes[t]) erros.push("CAMPOS_INVALIDOS");
    if (Number(t) >= 1 && Number(t) <= 8) counts[Number(t) - 1]++;
    try {
      if (t === "01") { identificacao({ tipo: f[1] === "1" ? "cnpj" : f[1] === "2" ? "cpf" : "", numero: f[2] }); periodo(f[6], f[7]); validarDh(f[8]); }
      if (t === "02") { id(f[1], "rep"); exigir(!reps.has(f[1]) && f[2] === "3", "REP_INVALIDO"); inpi(f[3]); reps.add(f[1]); }
      if (t === "03") { id(f[1], "vinculo"); exigir(!workers.has(f[1]), "VINCULO_DUPLICADO"); cpf(f[2]); field(f[3], 150, "nome"); workers.add(f[1]); }
      if (t === "04") { field(f[1], 30, "horario"); exigir(!schedules.has(f[1]), "HORARIO_DUPLICADO"); numero(f[2], 12, "duracao", 1); f.slice(3).filter(Boolean).forEach(v => hora(v)); schedules.add(f[1]); }
      if (t === "05") {
        exigir(workers.has(f[1]), "VINCULO_INEXISTENTE"); validarDh(f[2]); numero(f[5], 3, "par", 1);
        exigir(["E", "S", "D"].includes(f[4]) && ["O", "I", "P", "X", "T"].includes(f[6]), "MARCACAO_INVALIDA");
        if (f[6] === "O") exigir(reps.has(f[3]), "REP_INEXISTENTE");
        else exigir(!f[3], "REP_EM_TRATAMENTO");
        if (f[4] === "E" && Number(f[5]) === 1) exigir(schedules.has(f[7]), "HORARIO_INEXISTENTE");
        if (f[7]) exigir(schedules.has(f[7]), "HORARIO_INEXISTENTE");
        field(f[8], 150, "motivo", !(f[4] === "D" || f[6] === "I"));
      }
      if (t === "06") { exigir(workers.has(f[1]), "VINCULO_INEXISTENTE"); field(f[2], 30, "matricula"); }
      if (t === "07") {
        exigir(workers.has(f[1]) && ["1", "2", "3", "4"].includes(f[2]), "AUSENCIA_INVALIDA"); data(f[3]);
        if (f[2] === "3") { numero(f[4], 12, "minutos", 1); exigir(["1", "2"].includes(f[5]), "MOVIMENTO_INVALIDO"); }
        else exigir(!f[4] && !f[5], "MOVIMENTO_INDEVIDO");
      }
      if (t === "08") { field(f[1], 150, "nomePTRP"); field(f[2], 8, "versaoPTRP"); identificacao({ tipo: f[3] === "1" ? "cnpj" : f[3] === "2" ? "cpf" : "", numero: f[4] }); field(f[5], 150, "nomeDev"); field(f[6], 50, "email"); }
    } catch { erros.push("DADOS_OU_REFERENCIAS_INVALIDOS"); }
  }
  if (lines[0]?.split("|")[9] !== "002" || counts[0] !== 1 || counts[7] !== 1) erros.push("ESTRUTURA_INVALIDA");
  if (!trailer || trailer[0] !== "99" || trailer.length !== 9 || counts.some((c, i) => String(c) !== trailer[i + 1])) erros.push("TRAILER_INVALIDO");
  return { ok: erros.length === 0, erros, contagens: counts, assinaturaVerificada: false };
}
