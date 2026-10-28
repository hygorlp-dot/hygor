// PONTE provisória REP-P -> grade de presença (item 1.5 do roadmap de correção).
//
// As batidas do app de ponto e a apropriação por obra vivem no servidor
// (ponto_eventos / ponto_apropriacoes); a folha ainda lê a grade legada
// (data.attendance: P/M/F + horários). Sem ponte, alguém redigita o ponto do
// app na grade durante o piloto. Aqui só se PROPÕE: o RH confere e confirma,
// e nada é gravado sem essa confirmação. Quando a Fase 03 do ponto fizer a
// folha ler direto do REP-P, este módulo deixa de existir.
import { proporApropriacoes } from "./apropriacao.js";

const FUSO = "America/Recife";
const partes = iso => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone:FUSO, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { data:`${p.year}-${p.month}-${p.day}`, hora:`${p.hour}:${p.minute}` };
};
const minutos = (inicio, fim) => Math.max(0, Math.round((Date.parse(fim) - Date.parse(inicio)) / 60000));

// Regra da situação do dia a partir do tempo trabalhado. Padrão: 75% da
// jornada ou mais = presente; qualquer tempo menor = meio dia. Dia só com
// batida sem saída não vira situação: fica como aviso para o RH decidir.
export const situacaoPelaJornada = (minutosTrabalhados, jornadaMinutos = 480) => {
  if (!(minutosTrabalhados > 0)) return null;
  return minutosTrabalhados >= jornadaMinutos * 0.75 ? "P" : "M";
};

// Intervalos de um funcionário num dia: a apropriação confirmada vence a
// sugestão pelas batidas (ela já foi tratada por alguém).
const intervalosDoDia = (apropriacoes, batidas) => {
  if (apropriacoes.length) {
    return { origem:"apropriacao", avisos:[], intervalos:apropriacoes.map(a => ({ inicio:a.inicio, fim:a.fim, obraId:a.obraApropriadaId })) };
  }
  const { intervalos, avisos } = proporApropriacoes(batidas.map(b => ({
    eventId:b.eventId, marcadoEm:b.marcadoEm, obraCapturaId:b.obraCapturaId || b.obraId,
  })));
  return { origem:"batidas", avisos, intervalos:intervalos.map(i => ({ inicio:i.inicio, fim:i.fim, obraId:i.obraApropriadaId })) };
};

export function proporGradeDoREP({ marcacoes = [], apropriacoes = [], jornadaHorasPorFuncionario = {}, jornadaPadraoHoras = 8 } = {}) {
  const chave = (employeeId, data) => `${employeeId}__${data}`;
  const grupos = new Map();
  const grupo = (employeeId, data) => {
    const k = chave(employeeId, data);
    if (!grupos.has(k)) grupos.set(k, { employeeId, data, batidas:[], apropriacoes:[] });
    return grupos.get(k);
  };
  marcacoes
    .filter(m => m?.employeeId && m?.marcadoEm && (m.tipoRegistro || "ponto") === "ponto")
    .forEach(m => grupo(String(m.employeeId), partes(m.marcadoEm).data).batidas.push(m));
  apropriacoes
    .filter(a => a?.employeeId && a?.data && !["cancelada", "cancelado"].includes(String(a.status || "").toLowerCase()))
    .forEach(a => grupo(String(a.employeeId), a.data).apropriacoes.push(a));

  return [...grupos.values()].map(g => {
    const { origem, avisos, intervalos } = intervalosDoDia(g.apropriacoes, g.batidas);
    const ordenados = [...intervalos].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    const porObra = new Map();
    ordenados.forEach(i => porObra.set(i.obraId, (porObra.get(i.obraId) || 0) + minutos(i.inicio, i.fim)));
    const trabalhados = [...porObra.values()].reduce((s, v) => s + v, 0);
    const jornadaMin = Math.round(Number(jornadaHorasPorFuncionario[g.employeeId] || jornadaPadraoHoras) * 60);
    // A grade guarda UMA obra por dia: a de mais tempo. As demais ficam
    // registradas como aviso para quem confere.
    const obras = [...porObra.entries()].sort((a, b) => b[1] - a[1]);
    const primeiro = ordenados[0], ultimo = ordenados.at(-1), segundo = ordenados[1];
    const status = situacaoPelaJornada(trabalhados, jornadaMin);
    return {
      employeeId:g.employeeId, date:g.data, origem, status,
      obraId:obras[0]?.[0] || "",
      entrada:primeiro ? partes(primeiro.inicio).hora : "",
      intervaloSaida:segundo ? partes(primeiro.fim).hora : "",
      intervaloRetorno:segundo ? partes(segundo.inicio).hora : "",
      saida:ultimo ? partes(ultimo.fim).hora : "",
      workedMinutes:trabalhados,
      ot:Math.max(0, Math.floor((trabalhados - jornadaMin) / 15) * 15) / 60,
      avisos:[
        ...avisos.map(a => a.tipo === "sem_saida" ? `Batida sem saída às ${partes(a.marcadoEm).hora}` : a.tipo),
        ...(obras.length > 1 ? [`Trabalhou em ${obras.length} obras; a grade fica com a de mais horas`] : []),
      ],
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
}

// Diferença entre a proposta e o que já está na grade (a proposta nunca
// sobrescreve em silêncio: o RH vê o que muda).
export const divergenciaComGrade = (proposta, atual) => {
  if (!atual?.status) return "novo";
  if (atual.status !== proposta.status || String(atual.obraId || "") !== proposta.obraId) return "diferente";
  return "igual";
};
